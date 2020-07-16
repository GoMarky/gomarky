/**
 * @description
 *  Greatest common divisor
 *
 * @param {number} a
 * @param {number} b
 *
 * @return {number}
 */
import { URI } from '@/gm/base/common/uri';

export function calculateAspectRatio(a: number, b: number): number {
  return b === 0 ? a : calculateAspectRatio(b, a % b);
}

/**
 * @description
 *  Create video element tag.
 *
 *
 * @returns {HTMLVideoElement}
 */
export function getVideoElementFromURL(resource: URI | string): HTMLVideoElement {
  const video = document.createElement('video');

  let url: string;

  if (resource instanceof URI) {
    url = resource.fsPath;
  } else {
    url = resource;
  }

  video.src = `file://${url}`;
  video.autoplay = false;
  video.preload = 'auto';

  return video;
}
