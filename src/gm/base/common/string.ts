import { CharCode } from '@/gm/base/common/charCode';
import { basename, URI } from '@/gm/base/common/uri';
import { Schemas } from '@/gm/base/common/network';

import { isWindows } from '@/gm/base/platform';

export function capitalize(data: string): string {
  return data.charAt(0).toUpperCase() + data.slice(1);
}

export function equalsIgnoreCase(a: string, b: string): boolean {
  return a.length === b.length && doEqualsIgnoreCase(a, b);
}

export function startsWithIgnoreCase(str: string, candidate: string): boolean {
  const candidateLength = candidate.length;
  if (candidate.length > str.length) {
    return false;
  }

  return doEqualsIgnoreCase(str, candidate, candidateLength);
}

function doEqualsIgnoreCase(a: string, b: string, stopAt = a.length): boolean {
  for (let i = 0; i < stopAt; i++) {
    const codeA = a.charCodeAt(i);
    const codeB = b.charCodeAt(i);

    if (codeA === codeB) {
      continue;
    }

    if (isAsciiLetter(codeA) && isAsciiLetter(codeB)) {
      const diff = Math.abs(codeA - codeB);
      if (diff !== 0 && diff !== 32) {
        return false;
      }
    } else {
      if (String.fromCharCode(codeA).toLowerCase() !== String.fromCharCode(codeB).toLowerCase()) {
        return false;
      }
    }
  }

  return true;
}

export function isLowerAsciiLetter(code: number): boolean {
  return code >= CharCode.a && code <= CharCode.z;
}

export function isUpperAsciiLetter(code: number): boolean {
  return code >= CharCode.A && code <= CharCode.Z;
}

function isAsciiLetter(code: number): boolean {
  return isLowerAsciiLetter(code) || isUpperAsciiLetter(code);
}

export function getBaseLabel(resource: URI | string): string;
export function getBaseLabel(resource: URI | string | undefined): string | undefined;
export function getBaseLabel(resource: URI | string | undefined): string | undefined {
  if (!resource) {
    return undefined;
  }

  if (typeof resource === 'string') {
    resource = URI.file(resource);
  }

  const base =
    basename(resource) || (resource.scheme === Schemas.file ? resource.fsPath : resource.path);

  if (hasDriveLetter(base)) {
    return normalizeDriveLetter(base);
  }

  return base;
}

function hasDriveLetter(path: string): boolean {
  return Boolean(isWindows && path && path[1] === ':');
}

export function normalizeDriveLetter(path: string): string {
  if (hasDriveLetter(path)) {
    return path.charAt(0).toUpperCase() + path.slice(1);
  }

  return path;
}

export function etag(stat: { mtime: number; size: number }): string;
export function etag(stat: {
  mtime: number | undefined;
  size: number | undefined;
}): string | undefined;
export function etag(stat: {
  mtime: number | undefined;
  size: number | undefined;
}): string | undefined {
  if (typeof stat.size !== 'number' || typeof stat.mtime !== 'number') {
    return undefined;
  }

  return stat.mtime.toString(29) + stat.size.toString(31);
}

export function rtrim(haystack: string, needle: string): string {
  if (!haystack || !needle) {
    return haystack;
  }

  const needleLen = needle.length;
  const haystackLen = haystack.length;

  if (needleLen === 0 || haystackLen === 0) {
    return haystack;
  }

  let offset = haystackLen;
  let idx = -1;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    idx = haystack.lastIndexOf(needle, offset - 1);
    if (idx === -1 || idx + needleLen !== offset) {
      break;
    }
    if (idx === 0) {
      return '';
    }
    offset = idx;
  }

  return haystack.substring(0, offset);
}
