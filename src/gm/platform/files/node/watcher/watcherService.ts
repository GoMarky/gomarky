import { Disposable } from '@/gm/base/common/lifecycle';
import { watchFile, watchFolder } from '@/gm/base/node/watcher';
import { statLink } from '@/gm/base/node/pfs';

import { ThrottledDelayer } from '@/gm/base/common/async';
import { FileChangeType, IFileChange, isParent } from '@/gm/platform/files/common/files';
import { realpath } from '@/gm/base/common/extpath';

import { basename, join } from 'path';
import { isLinux } from '@/gm/base/platform';
import { URI } from '@/gm/base/common/uri';

export const CHANGE_BUFFER_DELAY = 100;

export interface IDiskFileChange {
  type: FileChangeType;
  path: string;
}

export interface ILogMessage {
  type: 'trace' | 'warn' | 'error';
  message: string;
}

export class FileWatcher extends Disposable {
  private isDisposed: boolean | undefined;

  private fileChangesDelayer: ThrottledDelayer<void> = this._register(
    new ThrottledDelayer<void>(CHANGE_BUFFER_DELAY * 2)
  );
  private fileChangesBuffer: IDiskFileChange[] = [];

  constructor(
    private path: string,
    private onFileChanges: (changes: IDiskFileChange[]) => void,
    private onLogMessage: (msg: ILogMessage) => void,
    private verboseLogging: boolean
  ) {
    super();

    this.startWatching();
  }

  public setVerboseLogging(verboseLogging: boolean): void {
    this.verboseLogging = verboseLogging;
  }

  private async startWatching(): Promise<void> {
    try {
      const { stat, isSymbolicLink } = await statLink(this.path);

      if (this.isDisposed) {
        return;
      }

      let pathToWatch = this.path;
      if (isSymbolicLink) {
        try {
          pathToWatch = await realpath(pathToWatch);
        } catch (error) {
          this.onError(error);
        }
      }

      // Watch Folder
      if (stat.isDirectory()) {
        this._register(
          watchFolder(
            pathToWatch,
            (eventType, path) => {
              this.onFileChange({
                type:
                  eventType === 'changed'
                    ? FileChangeType.UPDATED
                    : eventType === 'added'
                    ? FileChangeType.ADDED
                    : FileChangeType.DELETED,
                path: join(this.path, basename(path)),
              });
            },
            error => this.onError(error)
          )
        );
      } else {
        this._register(
          watchFile(
            pathToWatch,
            eventType => {
              this.onFileChange({
                type: eventType === 'changed' ? FileChangeType.UPDATED : FileChangeType.DELETED,
                path: this.path,
              });
            },
            error => this.onError(error)
          )
        );
      }
    } catch (error) {
      this.onError(error);
    }
  }

  private onFileChange(event: IDiskFileChange): void {
    // Add to buffer
    this.fileChangesBuffer.push(event);

    // Logging
    if (this.verboseLogging) {
      this.onVerbose(
        `${
          event.type === FileChangeType.ADDED
            ? '[ADDED]'
            : event.type === FileChangeType.DELETED
            ? '[DELETED]'
            : '[CHANGED]'
        } ${event.path}`
      );
    }

    // Handle emit through delayer to accommodate for bulk changes and thus reduce spam
    this.fileChangesDelayer.trigger(() => {
      const fileChanges = this.fileChangesBuffer;
      this.fileChangesBuffer = [];

      // Event normalization
      const normalizedFileChanges = normalizeFileChanges(fileChanges);

      // Logging
      if (this.verboseLogging) {
        normalizedFileChanges.forEach(event => {
          this.onVerbose(
            `>> normalized ${
              event.type === FileChangeType.ADDED
                ? '[ADDED]'
                : event.type === FileChangeType.DELETED
                ? '[DELETED]'
                : '[CHANGED]'
            } ${event.path}`
          );
        });
      }

      // Fire
      if (normalizedFileChanges.length > 0) {
        this.onFileChanges(normalizedFileChanges);
      }

      return Promise.resolve();
    });
  }

  private onError(error: string): void {
    if (!this.isDisposed) {
      this.onLogMessage({ type: 'error', message: `[File Watcher (node.js)] ${error}` });
    }
  }

  private onVerbose(message: string): void {
    if (!this.isDisposed) {
      this.onLogMessage({ type: 'trace', message: `[File Watcher (node.js)] ${message}` });
    }
  }

  dispose(): void {
    this.isDisposed = true;

    super.dispose();
  }
}

export function normalizeFileChanges(changes: IDiskFileChange[]): IDiskFileChange[] {
  // Build deltas
  const normalizer = new EventNormalizer();
  for (const event of changes) {
    normalizer.processEvent(event);
  }

  return normalizer.normalize();
}

class EventNormalizer {
  private normalized: IDiskFileChange[] = [];
  private mapPathToChange: Map<string, IDiskFileChange> = new Map();

  processEvent(event: IDiskFileChange): void {
    const existingEvent = this.mapPathToChange.get(event.path);

    if (existingEvent) {
      const currentChangeType = existingEvent.type;
      const newChangeType = event.type;

      if (currentChangeType === FileChangeType.ADDED && newChangeType === FileChangeType.DELETED) {
        this.mapPathToChange.delete(event.path);
        this.normalized.splice(this.normalized.indexOf(existingEvent), 1);
      } else if (
        currentChangeType === FileChangeType.DELETED &&
        newChangeType === FileChangeType.ADDED
      ) {
        existingEvent.type = FileChangeType.UPDATED;
        // tslint:disable-next-line:no-empty
      } else if (
        currentChangeType === FileChangeType.ADDED &&
        newChangeType === FileChangeType.UPDATED
      ) {
      } else {
        existingEvent.type = newChangeType;
      }
    } else {
      this.normalized.push(event);
      this.mapPathToChange.set(event.path, event);
    }
  }

  normalize(): IDiskFileChange[] {
    const addedChangeEvents: IDiskFileChange[] = [];
    const deletedPaths: string[] = [];

    return this.normalized
      .filter(e => {
        if (e.type !== FileChangeType.DELETED) {
          addedChangeEvents.push(e);

          return false;
        }

        return true;
      })
      .sort((e1, e2) => {
        return e1.path.length - e2.path.length;
      })
      .filter(e => {
        if (deletedPaths.some(d => isParent(e.path, d, !isLinux))) {
          return false;
        }

        deletedPaths.push(e.path);

        return true;
      })
      .concat(addedChangeEvents);
  }
}

export function toFileChanges(changes: IDiskFileChange[]): IFileChange[] {
  return changes.map(change => ({
    type: change.type,
    resource: URI.file(change.path),
  }));
}
