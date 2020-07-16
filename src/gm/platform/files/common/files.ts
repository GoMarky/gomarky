import { isEqual, isEqualOrParent, URI } from '@/gm/base/common/uri';
import { IDisposable } from '@/gm/base/common/lifecycle';
import { Emitter, Event } from '@/gm/base/common/event';

import { isUndefinedOrNull } from '@/gm/base/common/types';
import { createDecorator } from '@/gm/platform/instantiation/common/instantiation';

import { FileOperationError, FileOperationResult } from '@/gm/platform/files/common/fileService';
import { startsWithIgnoreCase } from '@/gm/base/common/string';

import { sep } from 'path';

export const enum AutoSaveConfiguration {
  OFF = 'off',
  AFTER_DELAY = 'afterDelay',
  ON_FOCUS_CHANGE = 'onFocusChange',
  ON_WINDOW_CHANGE = 'onWindowChange',
}

interface IBaseStat {
  resource: URI;
  name: string;
  size?: number;
  mtime?: number;
  ctime?: number;
  etag?: string;
}

export interface IBaseStatWithMetadata extends IBaseStat {
  mtime: number;
  ctime: number;
  etag: string;
  size: number;
}

export function hasReadWriteCapability(
  provider: IFileSystemProvider
): provider is IFileSystemProviderWithFileReadWriteCapability {
  return !!(provider.capabilities & FileSystemProviderCapabilities.FileReadWrite);
}

export interface IResolveFileResult {
  stat?: IFileStat;
  success: boolean;
}

export interface IResolveFileResultWithMetadata extends IResolveFileResult {
  stat?: IFileStatWithMetadata;
}

export interface IFileContent extends IBaseStatWithMetadata {
  value: Buffer;
}

export interface IFileStreamContent extends IBaseStatWithMetadata {
  value: any;
}

export interface IReadFileOptions extends FileReadStreamOptions {
  readonly etag?: string;
}

export interface IResolveFileOptions {
  readonly resolveTo?: readonly URI[];
  readonly resolveSingleChildDescendants?: boolean;
  readonly resolveMetadata?: boolean;
}

export interface IResolveMetadataFileOptions extends IResolveFileOptions {
  readonly resolveMetadata: true;
}

export interface IFileSystemProviderRegistrationEvent {
  added: boolean;
  scheme: string;
  provider?: IFileSystemProvider;
}

export interface IFileSystemProviderCapabilitiesChangeEvent {
  provider: IFileSystemProvider;
  scheme: string;
}

export interface IFileSystemProviderActivationEvent {
  scheme: string;

  join(promise: Promise<void>): void;
}

export interface IFileStat extends IBaseStat {
  isFile: boolean;
  isDirectory: boolean;
  isSymbolicLink: boolean;
  children?: IFileStat[];
}

export interface IFileStatWithMetadata extends IFileStat, IBaseStatWithMetadata {
  mtime: number;
  ctime: number;
  etag: string;
  size: number;
  children?: IFileStatWithMetadata[];
}

export interface IStat {
  type: FileType;
  mtime: number;
  ctime: number;
  size: number;
}

export interface IWatchOptions {
  recursive: boolean;
  excludes: string[];
}

export const enum FileSystemProviderCapabilities {
  FileReadWrite = 1 << 1,
  FileOpenReadWriteClose = 1 << 2,
  FileReadStream = 1 << 4,

  FileFolderCopy = 1 << 3,

  PathCaseSensitive = 1 << 10,
  Readonly = 1 << 11,

  Trash = 1 << 12,
}

export interface FileWriteOptions {
  overwrite: boolean;
  create: boolean;
}

export interface FileReadStreamOptions {
  readonly position?: number;
  readonly length?: number;

  limits?: {
    readonly size?: number;
    readonly memory?: number;
  };
}

export interface FileOpenOptions {
  create: boolean;
}

export interface FileDeleteOptions {
  recursive: boolean;
  useTrash: boolean;
}

export interface FileOverwriteOptions {
  overwrite: boolean;
}

export interface ICreateFileOptions {
  readonly overwrite?: boolean;
}

export const enum FileChangeType {
  UPDATED = 0,
  ADDED = 1,
  DELETED = 2,
}

export interface IFileChange {
  readonly type: FileChangeType;
  readonly resource: URI;
}

export enum FileType {
  Unknown = 0,
  File = 1,
  Directory = 2,
  SymbolicLink = 64,
}

export interface IFileSystemProvider {
  readonly capabilities: FileSystemProviderCapabilities;
  readonly onDidChangeCapabilities: Event<void>;

  readonly onDidErrorOccur?: Event<string>;
  readonly onDidChangeFile: Event<readonly IFileChange[]>;

  watch(resource: URI, opts: IWatchOptions): IDisposable;
  stat(resource: URI): Promise<IStat>;
  mkdir(resource: URI): Promise<void>;

  readdir(resource: URI): Promise<[string, FileType][]>;
  delete(resource: URI, opts: FileDeleteOptions): Promise<void>;
  rename(from: URI, to: URI, opts: FileOverwriteOptions): Promise<void>;
  copy?(from: URI, to: URI, opts: FileOverwriteOptions): Promise<void>;

  readFile?(resource: URI): Promise<Uint8Array>;
  writeFile?(resource: URI, content: Uint8Array, opts: FileWriteOptions): Promise<void>;

  open?(resource: URI, opts: FileOpenOptions): Promise<number>;
  close?(fd: number): Promise<void>;
  read?(fd: number, pos: number, data: Uint8Array, offset: number, length: number): Promise<number>;

  write?(
    fd: number,
    pos: number,
    data: Uint8Array,
    offset: number,
    length: number
  ): Promise<number>;
}

export interface IFileSystemProviderWithFileReadWriteCapability extends IFileSystemProvider {
  readFile(resource: URI): Promise<Uint8Array>;
  writeFile(resource: URI, content: Uint8Array, opts: FileWriteOptions): Promise<void>;
}

export function hasOpenReadWriteCloseCapability(
  provider: IFileSystemProvider
): provider is IFileSystemProviderWithOpenReadWriteCloseCapability {
  return !!(provider.capabilities & FileSystemProviderCapabilities.FileOpenReadWriteClose);
}

export function toFileSystemProviderErrorCode(
  error: Error | undefined | null
): FileSystemProviderErrorCode {
  if (!error) {
    return FileSystemProviderErrorCode.Unknown;
  }
  if (error instanceof FileSystemProviderError) {
    return error.code;
  }
  const match = /^(.+) \(FileSystemError\)$/.exec(error.name);
  if (!match) {
    return FileSystemProviderErrorCode.Unknown;
  }

  switch (match[1]) {
    case FileSystemProviderErrorCode.FileExists:
      return FileSystemProviderErrorCode.FileExists;
    case FileSystemProviderErrorCode.FileIsADirectory:
      return FileSystemProviderErrorCode.FileIsADirectory;
    case FileSystemProviderErrorCode.FileNotADirectory:
      return FileSystemProviderErrorCode.FileNotADirectory;
    case FileSystemProviderErrorCode.FileNotFound:
      return FileSystemProviderErrorCode.FileNotFound;
    case FileSystemProviderErrorCode.FileExceedsMemoryLimit:
      return FileSystemProviderErrorCode.FileExceedsMemoryLimit;
    case FileSystemProviderErrorCode.FileTooLarge:
      return FileSystemProviderErrorCode.FileTooLarge;
    case FileSystemProviderErrorCode.NoPermissions:
      return FileSystemProviderErrorCode.NoPermissions;
    case FileSystemProviderErrorCode.Unavailable:
      return FileSystemProviderErrorCode.Unavailable;
  }

  return FileSystemProviderErrorCode.Unknown;
}

export function ensureFileSystemProviderError(error?: Error): Error {
  if (!error) {
    return createFileSystemProviderError('Unknown Error', FileSystemProviderErrorCode.Unknown);
  }

  return error;
}

export function toFileOperationResult(error: Error): FileOperationResult {
  if (error instanceof FileOperationError) {
    return error.fileOperationResult;
  }

  switch (toFileSystemProviderErrorCode(error)) {
    case FileSystemProviderErrorCode.FileNotFound:
      return FileOperationResult.FILE_NOT_FOUND;
    case FileSystemProviderErrorCode.FileIsADirectory:
      return FileOperationResult.FILE_IS_DIRECTORY;
    case FileSystemProviderErrorCode.NoPermissions:
      return FileOperationResult.FILE_PERMISSION_DENIED;
    case FileSystemProviderErrorCode.FileExists:
      return FileOperationResult.FILE_MOVE_CONFLICT;
    case FileSystemProviderErrorCode.FileExceedsMemoryLimit:
      return FileOperationResult.FILE_EXCEEDS_MEMORY_LIMIT;
    case FileSystemProviderErrorCode.FileTooLarge:
      return FileOperationResult.FILE_TOO_LARGE;
    default:
      return FileOperationResult.FILE_OTHER_ERROR;
  }
}

export interface IFileSystemProviderWithOpenReadWriteCloseCapability extends IFileSystemProvider {
  open(resource: URI, opts: FileOpenOptions): Promise<number>;

  close(fd: number): Promise<void>;

  read(fd: number, pos: number, data: Uint8Array, offset: number, length: number): Promise<number>;

  write(fd: number, pos: number, data: Uint8Array, offset: number, length: number): Promise<number>;
}

export interface IFileSystemProviderWithFileFolderCopyCapability extends IFileSystemProvider {
  copy(from: URI, to: URI, opts: FileOverwriteOptions): Promise<void>;
}

export function hasFileFolderCopyCapability(
  provider: IFileSystemProvider
): provider is IFileSystemProviderWithFileFolderCopyCapability {
  return !!(provider.capabilities & FileSystemProviderCapabilities.FileFolderCopy);
}

export interface IFileSystemProviderWithFileFolderCopyCapability extends IFileSystemProvider {
  copy(from: URI, to: URI, opts: FileOverwriteOptions): Promise<void>;
}

export const IFileService = createDecorator<IFileService>('fileService');

export interface IFileService {
  readonly onDidChangeFileSystemProviderRegistrations: Event<IFileSystemProviderRegistrationEvent>;
  readonly onDidChangeFileSystemProviderCapabilities: Event<
    IFileSystemProviderCapabilitiesChangeEvent
  >;
  readonly onWillActivateFileSystemProvider: Event<IFileSystemProviderActivationEvent>;

  registerProvider(scheme: string, provider: IFileSystemProvider): IDisposable;

  activateProvider(scheme: string): Promise<void>;

  canHandleResource(resource: URI): boolean;

  hasCapability(resource: URI, capability: FileSystemProviderCapabilities): boolean;

  readonly onFileChanges: Event<FileChangesEvent>;
  readonly onAfterOperation: Event<FileOperationEvent>;
  readonly _onAfterOperation: Emitter<FileOperationEvent>;

  resolve(resource: URI, options: IResolveMetadataFileOptions): Promise<IFileStatWithMetadata>;

  resolve(resource: URI, options?: IResolveFileOptions): Promise<IFileStat>;

  exists(resource: URI): Promise<boolean>;

  move(source: URI, target: URI, overwrite?: boolean): Promise<IFileStatWithMetadata>;

  copy(source: URI, target: URI, overwrite?: boolean): Promise<IFileStatWithMetadata>;

  createFolder(resource: URI): Promise<IFileStatWithMetadata>;

  del(resource: URI, options?: { useTrash?: boolean; recursive?: boolean }): Promise<void>;

  watch(resource: URI): IDisposable;

  dispose(): void;
}

export const enum FileOperation {
  CREATE,
  DELETE,
  MOVE,
  COPY,
}

export enum FileSystemProviderErrorCode {
  FileExists = 'EntryExists',
  FileNotFound = 'EntryNotFound',
  FileNotADirectory = 'EntryNotADirectory',
  FileIsADirectory = 'EntryIsADirectory',
  FileExceedsMemoryLimit = 'EntryExceedsMemoryLimit',
  FileTooLarge = 'EntryTooLarge',
  NoPermissions = 'NoPermissions',
  Unavailable = 'Unavailable',
  Unknown = 'Unknown',
}

interface IEmptyFileOptions {
  size: number;
}

/**
 *
 * @param {IFileStatWithMetadata} metadata
 */
export function isEmptyFile(metadata: IEmptyFileOptions): boolean {
  return metadata.size <= 0;
}

export class FileSystemProviderError extends Error {
  public readonly name = 'FileSystemProviderError';

  constructor(message: string, public readonly code: FileSystemProviderErrorCode) {
    super(message);
  }
}

export function createFileSystemProviderError(
  error: Error | string,
  code: FileSystemProviderErrorCode
): FileSystemProviderError {
  const providerError = new FileSystemProviderError(error.toString(), code);
  markAsFileSystemProviderError(providerError, code);

  return providerError;
}

export function markAsFileSystemProviderError(
  error: Error,
  code: FileSystemProviderErrorCode
): Error {
  error.name = code ? `${code} (FileSystemError)` : 'FileSystemError';

  return error;
}

export class FileOperationEvent {
  constructor(resource: URI, operation: FileOperation.DELETE);
  constructor(
    resource: URI,
    operation: FileOperation.CREATE | FileOperation.MOVE | FileOperation.COPY,
    target: IFileStatWithMetadata
  );
  constructor(
    public readonly resource: URI,
    public readonly operation: FileOperation,
    public readonly target?: IFileStatWithMetadata
  ) {}

  public isOperation(operation: FileOperation.DELETE): boolean;
  public isOperation(
    operation: FileOperation.MOVE | FileOperation.COPY | FileOperation.CREATE
  ): this is { readonly target: IFileStatWithMetadata };
  public isOperation(operation: FileOperation): boolean {
    return this.operation === operation;
  }
}

export class FileChangesEvent {
  private readonly _changes: readonly IFileChange[];

  constructor(changes: readonly IFileChange[]) {
    this._changes = changes;
  }

  public get changes(): readonly IFileChange[] {
    return this._changes;
  }

  public contains(resource: URI, type?: FileChangeType): boolean {
    if (!resource) {
      return false;
    }

    const checkForChangeType = !isUndefinedOrNull(type);

    return this._changes.some(change => {
      if (checkForChangeType && change.type !== type) {
        return false;
      }

      if (change.type === FileChangeType.DELETED) {
        return isEqualOrParent(resource, change.resource);
      }

      return isEqual(resource, change.resource);
    });
  }
  public getAdded(): IFileChange[] {
    return this.getOfType(FileChangeType.ADDED);
  }
  public gotAdded(): boolean {
    return this.hasType(FileChangeType.ADDED);
  }
  public getDeleted(): IFileChange[] {
    return this.getOfType(FileChangeType.DELETED);
  }
  public gotDeleted(): boolean {
    return this.hasType(FileChangeType.DELETED);
  }
  public getUpdated(): IFileChange[] {
    return this.getOfType(FileChangeType.UPDATED);
  }
  public gotUpdated(): boolean {
    return this.hasType(FileChangeType.UPDATED);
  }

  private getOfType(type: FileChangeType): IFileChange[] {
    return this._changes.filter(change => change.type === type);
  }

  private hasType(type: FileChangeType): boolean {
    return this._changes.some(change => {
      return change.type === type;
    });
  }
}

export function isParent(path: string, candidate: string, ignoreCase?: boolean): boolean {
  if (!path || !candidate || path === candidate) {
    return false;
  }

  if (candidate.length > path.length) {
    return false;
  }

  if (candidate.charAt(candidate.length - 1) !== sep) {
    candidate += sep;
  }

  if (ignoreCase) {
    return startsWithIgnoreCase(path, candidate);
  }

  return path.indexOf(candidate) === 0;
}
