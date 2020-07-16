import {
  basename,
  dirname,
  isAbsolutePath,
  isEqual,
  isEqualOrParent,
  joinPath,
  URI,
} from '@/gm/base/common/uri';
import {
  ensureFileSystemProviderError,
  FileChangesEvent,
  FileOperation,
  FileOperationEvent,
  FileSystemProviderCapabilities,
  FileSystemProviderErrorCode,
  FileType,
  hasFileFolderCopyCapability,
  hasFileReadStreamCapability,
  hasOpenReadWriteCloseCapability,
  hasReadWriteCapability,
  ICreateFileOptions,
  IFileContent,
  IFileService,
  IFileStat,
  IFileStatWithMetadata,
  IFileStreamContent,
  IFileSystemProvider,
  IFileSystemProviderActivationEvent,
  IFileSystemProviderCapabilitiesChangeEvent,
  IFileSystemProviderRegistrationEvent,
  IFileSystemProviderWithFileReadStreamCapability,
  IFileSystemProviderWithFileReadWriteCapability,
  IFileSystemProviderWithOpenReadWriteCloseCapability,
  IReadFileOptions,
  IResolveFileOptions,
  IResolveMetadataFileOptions,
  IStat,
  IWatchOptions,
  toFileOperationResult,
  toFileSystemProviderErrorCode,
} from '@/gm/platform/files/common/files';

import {
  Disposable,
  DisposableStore,
  dispose,
  IDisposable,
  toDisposable,
} from '@/gm/base/common/lifecycle';
import { ILogService } from '@/gm/platform/log/common/log';
import { Emitter, Event } from '@/gm/base/common/event';

import { isUndefinedOrNull } from '@/gm/base/common/types';

import { Queue } from '@/gm/base/common/async';

import { Schemas } from '@/gm/base/common/network';
import { etag, getBaseLabel } from '@/gm/base/common/string';
import { coalesce } from '@/gm/base/common/arrays';

import { CancellationToken, CancellationTokenSource } from '@/gm/base/common/cancellation';
import { TernarySearchTree } from '@/gm/base/common/map';


export interface IWriteFileOptions {
  readonly mtime?: number;
  readonly etag?: string;
}

export const enum FileOperationResult {
  FILE_IS_DIRECTORY,
  FILE_NOT_FOUND,
  FILE_NOT_MODIFIED_SINCE,
  FILE_MODIFIED_SINCE,
  FILE_MOVE_CONFLICT,
  FILE_READ_ONLY,
  FILE_PERMISSION_DENIED,
  FILE_TOO_LARGE,
  FILE_INVALID_PATH,
  FILE_EXCEEDS_MEMORY_LIMIT,
  FILE_OTHER_ERROR,
}

export class FileOperationError extends Error {
  public readonly name = 'FileOperationError';

  constructor(
    message: string,
    public fileOperationResult: FileOperationResult,
    public options?: IReadFileOptions & IWriteFileOptions & ICreateFileOptions
  ) {
    super(message);
  }

  public static isFileOperationError(obj: unknown): obj is FileOperationError {
    return (
      obj instanceof Error && !isUndefinedOrNull((obj as FileOperationError).fileOperationResult)
    );
  }
}

export class FileService extends Disposable implements IFileService {
  private readonly BUFFER_SIZE = 64 * 1024;

  public readonly serviceBrand = IFileService;

  constructor(@ILogService private readonly logService: ILogService) {
    super();
  }

  private readonly _onDidChangeFileSystemProviderRegistrations = this._register(
    new Emitter<IFileSystemProviderRegistrationEvent>()
  );
  public readonly onDidChangeFileSystemProviderRegistrations = this
    ._onDidChangeFileSystemProviderRegistrations.event;

  private readonly _onWillActivateFileSystemProvider = this._register(
    new Emitter<IFileSystemProviderActivationEvent>()
  );
  public readonly onWillActivateFileSystemProvider = this._onWillActivateFileSystemProvider.event;

  private readonly _onDidChangeFileSystemProviderCapabilities = this._register(
    new Emitter<IFileSystemProviderCapabilitiesChangeEvent>()
  );
  public readonly onDidChangeFileSystemProviderCapabilities = this
    ._onDidChangeFileSystemProviderCapabilities.event;

  private readonly provider = new Map<string, IFileSystemProvider>();

  public registerProvider(scheme: string, provider: IFileSystemProvider): IDisposable {
    if (this.provider.has(scheme)) {
      throw new Error(`A filesystem provider for the scheme '${scheme}' is already registered.`);
    }

    this.provider.set(scheme, provider);
    this._onDidChangeFileSystemProviderRegistrations.fire({ added: true, scheme, provider });

    const providerDisposables = new DisposableStore();
    providerDisposables.add(
      provider.onDidChangeFile(changes => this._onFileChanges.fire(new FileChangesEvent(changes)))
    );
    providerDisposables.add(
      provider.onDidChangeCapabilities(() =>
        this._onDidChangeFileSystemProviderCapabilities.fire({ provider, scheme })
      )
    );
    if (typeof provider.onDidErrorOccur === 'function') {
      providerDisposables.add(
        provider.onDidErrorOccur(error => this._onError.fire(new Error(error)))
      );
    }

    return toDisposable(() => {
      this._onDidChangeFileSystemProviderRegistrations.fire({ added: false, scheme, provider });
      this.provider.delete(scheme);

      dispose(providerDisposables);
    });
  }

  public async activateProvider(scheme: string): Promise<void> {
    const joiners: Promise<void>[] = [];
    this._onWillActivateFileSystemProvider.fire({
      scheme,
      join(promise) {
        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        if (promise) {
          joiners.push(promise);
        }
      },
    });

    if (this.provider.has(scheme)) {
      return;
    }
    await Promise.all(joiners);
  }

  public canHandleResource(resource: URI): boolean {
    return this.provider.has(resource.scheme);
  }

  public hasCapability(resource: URI, capability: FileSystemProviderCapabilities): boolean {
    const provider = this.provider.get(resource.scheme);

    return !!(provider && provider.capabilities & capability);
  }

  public async resolve(
    resource: URI,
    options: IResolveMetadataFileOptions
  ): Promise<IFileStatWithMetadata>;
  public async resolve(resource: URI, options?: IResolveFileOptions): Promise<IFileStat>;
  public async resolve(resource: URI, options?: IResolveFileOptions): Promise<IFileStat> {
    try {
      return await this.doResolveFile(resource, options);
    } catch (error) {
      if (toFileSystemProviderErrorCode(error) === FileSystemProviderErrorCode.FileNotFound) {
        throw new FileOperationError(
          `Unable to resolve non-existing file ${this.resourceForError(resource)}`,
          FileOperationResult.FILE_NOT_FOUND
        );
      }

      throw ensureFileSystemProviderError(error);
    }
  }

  private async doResolveFile(
    resource: URI,
    options: IResolveMetadataFileOptions
  ): Promise<IFileStatWithMetadata>;
  private async doResolveFile(resource: URI, options?: IResolveFileOptions): Promise<IFileStat>;
  private async doResolveFile(resource: URI, options?: IResolveFileOptions): Promise<IFileStat> {
    const provider = await this.withProvider(resource);

    const resolveTo = options?.resolveTo;
    const resolveSingleChildDescendants = options?.resolveSingleChildDescendants;
    const resolveMetadata = options?.resolveMetadata;

    const stat = await provider.stat(resource);

    let trie: TernarySearchTree<boolean> | undefined;

    return this.toFileStat(
      provider,
      resource,
      stat,
      undefined,
      !!resolveMetadata,
      (stats, siblings) => {
        if (!trie) {
          trie = TernarySearchTree.forPaths<true>();
          trie.set(resource.toString(), true);
          if (resolveTo?.length) {
            resolveTo.forEach(uri => trie?.set(uri.toString(), true));
          }
        }

        if (trie.findSuperstr(stats.resource.toString()) || trie.get(stats.resource.toString())) {
          return true;
        }

        if (stats.isDirectory) {
          return siblings === 1;
        }

        return false;
      }
    );
  }

  private async toFileStat(
    provider: IFileSystemProvider,
    resource: URI,
    stat: IStat | ({ type: FileType } & Partial<IStat>),
    siblings: number | undefined,
    resolveMetadata: boolean,
    recurse: (stat: IFileStat, siblings?: number) => boolean
  ): Promise<IFileStat>;
  private async toFileStat(
    provider: IFileSystemProvider,
    resource: URI,
    stat: IStat,
    siblings: number | undefined,
    resolveMetadata: true,
    recurse: (stat: IFileStat, siblings?: number) => boolean
  ): Promise<IFileStatWithMetadata>;
  private async toFileStat(
    provider: IFileSystemProvider,
    resource: URI,
    stat: IStat | ({ type: FileType } & Partial<IStat>),
    siblings: number | undefined,
    resolveMetadata: boolean,
    recurse: (stat: IFileStat, siblings?: number) => boolean
  ): Promise<IFileStat> {
    const _resource = URI.file(resource.path);

    const fileStat: IFileStat = {
      resource: _resource,
      name: getBaseLabel(_resource),
      isFile: (stat.type & FileType.File) !== 0,
      isDirectory: (stat.type & FileType.Directory) !== 0,
      isSymbolicLink: (stat.type & FileType.SymbolicLink) !== 0,
      mtime: stat.mtime,
      ctime: stat.ctime,
      size: stat.size,
      etag: etag({ mtime: stat.mtime, size: stat.size }),
    };

    if (fileStat.isDirectory && recurse(fileStat, siblings)) {
      try {
        const entries = await provider.readdir(_resource);

        const resolvedEntries = await Promise.all(
          entries.map(async ([name, type]) => {
            try {
              const childResource = joinPath(_resource, name);

              const childStat = resolveMetadata ? await provider.stat(childResource) : { type };

              return this.toFileStat(
                provider,
                childResource,
                childStat,
                entries.length,
                resolveMetadata,
                recurse
              );
            } catch (error) {
              this.logService.error(error);

              return null;
            }
          })
        );

        fileStat.children = coalesce(resolvedEntries);
      } catch (error) {
        this.logService.error(error);

        fileStat.children = [];
      }

      return fileStat;
    }

    return fileStat;
  }

  protected async withProvider(resource: URI): Promise<IFileSystemProvider> {
    if (!isAbsolutePath(resource)) {
      throw new FileOperationError(
        `Unable to resolve filesystem provider with relative file ${this.resourceForError(
          resource
        )}`,
        FileOperationResult.FILE_INVALID_PATH
      );
    }

    await this.activateProvider(resource.scheme);

    const provider = this.provider.get(resource.scheme);
    if (!provider) {
      const error = new Error();
      error.name = 'ENOPRO';
      error.message = 'No provided found';
      throw error;
    }

    return provider;
  }

  private async withReadProvider(
    resource: URI
  ): Promise<
    | IFileSystemProviderWithFileReadWriteCapability
    | IFileSystemProviderWithOpenReadWriteCloseCapability
    | IFileSystemProviderWithFileReadStreamCapability
  > {
    const provider = await this.withProvider(resource);

    if (
      hasOpenReadWriteCloseCapability(provider) ||
      hasReadWriteCapability(provider) ||
      hasFileReadStreamCapability(provider)
    ) {
      return provider;
    }

    throw new Error(
      `Filesystem provider for scheme '${resource.scheme}' neither has FileReadWrite, FileReadStream nor FileOpenReadWriteClose capability which is needed for the read operation.`
    );
  }

  private async withWriteProvider(
    resource: URI
  ): Promise<
    | IFileSystemProviderWithFileReadWriteCapability
    | IFileSystemProviderWithOpenReadWriteCloseCapability
  > {
    const provider = await this.withProvider(resource);

    if (hasOpenReadWriteCloseCapability(provider) || hasReadWriteCapability(provider)) {
      return provider;
    }

    throw new Error(
      `Filesystem provider for scheme '${resource.scheme}' neither has FileReadWrite nor FileOpenReadWriteClose capability which is needed for the write operation.`
    );
  }

  public readonly _onAfterOperation: Emitter<FileOperationEvent> = this._register(
    new Emitter<FileOperationEvent>()
  );
  public readonly onAfterOperation: Event<FileOperationEvent> = this._onAfterOperation.event;

  private readonly _onError: Emitter<Error> = this._register(new Emitter<Error>());
  public readonly onError: Event<Error> = this._onError.event;

  public async exists(resource: URI): Promise<boolean> {
    const provider = await this.withProvider(resource);

    try {
      const stat = await provider.stat(resource);

      return !!stat;
    } catch (error) {
      return false;
    }
  }

  private async validateWriteFile(
    provider: IFileSystemProvider,
    resource: URI,
    options?: IWriteFileOptions
  ): Promise<IStat | undefined> {
    let stat: IStat | undefined;

    try {
      stat = await provider.stat(resource);
    } catch (error) {
      return undefined;
    }

    if ((stat.type & FileType.Directory) !== 0) {
      throw new FileOperationError(
        `Unable to write file ${this.resourceForError(resource)} that is actually a directory`,
        FileOperationResult.FILE_IS_DIRECTORY,
        options
      );
    }

    if (
      options &&
      typeof options.mtime === 'number' &&
      typeof options.etag === 'string' &&
      options.etag !== '' &&
      typeof stat.mtime === 'number' &&
      typeof stat.size === 'number' &&
      options.mtime < stat.mtime &&
      options.etag !== etag({ mtime: options.mtime, size: stat.size })
    ) {
      throw new FileOperationError(
        'File Modified Since',
        FileOperationResult.FILE_MODIFIED_SINCE,
        options
      );
    }

    return stat;
  }

  private readFileStreamed(
    provider: IFileSystemProviderWithFileReadStreamCapability,
    resource: URI,
    token: CancellationToken,
    options: IReadFileOptions = Object.create(null)
  ): ReadableStream {
    const fileStream = provider.readFileStream(resource, options, token);

    return fileStream;
  }

  private async validateReadFile(
    resource: URI,
    options?: IReadFileOptions
  ): Promise<IFileStatWithMetadata> {
    const stat = await this.resolve(resource, { resolveMetadata: true });

    if (stat.isDirectory) {
      throw new FileOperationError(
        `Unable to read file  that is actually a directory ${this.resourceForError(resource)}`,
        FileOperationResult.FILE_IS_DIRECTORY,
        options
      );
    }

    if (
      options &&
      typeof options.etag === 'string' &&
      options.etag !== '' &&
      options.etag === stat.etag
    ) {
      throw new FileOperationError(
        'File not modified since',
        FileOperationResult.FILE_NOT_MODIFIED_SINCE,
        options
      );
    }

    this.validateReadFileLimits(resource, stat.size, options);

    return stat;
  }

  private validateReadFileLimits(resource: URI, size: number, options?: IReadFileOptions): void {
    if (options?.limits) {
      let tooLargeErrorResult: FileOperationResult | undefined;

      if (typeof options.limits.memory === 'number' && size > options.limits.memory) {
        tooLargeErrorResult = FileOperationResult.FILE_EXCEEDS_MEMORY_LIMIT;
      }

      if (typeof options.limits.size === 'number' && size > options.limits.size) {
        tooLargeErrorResult = FileOperationResult.FILE_TOO_LARGE;
      }

      if (typeof tooLargeErrorResult === 'number') {
        throw new FileOperationError(
          `Unable to read file ${this.resourceForError(resource)} that is too large to open`,
          tooLargeErrorResult
        );
      }
    }
  }

  public async move(source: URI, target: URI, overwrite?: boolean): Promise<IFileStatWithMetadata> {
    const sourceProvider = this.throwIfFileSystemIsReadonly(
      await this.withWriteProvider(source),
      source
    );
    const targetProvider = this.throwIfFileSystemIsReadonly(
      await this.withWriteProvider(target),
      target
    );

    const mode = await this.doMoveCopy(
      sourceProvider,
      source,
      targetProvider,
      target,
      'move',
      !!overwrite
    );

    const fileStat = await this.resolve(target, { resolveMetadata: true });
    this._onAfterOperation.fire(
      new FileOperationEvent(
        source,
        mode === 'move' ? FileOperation.MOVE : FileOperation.COPY,
        fileStat
      )
    );

    return fileStat;
  }

  public async copy(source: URI, target: URI, overwrite?: boolean): Promise<IFileStatWithMetadata> {
    const sourceProvider = await this.withReadProvider(source);
    const targetProvider = this.throwIfFileSystemIsReadonly(
      await this.withWriteProvider(target),
      target
    );

    const mode = await this.doMoveCopy(
      sourceProvider,
      source,
      targetProvider,
      target,
      'copy',
      !!overwrite
    );

    const fileStat = await this.resolve(target, { resolveMetadata: true });
    this._onAfterOperation.fire(
      new FileOperationEvent(
        source,
        mode === 'copy' ? FileOperation.COPY : FileOperation.MOVE,
        fileStat
      )
    );

    return fileStat;
  }

  private async doMoveCopy(
    sourceProvider: IFileSystemProvider,
    source: URI,
    targetProvider: IFileSystemProvider,
    target: URI,
    mode: 'move' | 'copy',
    overwrite: boolean
  ): Promise<'move' | 'copy'> {
    if (source.toString2() === target.toString2()) {
      return mode;
    }

    const { exists, isSameResourceWithDifferentPathCase } = await this.doValidateMoveCopy(
      sourceProvider,
      source,
      targetProvider,
      target,
      mode,
      overwrite
    );

    if (exists && !isSameResourceWithDifferentPathCase && overwrite) {
      await this.del(target, { recursive: true });
    }

    await this.mkdirp(targetProvider, dirname(target));

    if (mode === 'copy') {
      if (sourceProvider === targetProvider && hasFileFolderCopyCapability(sourceProvider)) {
        await sourceProvider.copy(source, target, { overwrite });
      } else {
        const sourceFile = await this.resolve(source);
        if (sourceFile.isDirectory) {
          await this.doCopyFolder(sourceProvider, sourceFile, targetProvider, target);
        } else {
          //
        }
      }

      return mode;
    } else {
      if (sourceProvider === targetProvider) {
        await sourceProvider.rename(source, target, { overwrite });

        return mode;
      } else {
        await this.doMoveCopy(sourceProvider, source, targetProvider, target, 'copy', overwrite);

        await this.del(source, { recursive: true });

        return 'copy';
      }
    }
  }

  private async doCopyFolder(
    sourceProvider: IFileSystemProvider,
    sourceFolder: IFileStat,
    targetProvider: IFileSystemProvider,
    targetFolder: URI
  ): Promise<void> {
    await targetProvider.mkdir(targetFolder);

    if (Array.isArray(sourceFolder.children)) {
      await Promise.all(
        sourceFolder.children.map(async sourceChild => {
          const targetChild = joinPath(targetFolder, sourceChild.name);
          if (sourceChild.isDirectory) {
            return this.doCopyFolder(
              sourceProvider,
              await this.resolve(sourceChild.resource),
              targetProvider,
              targetChild
            );
          }
        })
      );
    }
  }

  private async doValidateMoveCopy(
    sourceProvider: IFileSystemProvider,
    source: URI,
    targetProvider: IFileSystemProvider,
    target: URI,
    mode: 'move' | 'copy',
    overwrite?: boolean
  ): Promise<{ exists: boolean; isSameResourceWithDifferentPathCase: boolean }> {
    let isSameResourceWithDifferentPathCase = false;

    if (sourceProvider === targetProvider) {
      const isPathCaseSensitive = !!(
        sourceProvider.capabilities & FileSystemProviderCapabilities.PathCaseSensitive
      );
      if (!isPathCaseSensitive) {
        isSameResourceWithDifferentPathCase = isEqual(source, target, true);
      }

      if (isSameResourceWithDifferentPathCase && mode === 'copy') {
        throw new Error(
          `Unable to copy when source ${this.resourceForError(
            source
          )} is same as target ${this.resourceForError(
            target
          )} with different path case on a case insensitive file system`
        );
      }

      if (
        !isSameResourceWithDifferentPathCase &&
        isEqualOrParent(target, source, !isPathCaseSensitive)
      ) {
        throw new Error(
          `Unable to move/copy when source ${this.resourceForError(
            target
          )} is parent of target ${this.resourceForError(target)}.`
        );
      }
    }

    const exists = await this.exists(target);
    if (exists && !isSameResourceWithDifferentPathCase) {
      if (!overwrite) {
        throw new FileOperationError(
          `Unable to move/copy ${this.resourceForError(
            source
          )} because target ${this.resourceForError(target)} already exists at destination.`,
          FileOperationResult.FILE_MOVE_CONFLICT
        );
      }

      if (sourceProvider === targetProvider) {
        const isPathCaseSensitive = !!(
          sourceProvider.capabilities & FileSystemProviderCapabilities.PathCaseSensitive
        );
        if (isEqualOrParent(source, target, !isPathCaseSensitive)) {
          throw new Error(
            `Unable to move/copy ${this.resourceForError(source)} into ${this.resourceForError(
              target
            )} since a file would replace the folder it is contained in.`
          );
        }
      }
    }

    return { exists, isSameResourceWithDifferentPathCase };
  }

  public async createFolder(resource: URI): Promise<IFileStatWithMetadata> {
    const provider = this.throwIfFileSystemIsReadonly(await this.withProvider(resource), resource);

    await this.mkdirp(provider, resource);

    const fileStat = await this.resolve(resource, { resolveMetadata: true });
    this._onAfterOperation.fire(new FileOperationEvent(resource, FileOperation.CREATE, fileStat));

    return fileStat;
  }

  private async mkdirp(provider: IFileSystemProvider, directory: URI): Promise<void> {
    const directoriesToCreate: string[] = [];

    while (!isEqual(directory, dirname(directory))) {
      try {
        const stat = await provider.stat(directory);
        if ((stat.type & FileType.Directory) === 0) {
          throw new Error(
            `Unable to create folder ${this.resourceForError(
              directory
            )} that already exists but is not a directory`
          );
        }

        break;
      } catch (error) {
        if (toFileSystemProviderErrorCode(error) !== FileSystemProviderErrorCode.FileNotFound) {
          throw error;
        }
        directoriesToCreate.push(basename(directory));

        directory = dirname(directory);
      }
    }

    for (let i = directoriesToCreate.length - 1; i >= 0; i--) {
      directory = joinPath(directory, directoriesToCreate[i]);
      await provider.mkdir(directory);
    }
  }

  public async del(resource: URI, options?: { useTrash?: boolean; recursive?: boolean }): Promise<void> {
    const provider = this.throwIfFileSystemIsReadonly(await this.withProvider(resource), resource);

    const useTrash = !!options?.useTrash;
    if (useTrash && !(provider.capabilities & FileSystemProviderCapabilities.Trash)) {
      throw new Error(
        `Unable to delete file ${this.resourceForError(
          resource
        )} via trash because provider does not support it.`
      );
    }

    const exists = await this.exists(resource);
    if (!exists) {
      throw new FileOperationError(
        `Unable to delete non-existing file ${this.resourceForError(resource)}`,
        FileOperationResult.FILE_NOT_FOUND
      );
    }

    const recursive = !!options?.recursive;
    if (!recursive && exists) {
      const stat = await this.resolve(resource);
      if (stat.isDirectory && Array.isArray(stat.children) && stat.children.length > 0) {
        throw new Error(`Unable to delete non-empty folder ${this.resourceForError(resource)}.`);
      }
    }

    await provider.delete(resource, { recursive, useTrash });
    this._onAfterOperation.fire(new FileOperationEvent(resource, FileOperation.DELETE));
  }

  private readonly _onFileChanges: Emitter<FileChangesEvent> = this._register(
    new Emitter<FileChangesEvent>()
  );
  public readonly onFileChanges: Event<FileChangesEvent> = this._onFileChanges.event;

  private readonly activeWatchers = new Map<string, { disposable: IDisposable; count: number }>();

  public watch(
    resource: URI,
    options: IWatchOptions = { recursive: false, excludes: [] }
  ): IDisposable {
    let watchDisposed = false;
    let watchDisposable = toDisposable(() => (watchDisposed = true));

    this.doWatch(resource, options).then(
      disposable => {
        if (watchDisposed) {
          dispose(disposable);
        } else {
          watchDisposable = disposable;
        }
      },
      error => this.logService.error(error)
    );

    return toDisposable(() => dispose(watchDisposable));
  }

  private async doWatch(resource: URI, options: IWatchOptions): Promise<IDisposable> {
    const provider = await this.withProvider(resource);
    const key = this.toWatchKey(provider, resource, options);

    // Only start watching if we are the first for the given key
    const watcher = this.activeWatchers.get(key) || {
      count: 0,
      disposable: provider.watch(resource, options),
    };
    if (!this.activeWatchers.has(key)) {
      this.activeWatchers.set(key, watcher);
    }

    // Increment usage counter
    watcher.count += 1;

    return toDisposable(() => {
      // Unref
      watcher.count--;

      // Dispose only when last user is reached
      if (watcher.count === 0) {
        dispose(watcher.disposable);
        this.activeWatchers.delete(key);
      }
    });
  }

  private toWatchKey(provider: IFileSystemProvider, resource: URI, options: IWatchOptions): string {
    return [
      this.toMapKey(provider, resource),
      String(options.recursive),
      options.excludes.join(),
    ].join();
  }

  public dispose(): void {
    super.dispose();

    this.activeWatchers.forEach(watcher => dispose(watcher.disposable));
    this.activeWatchers.clear();
  }

  private readonly writeQueues: Map<string, Queue<void>> = new Map();

  private ensureWriteQueue(provider: IFileSystemProvider, resource: URI): Queue<void> {
    const queueKey = this.toMapKey(provider, resource);
    let writeQueue = this.writeQueues.get(queueKey);
    if (!writeQueue) {
      writeQueue = new Queue<void>();
      this.writeQueues.set(queueKey, writeQueue);

      const onFinish = Event.once(writeQueue.onFinished);
      onFinish(() => {
        this.writeQueues.delete(queueKey);
        dispose(writeQueue);
      });
    }

    return writeQueue;
  }

  private toMapKey(provider: IFileSystemProvider, resource: URI): string {
    const isPathCaseSensitive = !!(
      provider.capabilities & FileSystemProviderCapabilities.PathCaseSensitive
    );

    return isPathCaseSensitive ? resource.toString() : resource.toString().toLowerCase();
  }

  protected throwIfFileSystemIsReadonly<T extends IFileSystemProvider>(
    provider: T,
    resource: URI
  ): T {
    if (provider.capabilities & FileSystemProviderCapabilities.Readonly) {
      throw new FileOperationError(
        `Unable to modify readonly file ${this.resourceForError(resource)}`,
        FileOperationResult.FILE_PERMISSION_DENIED
      );
    }

    return provider;
  }

  private resourceForError(resource: URI): string {
    if (resource.scheme === Schemas.file) {
      return resource.fsPath;
    }

    return resource.toString();
  }
}
