import { combinedDisposable, Disposable, IDisposable } from '@/gm/base/common/lifecycle';
import { Emitter, Event } from '@/gm/base/common/event';
import {
  createFileSystemProviderError,
  FileDeleteOptions,
  FileOpenOptions,
  FileOverwriteOptions,
  FileReadStreamOptions,
  FileSystemProviderCapabilities,
  FileSystemProviderError,
  FileSystemProviderErrorCode,
  FileType,
  FileWriteOptions,
  IFileChange,
  IStat,
  IWatchOptions,
} from '@/gm/platform/files/common/files';
import { joinPath, URI } from '@/gm/base/common/uri';
import {
  copy,
  exists,
  mkdir,
  readdirWithFileTypes,
  readFile,
  rimraf,
  RimRafMode,
  statLink,
  truncate,
  unlink,
} from '@/gm/base/node/pfs';
import * as path from 'path';

import { ILogService } from '@/gm/platform/log/common/log';
import { close, Dirent, fdatasync, open, read, Stats, write } from 'fs';
import { isLinux, isWindows } from '@/gm/base/platform';

import { CancellationToken, retry } from '@/gm/base/common/async';
import { promisify } from 'util';
import { move } from 'fs-extra';

import { isEqual } from '@/gm/base/common/extpath';
import { LogLevel } from '@/gm/platform/log/common/abstractLog';
import { FileWatcher, toFileChanges } from '@/gm/platform/files/node/watcher/watcherService';

export interface IWatcherOptions {
  pollingInterval?: number;
  usePolling: boolean;
}

export interface IDiskFileSystemProviderOptions {
  bufferSize?: number;
  watcher?: IWatcherOptions;
}

export class DiskFileSystemProvider extends Disposable {
  private readonly BUFFER_SIZE = this.options?.bufferSize || 64 * 1024;

  private readonly mapHandleToPos: Map<number, number> = new Map();
  private readonly writeHandles: Set<number> = new Set();
  private canFlush = true;

  private readonly _onDidWatchErrorOccur = this._register(new Emitter<string>());
  public readonly onDidErrorOccur = this._onDidWatchErrorOccur.event;

  private readonly _onDidChangeFile = this._register(new Emitter<readonly IFileChange[]>());
  public readonly onDidChangeFile = this._onDidChangeFile.event;

  constructor(
    @ILogService private readonly logService: ILogService,
    private readonly options?: IDiskFileSystemProviderOptions
  ) {
    super();
  }

  public onDidChangeCapabilities: Event<void> = Event.None;

  protected _capabilities: FileSystemProviderCapabilities | undefined;
  public get capabilities(): FileSystemProviderCapabilities {
    if (!this._capabilities) {
      this._capabilities =
        FileSystemProviderCapabilities.FileReadWrite |
        FileSystemProviderCapabilities.FileOpenReadWriteClose |
        FileSystemProviderCapabilities.FileReadStream |
        FileSystemProviderCapabilities.FileFolderCopy;

      if (isLinux) {
        this._capabilities |= FileSystemProviderCapabilities.PathCaseSensitive;
      }
    }

    return this._capabilities;
  }

  public async stat(resource: URI): Promise<IStat> {
    const path = this.toFilePath(resource);

    try {
      const { stat, isSymbolicLink } = await statLink(path);

      return {
        type: this.toType(stat, isSymbolicLink),
        ctime: stat.birthtime.getTime(),
        mtime: stat.mtime.getTime(),
        size: stat.size,
      };
    } catch (error) {
      throw this.toFileSystemProviderError(error);
    }
  }

  public async readdir(resource: URI): Promise<[string, FileType][]> {
    try {
      const children = await readdirWithFileTypes(this.toFilePath(resource));

      const result: [string, FileType][] = [];
      await Promise.all(
        children.map(async child => {
          try {
            let type: FileType;
            if (child.isSymbolicLink()) {
              type = (await this.stat(joinPath(resource, child.name))).type;
            } else {
              type = this.toType(child);
            }

            result.push([child.name, type]);
          } catch (error) {
            this.logService.trace(error);
          }
        })
      );

      return result;
    } catch (error) {
      throw this.toFileSystemProviderError(error);
    }
  }

  public async writeFile(
    resource: URI,
    content: Uint8Array,
    opts: FileWriteOptions
  ): Promise<void> {
    let handle: number | undefined;

    try {
      const filePath = this.toFilePath(resource);

      if (!opts.create || !opts.overwrite) {
        const fileExists = await exists(filePath);
        if (fileExists) {
          if (!opts.overwrite) {
            throw createFileSystemProviderError(
              'File already exists',
              FileSystemProviderErrorCode.FileExists
            );
          }
        } else {
          if (!opts.create) {
            throw createFileSystemProviderError(
              'File does not exist',
              FileSystemProviderErrorCode.FileNotFound
            );
          }
        }
      }

      handle = await this.open(resource, { create: true });

      await this.write(handle, 0, content, 0, content.byteLength);
    } catch (error) {
      throw this.toFileSystemProviderError(error);
    } finally {
      if (typeof handle === 'number') {
        await this.close(handle);
      }
    }
  }

  public async readFile(resource: URI): Promise<Uint8Array> {
    try {
      const filePath = this.toFilePath(resource);

      return await readFile(filePath);
    } catch (error) {
      throw this.toFileSystemProviderError(error);
    }
  }

  public async open(resource: URI, opts: FileOpenOptions): Promise<number> {
    try {
      const filePath = this.toFilePath(resource);

      let flags: string | undefined;

      if (opts.create) {
        if (isWindows && (await exists(filePath))) {
          try {
            await truncate(filePath, 0);

            flags = 'r+';
          } catch (error) {
            this.logService.trace(error);
          }
        }
        if (!flags) {
          flags = 'w';
        }
      } else {
        flags = 'r';
      }

      const handle = await promisify(open)(filePath, flags);

      // http://man7.org/linux/man-pages/man2/open.2.html
      this.mapHandleToPos.set(handle, 0);

      if (opts.create) {
        this.writeHandles.add(handle);
      }

      return handle;
    } catch (error) {
      throw this.toFileSystemProviderError(error);
    }
  }

  public async close(fd: number): Promise<void> {
    try {
      this.mapHandleToPos.delete(fd);

      if (this.writeHandles.delete(fd) && this.canFlush) {
        try {
          await promisify(fdatasync)(fd);
        } catch (error) {
          this.canFlush = false;
          this.logService.error(error);
        }
      }

      return await promisify(close)(fd);
    } catch (error) {
      throw this.toFileSystemProviderError(error);
    }
  }

  public async read(
    fd: number,
    pos: number,
    data: Uint8Array,
    offset: number,
    length: number
  ): Promise<number> {
    const normalizedPos = this.normalizePos(fd, pos);

    let bytesRead: number | null = null;
    try {
      const result = await promisify(read)(fd, data, offset, length, normalizedPos);

      if (typeof result === 'number') {
        bytesRead = result; // node.d.ts fail
      } else {
        bytesRead = result.bytesRead;
      }

      return bytesRead;
    } catch (error) {
      throw this.toFileSystemProviderError(error);
    } finally {
      this.updatePos(fd, normalizedPos, bytesRead);
    }
  }

  public async rename(from: URI, to: URI, opts: FileOverwriteOptions): Promise<void> {
    const fromFilePath = this.toFilePath(from);
    const toFilePath = this.toFilePath(to);

    if (fromFilePath === toFilePath) {
      return;
    }

    try {
      await this.validateTargetDeleted(from, to, 'move', opts.overwrite);

      await move(fromFilePath, toFilePath);
    } catch (error) {
      switch (error.code) {
        case 'EINVAL':
        case 'EBUSY':
        case 'ENAMETOOLONG':
          // eslint-disable-next-line no-ex-assign
          error = new Error(
            `Unable to move ${path.basename(fromFilePath)} into ${path.basename(
              path.dirname(toFilePath)
            )} ${error.toString()}.`
          );
          break;
      }

      throw this.toFileSystemProviderError(error);
    }
  }

  public async copy(from: URI, to: URI, opts: FileOverwriteOptions): Promise<void> {
    const fromFilePath = this.toFilePath(from);
    const toFilePath = this.toFilePath(to);

    if (fromFilePath === toFilePath) {
      return; // simulate node.js behaviour here and do a no-op if paths match
    }

    try {
      // Ensure target does not exist
      await this.validateTargetDeleted(from, to, 'copy', opts.overwrite);
      await copy(fromFilePath, toFilePath);
    } catch (error) {
      switch (error.code) {
        case 'EINVAL':
        case 'EBUSY':
        case 'ENAMETOOLONG':
          // eslint-disable-next-line no-ex-assign
          error = new Error(
            `Unable to move ${path.basename(fromFilePath)} into ${path.basename(
              path.dirname(toFilePath)
            )} ${error.toString()}.`
          );
          break;
      }

      throw this.toFileSystemProviderError(error);
    }
  }

  public async mkdir(resource: URI): Promise<void> {
    try {
      await mkdir(this.toFilePath(resource));
    } catch (error) {
      throw this.toFileSystemProviderError(error);
    }
  }

  public async delete(resource: URI, opts: FileDeleteOptions): Promise<void> {
    try {
      const filePath = this.toFilePath(resource);

      await this.doDelete(filePath, opts);
    } catch (error) {
      throw this.toFileSystemProviderError(error);
    }
  }

  public watch(resource: URI, opts: IWatchOptions): IDisposable {
    if (opts.recursive) {
      // write recursive watcher
    }

    return this.watchNonRecursive(resource); // TODO@ben ideally the same watcher can be used in both cases
  }

  private watchNonRecursive(resource: URI): IDisposable {
    const watcherService = new FileWatcher(
      this.toFilePath(resource),
      changes => this._onDidChangeFile.fire(toFileChanges(changes)),
      msg => {
        if (msg.type === 'error') {
          this._onDidWatchErrorOccur.fire(msg.message);
        }

        this.logService[msg.type](msg.message);
      },
      this.logService.getLevel() === LogLevel.Trace
    );

    const logLevelListener = this.logService.onDidChangeLogLevel(() => {
      watcherService.setVerboseLogging(this.logService.getLevel() === LogLevel.Trace);
    });

    return combinedDisposable(watcherService, logLevelListener);
  }

  protected async doDelete(filePath: string, opts: FileDeleteOptions): Promise<void> {
    if (opts.recursive) {
      await rimraf(filePath, RimRafMode.MOVE);
    } else {
      await unlink(filePath);
    }
  }

  private normalizePos(fd: number, pos: number): number | null {
    if (pos === this.mapHandleToPos.get(fd)) {
      return null;
    }

    return pos;
  }

  private updatePos(fd: number, pos: number | null, bytesLength: number | null): void {
    const lastKnownPos = this.mapHandleToPos.get(fd);
    if (typeof lastKnownPos === 'number') {
      if (typeof pos === 'number') {
        // do not modify the position
      } else if (typeof bytesLength === 'number') {
        this.mapHandleToPos.set(fd, lastKnownPos + bytesLength);
      } else {
        this.mapHandleToPos.delete(fd);
      }
    }
  }

  public async write(
    fd: number,
    pos: number,
    data: Uint8Array,
    offset: number,
    length: number
  ): Promise<number> {
    return retry(
      () => this.doWrite(fd, pos, data, offset, length),
      100 /* ms delay */,
      3 /* retries */
    );
  }

  private async doWrite(
    fd: number,
    pos: number,
    data: Uint8Array,
    offset: number,
    length: number
  ): Promise<number> {
    const normalizedPos = this.normalizePos(fd, pos);

    let bytesWritten: number | null = null;
    try {
      const result = await promisify(write)(fd, data, offset, length, normalizedPos);

      if (typeof result === 'number') {
        bytesWritten = result; // node.d.ts fail
      } else {
        bytesWritten = result.bytesWritten;
      }

      return bytesWritten;
    } catch (error) {
      throw this.toFileSystemProviderError(error);
    } finally {
      this.updatePos(fd, normalizedPos, bytesWritten);
    }
  }

  protected toFilePath(resource: URI): string {
    return path.normalize(resource.path);
  }

  private toType(entry: Stats | Dirent, isSymbolicLink = entry.isSymbolicLink()): FileType {
    if (isSymbolicLink) {
      return FileType.SymbolicLink | (entry.isDirectory() ? FileType.Directory : FileType.File);
    }

    return entry.isFile()
      ? FileType.File
      : entry.isDirectory()
      ? FileType.Directory
      : FileType.Unknown;
  }

  private async validateTargetDeleted(
    from: URI,
    to: URI,
    mode: 'move' | 'copy',
    overwrite?: boolean
  ): Promise<void> {
    const isPathCaseSensitive = !!(
      this.capabilities & FileSystemProviderCapabilities.PathCaseSensitive
    );

    const fromFilePath = this.toFilePath(from);
    const toFilePath = this.toFilePath(to);

    let isSameResourceWithDifferentPathCase = false;
    if (!isPathCaseSensitive) {
      isSameResourceWithDifferentPathCase = isEqual(fromFilePath, toFilePath, true);
    }

    if (isSameResourceWithDifferentPathCase && mode === 'copy') {
      throw createFileSystemProviderError(
        'File cannot be copied to same path with different path case',
        FileSystemProviderErrorCode.FileExists
      );
    }

    if (!isSameResourceWithDifferentPathCase && (await exists(toFilePath))) {
      if (!overwrite) {
        throw createFileSystemProviderError(
          'File at target already exists',
          FileSystemProviderErrorCode.FileExists
        );
      }

      await this.delete(to, { recursive: true, useTrash: false });
    }
  }

  private toFileSystemProviderError(error: NodeJS.ErrnoException): FileSystemProviderError {
    if (error instanceof FileSystemProviderError) {
      return error;
    }

    let code: FileSystemProviderErrorCode;
    switch (error.code) {
      case 'ENOENT':
        code = FileSystemProviderErrorCode.FileNotFound;
        break;
      case 'EISDIR':
        code = FileSystemProviderErrorCode.FileIsADirectory;
        break;
      case 'EEXIST':
        code = FileSystemProviderErrorCode.FileExists;
        break;
      case 'EPERM':
      case 'EACCES':
        code = FileSystemProviderErrorCode.NoPermissions;
        break;
      default:
        code = FileSystemProviderErrorCode.Unknown;
        break;
    }

    return createFileSystemProviderError(error, code);
  }
}
