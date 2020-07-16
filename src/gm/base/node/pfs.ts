import * as fs from 'fs';
import { join, resolve } from 'path';
import { promisify } from 'util';

import junk from 'junk';
import { Event } from '@/gm/base/common/event';
import archiver from 'archiver';

import unzipper from 'unzipper';
import { isMacintosh, isWindows } from '@/gm/base/platform';
import { encode, encodeStream } from '@/gm/base/node/encoding';

import { Queue } from '@/gm/base/common/async';
import { isRootOrDriveLetter } from '@/gm/base/common/extpath';
import * as os from 'os';

import { generateUuid } from '@/gm/base/common/uuid';

export enum RimRafMode {
  UNLINK,
  MOVE,
}

export async function readdirWithFileTypes(path: string): Promise<fs.Dirent[]> {
  return promisify(fs.readdir)(path, { withFileTypes: true });
}

export function rename(oldPath: string, newPath: string): Promise<void> {
  return promisify(fs.rename)(oldPath, newPath);
}

export function exists(path: string): Promise<boolean> {
  return promisify(fs.exists)(path);
}

export function unlink(path: string): Promise<void> {
  return promisify(fs.unlink)(path);
}

export function lstat(path: string): Promise<fs.Stats> {
  return promisify(fs.lstat)(path);
}

export function stat(path: string): Promise<fs.Stats> {
  return promisify(fs.stat)(path);
}

export function mkdir(path: string): Promise<void> {
  return promisify(fs.mkdir)(path);
}

export function readFile(path: string): Promise<Buffer>;
export function readFile(path: string, encoding: string): Promise<string>;
export function readFile(path: string, encoding?: string): Promise<Buffer | string> {
  return promisify(fs.readFile)(path, encoding);
}

export async function dirExists(path: string): Promise<boolean> {
  try {
    const fileStat = await stat(path);

    return fileStat.isDirectory();
  } catch (error) {
    return false;
  }
}

export interface IStatAndLink {
  stat: fs.Stats;
  isSymbolicLink: boolean;
}

export async function statLink(path: string): Promise<IStatAndLink> {
  let linkStat: fs.Stats | undefined;
  let linkStatError: NodeJS.ErrnoException | undefined;
  try {
    linkStat = await lstat(path);
  } catch (error) {
    linkStatError = error;
  }

  const isLink = !!(linkStat && linkStat.isSymbolicLink());
  if (linkStatError || isLink) {
    const fileStat = await stat(path);

    return { stat: fileStat, isSymbolicLink: isLink };
  }

  return { stat: linkStat!, isSymbolicLink: false };
}

export async function rimrafUnlink(targetPath: string): Promise<void> {
  try {
    const stat = await lstat(targetPath);

    if (stat.isDirectory() && !stat.isSymbolicLink()) {
      const children = await readdir(targetPath);
      await Promise.all(children.map(child => rimrafUnlink(join(targetPath, child))));

      await promisify(fs.rmdir)(targetPath);
    } else {
      const mode = stat.mode;
      if (!(mode & 128)) {
        await chmod(targetPath, mode | 128);
      }

      return unlink(targetPath);
    }
  } catch (error) {
    switch (error.code) {
      case 'ENOENT':
        throw error;
      default:
        break;
    }
  }
}

export async function readdir(path: string): Promise<string[]> {
  return handleDirectoryChildren(await promisify(fs.readdir)(path));
}

function handleDirectoryChildren(children: string[]): string[] {
  return children;
}

export function chmod(path: string, mode: number): Promise<void> {
  return promisify(fs.chmod)(path, mode);
}

export async function scanFolder(dir: string) {
  const subdirs = await readdir(dir);
  const clearSubdirs = subdirs.filter(it => junk.not(it));

  const files: any = await Promise.all(
    clearSubdirs.map(async subdir => {
      const res = resolve(dir, subdir);

      return (await stat(res)).isDirectory() ? scanFolder(res) : res;
    })
  );

  return files.reduce((a: string, f: string) => a.concat(f), []);
}

const writeFilePathQueues: Map<string, Queue<void>> = new Map();

export function writeFile(
  path: string,
  data: string | Buffer | NodeJS.ReadableStream | Uint8Array,
  options?: IWriteFileOptions
): Promise<void> {
  const queueKey = toQueueKey(path);

  return ensureWriteFileQueue(queueKey).queue(() => writeFileAndFlush(path, data, options));
}

function toQueueKey(path: string): string {
  let queueKey = path;
  if (isWindows || isMacintosh) {
    queueKey = queueKey.toLowerCase();
  }

  return queueKey;
}

function ensureWriteFileQueue(queueKey: string): Queue<void> {
  const existingWriteFileQueue = writeFilePathQueues.get(queueKey);
  if (existingWriteFileQueue) {
    return existingWriteFileQueue;
  }

  const writeFileQueue = new Queue<void>();
  writeFilePathQueues.set(queueKey, writeFileQueue);

  const onFinish = Event.once(writeFileQueue.onFinished);
  onFinish(() => {
    writeFilePathQueues.delete(queueKey);
    writeFileQueue.dispose();
  });

  return writeFileQueue;
}

export interface IWriteFileOptions {
  mode?: number;
  flag?: string;
  encoding?: {
    charset: string;
    addBOM: boolean;
  };
}

interface IEnsuredWriteFileOptions extends IWriteFileOptions {
  mode: number;
  flag: string;
}

let canFlush = true;

function writeFileAndFlush(
  path: string,
  data: string | Buffer | NodeJS.ReadableStream | Uint8Array,
  options: IWriteFileOptions | undefined
): Promise<void> {
  const ensuredOptions = ensureWriteOptions(options);

  return new Promise((resolve, reject) => {
    if (typeof data === 'string' || Buffer.isBuffer(data) || data instanceof Uint8Array) {
      doWriteFileAndFlush(path, data, ensuredOptions, error => (error ? reject(error) : resolve()));
    } else {
      doWriteFileStreamAndFlush(path, data, ensuredOptions, error =>
        error ? reject(error) : resolve()
      );
    }
  });
}

function ensureWriteOptions(options?: IWriteFileOptions): IEnsuredWriteFileOptions {
  if (!options) {
    return { mode: 0o666, flag: 'w' };
  }

  return {
    mode: typeof options.mode === 'number' ? options.mode : 0o666,
    flag: typeof options.flag === 'string' ? options.flag : 'w',
    encoding: options.encoding,
  };
}

function doWriteFileStreamAndFlush(
  path: string,
  reader: NodeJS.ReadableStream,
  options: IEnsuredWriteFileOptions,
  callback: (error?: Error) => void
): void {
  let finished = false;
  const finish = (error?: Error) => {
    if (!finished) {
      finished = true;

      if (error) {
        if (isOpen) {
          writer.once('close', () => callback(error));
          writer.destroy();
        } else {
          callback(error);
        }
      } else {
        callback();
      }
    }
  };

  const writer = fs.createWriteStream(path, {
    mode: options.mode,
    flags: options.flag,
    autoClose: false,
  });

  let fd: number;
  let isOpen: boolean;
  writer.once('open', descriptor => {
    fd = descriptor;
    isOpen = true;

    if (options.encoding) {
      reader = reader.pipe(
        encodeStream(options.encoding.charset, { addBOM: options.encoding.addBOM })
      );
    }

    reader.pipe(writer);
  });

  reader.once('error', error => finish(error));
  writer.once('error', error => finish(error));

  writer.once('finish', () => {
    if (canFlush && isOpen) {
      fs.fdatasync(fd, (syncError: Error) => {
        if (syncError) {
          console.warn(
            '[node.js fs] fdatasync is now disabled for this session because it failed: ',
            syncError
          );
          canFlush = false;
        }

        writer.destroy();
      });
    } else {
      writer.destroy();
    }
  });

  // Event: 'close'
  // Purpose: signal we are done to the outside
  // Notes: event is called when the writer's filedescriptor is closed
  writer.once('close', () => finish());
}

// Calls fs.writeFile() followed by a fs.sync() call to flush the changes to disk
// We do this in cases where we want to make sure the data is really on disk and
// not in some cache.
//
// See https://github.com/nodejs/node/blob/v5.10.0/lib/fs.js#L1194
function doWriteFileAndFlush(
  path: string,
  data: string | Buffer | Uint8Array,
  options: IEnsuredWriteFileOptions,
  callback: (error: Error | null) => void
): void {
  if (options.encoding) {
    data = encode(data instanceof Uint8Array ? Buffer.from(data) : data, options.encoding.charset, {
      addBOM: options.encoding.addBOM,
    });
  }

  if (!canFlush) {
    return fs.writeFile(path, data, { mode: options.mode, flag: options.flag }, callback);
  }

  // Open the file with same flags and mode as fs.writeFile()
  fs.open(path, options.flag, options.mode, (openError, fd) => {
    if (openError) {
      return callback(openError);
    }

    // It is valid to pass a fd handle to fs.writeFile() and this will keep the handle open!
    fs.writeFile(fd, data, writeError => {
      if (writeError) {
        return fs.close(fd, () => callback(writeError)); // still need to close the handle on error!
      }

      // Flush contents (not metadata) of the file to disk
      fs.fdatasync(fd, (syncError: Error) => {
        // In some exotic setups it is well possible that node fails to sync
        // In that case we disable flushing and warn to the console
        if (syncError) {
          console.warn(
            '[node.js fs] fdatasync is now disabled for this session because it failed: ',
            syncError
          );
          canFlush = false;
        }

        return fs.close(fd, closeError => callback(closeError));
      });
    });
  });
}

export async function rimraf(path: string, mode = RimRafMode.UNLINK): Promise<void> {
  if (isRootOrDriveLetter(path)) {
    throw new Error('rimraf - will refuse to recursively delete root');
  }

  if (mode === RimRafMode.UNLINK) {
    return rimrafUnlink(path);
  }

  return rimrafMove(path);
}

async function rimrafMove(path: string): Promise<void> {
  try {
    const pathInTemp = join(os.tmpdir(), generateUuid());
    try {
      await rename(path, pathInTemp);
    } catch (error) {
      return rimrafUnlink(path); // if rename fails, delete without tmp dir
    }

    // Delete but do not return as promise
    rimrafUnlink(pathInTemp);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }
}

export async function createZip(
  dirToZip: string,
  dirToSave: string,
  filename: string
): Promise<string> {
  return new Promise(resolve => {
    const outputFilePath = `${join(dirToSave, filename)}.zip`;

    const output = fs.createWriteStream(outputFilePath);
    const archive = archiver('zip', {
      zlib: { level: 9 },
    });

    archive.on('end', () => {
      resolve(outputFilePath);
    });

    archive.pipe(output);
    archive.directory(dirToZip, false);
    archive.finalize();
  });
}

export async function unZip(dirToSave: string, filename: string) {
  return new Promise((resolve, reject) => {
    fs.createReadStream(filename)
      .pipe(unzipper.Extract({ path: dirToSave }))
      .on('close', () => {
        resolve(dirToSave);
      })
      .on('error', err => {
        reject(err);
      });
  });
}

export function truncate(path: string, len: number): Promise<void> {
  return promisify(fs.truncate)(path, len);
}

export async function copy(
  source: string,
  target: string,
  copiedSourcesIn?: { [path: string]: boolean }
): Promise<void> {
  const copiedSources = copiedSourcesIn ? copiedSourcesIn : Object.create(null);

  const fileStat = await stat(source);
  if (!fileStat.isDirectory()) {
    return doCopyFile(source, target, fileStat.mode & 511);
  }

  if (copiedSources[source]) {
    return Promise.resolve();
  }

  copiedSources[source] = true;

  await mkdirp(target, fileStat.mode & 511);

  const files = await readdir(source);

  // tslint:disable-next-line:prefer-for-of
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    await copy(join(source, file), join(target, file), copiedSources);
  }
}

async function doCopyFile(source: string, target: string, mode: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const reader = fs.createReadStream(source);
    const writer = fs.createWriteStream(target, { mode });

    let finished = false;
    const finish = (error?: Error) => {
      if (!finished) {
        finished = true;

        if (error) {
          return reject(error);
        }

        // we need to explicitly chmod because of https://github.com/nodejs/node/issues/1104
        fs.chmod(target, mode, error => (error ? reject(error) : resolve()));
      }
    };

    reader.once('error', error => finish(error));
    writer.once('error', error => finish(error));

    writer.once('close', () => finish());

    reader.pipe(writer);
  });
}

export async function mkdirp(path: string, mode?: number): Promise<void> {
  return promisify(fs.mkdir)(path, { mode, recursive: true });
}
