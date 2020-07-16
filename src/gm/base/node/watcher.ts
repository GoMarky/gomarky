import * as fs from 'fs';
import { dispose, IDisposable, toDisposable } from '@/gm/base/common/lifecycle';
import { exists, readdir } from '@/gm/base/node/pfs';

import { CHANGE_BUFFER_DELAY } from '@/gm/platform/files/node/watcher/watcherService';
import { basename, join } from 'path';
import { normalizeNFC } from '@/gm/base/common/normalize';

import { isMacintosh } from '@/gm/base/platform';

type TWatcherChangeFileCallback = (
  type: 'add' | 'addDir' | 'change' | 'unlink' | 'unlinkDir',
  path: string
) => void;
// type TWatcherChangeFolderCallback = (type: 'added' | 'changed' | 'deleted', path: string) => void;
type TWatcherErrorCallback = (error: string) => void;

export function watchFile(
  path: string,
  onChange: (type: 'added' | 'changed' | 'deleted', path: string) => void,
  onError: (error: string) => void
): IDisposable {
  return doWatchNonRecursive({ path, isDirectory: false }, onChange, onError);
}

export function watchFolder(
  path: string,
  onChange: (type: 'added' | 'changed' | 'deleted', path: string) => void,
  onError: (error: string) => void
): IDisposable {
  return doWatchNonRecursive({ path, isDirectory: true }, onChange, onError);
}

function doWatchNonRecursive(
  file: { path: string; isDirectory: boolean },
  onChange: (type: 'added' | 'changed' | 'deleted', path: string) => void,
  onError: (error: string) => void
): IDisposable {
  const originalFileName = basename(file.path);
  const mapPathToStatDisposable = new Map<string, IDisposable>();

  let disposed = false;
  let watcherDisposables: IDisposable[] = [
    toDisposable(() => {
      mapPathToStatDisposable.forEach(disposable => dispose(disposable));
      mapPathToStatDisposable.clear();
    }),
  ];

  try {
    // Creating watcher can fail with an exception
    const watcher = fs.watch(file.path);
    watcherDisposables.push(
      toDisposable(() => {
        watcher.removeAllListeners();
        watcher.close();
      })
    );

    // Folder: resolve children to emit proper events
    const folderChildren: Set<string> = new Set<string>();
    if (file.isDirectory) {
      readdir(file.path).then(children => children.forEach(child => folderChildren.add(child)));
    }

    watcher.on('error', (code: number, signal: string) => {
      if (!disposed) {
        onError(`Failed to watch ${file.path} for changes using fs.watch() (${code}, ${signal})`);
      }
    });

    watcher.on('change', (type, raw) => {
      if (disposed) {
        return;
      }

      let changedFileName = '';
      if (raw) {
        changedFileName = raw.toString();
        if (isMacintosh) {
          changedFileName = normalizeNFC(changedFileName);
        }
      }

      if (!changedFileName || (type !== 'change' && type !== 'rename')) {
        return; // ignore unexpected events
      }

      const changedFilePath = file.isDirectory ? join(file.path, changedFileName) : file.path;

      // File
      if (!file.isDirectory) {
        if (type === 'rename' || changedFileName !== originalFileName) {
          const timeoutHandle = setTimeout(async () => {
            const fileExists = await exists(changedFilePath);

            if (disposed) {
              return;
            }

            if (fileExists) {
              onChange('changed', changedFilePath);

              watcherDisposables = [doWatchNonRecursive(file, onChange, onError)];
            } else {
              onChange('deleted', changedFilePath);
            }
          }, CHANGE_BUFFER_DELAY);

          dispose(watcherDisposables);
          watcherDisposables = [toDisposable(() => clearTimeout(timeoutHandle))];
        } else {
          onChange('changed', changedFilePath);
        }
      } else {
        if (type === 'rename') {
          const statDisposable = mapPathToStatDisposable.get(changedFilePath);
          if (statDisposable) {
            dispose(statDisposable);
          }

          const timeoutHandle = setTimeout(async () => {
            mapPathToStatDisposable.delete(changedFilePath);

            const fileExists = await exists(changedFilePath);

            if (disposed) {
              return;
            }

            let type: 'added' | 'deleted' | 'changed';
            if (fileExists) {
              if (folderChildren.has(changedFileName)) {
                type = 'changed';
              } else {
                type = 'added';
                folderChildren.add(changedFileName);
              }
            } else {
              folderChildren.delete(changedFileName);
              type = 'deleted';
            }

            onChange(type, changedFilePath);
          }, CHANGE_BUFFER_DELAY);

          mapPathToStatDisposable.set(
            changedFilePath,
            toDisposable(() => clearTimeout(timeoutHandle))
          );
        } else {
          let type: 'added' | 'changed';
          if (folderChildren.has(changedFileName)) {
            type = 'changed';
          } else {
            type = 'added';
            folderChildren.add(changedFileName);
          }

          onChange(type, changedFilePath);
        }
      }
    });
  } catch (error) {
    exists(file.path).then(exists => {
      if (exists && !disposed) {
        onError(`Failed to watch ${file.path} for changes using fs.watch() (${error.toString()})`);
      }
    });
  }

  return toDisposable(() => {
    disposed = true;

    watcherDisposables = dispose(watcherDisposables);
  });
}

interface IDoWatchOptions {
  path: string;
  isDirectory: boolean;
}

function doWatch(
  file: IDoWatchOptions,
  onChange: TWatcherChangeFileCallback,
  onError: TWatcherErrorCallback
): void {
  try {
    const watcher: fs.FSWatcher = fs.watch(file.path);

    watcher.on('error', (code: number, signal: string) => {
      onError(`Failed to watch ${file.path} for changes using fs.watch() [${code}, ${signal}]`);
    });

    watcher.on(
      'change',
      (type: 'add' | 'addDir' | 'change' | 'unlink' | 'unlinkDir', raw: string) => {
        onChange(type, raw);
      }
    );
  } catch (error) {
    onError(`Failed to watch ${file.path} for changes using fs.watch() (${error.toString()})`);
  }
}
