import { extname } from 'path';
import { promisify } from 'util';
import imageSize from 'image-size';
import { URI } from '@/gm/base/common/uri';

interface MapExtToMediaMimes {
  [index: string]: string;
}

interface ImageInfo {
  width: number;
  height: number;
  type: string;
  orientation?: number;
}

export const enum FileMimeType {
  Audio = 'audio',
  Video = 'video',
  Application = 'application',
  Image = 'image',
}

const mapExtToMediaMimes: MapExtToMediaMimes = {
  '.aac': 'audio/x-aac',
  '.avi': 'video/x-msvideo',
  '.bmp': 'image/bmp',
  '.flv': 'video/x-flv',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.jpe': 'image/jpg',
  '.jpeg': 'image/jpg',
  '.jpg': 'image/jpg',
  '.m1v': 'video/mpeg',
  '.m2a': 'audio/mpeg',
  '.m2v': 'video/mpeg',
  '.m3a': 'audio/mpeg',
  '.mid': 'audio/midi',
  '.midi': 'audio/midi',
  '.mk3d': 'video/x-matroska',
  '.mks': 'video/x-matroska',
  '.mkv': 'video/x-matroska',
  '.mov': 'video/quicktime',
  '.movie': 'video/x-sgi-movie',
  '.mp2': 'audio/mpeg',
  '.mp2a': 'audio/mpeg',
  '.mp3': 'audio/mpeg',
  '.mp4': 'video/mp4',
  '.mp4a': 'audio/mp4',
  '.mp4v': 'video/mp4',
  '.mpe': 'video/mpeg',
  '.mpeg': 'video/mpeg',
  '.mpg': 'video/mpeg',
  '.mpg4': 'video/mp4',
  '.mpga': 'audio/mpeg',
  '.oga': 'audio/ogg',
  '.ogg': 'audio/ogg',
  '.ogv': 'video/ogg',
  '.png': 'image/png',
  '.psd': 'image/vnd.adobe.photoshop',
  '.qt': 'video/quicktime',
  '.spx': 'audio/ogg',
  '.svg': 'image/svg+xml',
  '.tga': 'image/x-tga',
  '.tif': 'image/tiff',
  '.tiff': 'image/tiff',
  '.wav': 'audio/x-wav',
  '.webm': 'video/webm',
  '.webp': 'image/webp',
  '.wma': 'audio/x-ms-wma',
  '.wmv': 'video/x-ms-wmv',
  '.woff': 'application/font-woff',
};

export function getMediaMime(resource: URI): string | undefined {
  const ext = extname(resource.fsPath);

  return mapExtToMediaMimes[ext.toLowerCase()];
}

export function getFileMimeType(resource: URI): FileMimeType | undefined {
  const mime = getMediaMime(resource);

  if (!mime) {
    return;
  }

  return mime.split('/')[0] as FileMimeType;
}

export async function getImageInfo(path: string): Promise<ImageInfo> {
  return promisify(imageSize)(path);
}
