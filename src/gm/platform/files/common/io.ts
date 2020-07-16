import {
  createFileSystemProviderError,
  FileReadStreamOptions,
  FileSystemProviderErrorCode,
} from '@/gm/platform/files/common/files';

export interface ICreateReadStreamOptions extends FileReadStreamOptions {
  /**
   * The size of the buffer to use before sending to the stream.
   */
  bufferSize: number;
}

function throwIfTooLarge(totalBytesRead: number, options: ICreateReadStreamOptions): boolean {
  // Return early if file is too large to load and we have configured limits
  if (options?.limits) {
    if (typeof options.limits.memory === 'number' && totalBytesRead > options.limits.memory) {
      throw createFileSystemProviderError(
        'To open a file of this size, you need to restart and allow it to use more memory',
        FileSystemProviderErrorCode.FileExceedsMemoryLimit
      );
    }

    if (typeof options.limits.size === 'number' && totalBytesRead > options.limits.size) {
      throw createFileSystemProviderError(
        'File is too large to open',
        FileSystemProviderErrorCode.FileTooLarge
      );
    }
  }

  return true;
}
