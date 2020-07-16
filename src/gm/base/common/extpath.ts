import * as fs from 'fs';

import { normalize, posix, sep } from 'path';
import { equalsIgnoreCase, rtrim, startsWithIgnoreCase } from '@/gm/base/common/string';
import { isWindows } from '@/gm/base/platform';

import { CharCode } from '@/gm/base/common/charCode';
import { promisify } from 'util';

export function isWindowsDriveLetter(char0: number): boolean {
  return (
    (char0 >= CharCode.A && char0 <= CharCode.Z) || (char0 >= CharCode.a && char0 <= CharCode.z)
  );
}

export function isRootOrDriveLetter(path: string): boolean {
  const pathNormalized = normalize(path);

  if (isWindows) {
    if (path.length > 3) {
      return false;
    }

    return (
      isWindowsDriveLetter(pathNormalized.charCodeAt(0)) &&
      pathNormalized.charCodeAt(1) === CharCode.Colon &&
      (path.length === 2 || pathNormalized.charCodeAt(2) === CharCode.Backslash)
    );
  }

  return pathNormalized === posix.sep;
}

export function isEqual(pathA: string, pathB: string, ignoreCase?: boolean): boolean {
  const identityEquals = pathA === pathB;
  if (!ignoreCase || identityEquals) {
    return identityEquals;
  }

  if (!pathA || !pathB) {
    return false;
  }

  return equalsIgnoreCase(pathA, pathB);
}

export function isEqualOrParent(
  path: string,
  candidate: string,
  ignoreCase?: boolean,
  separator = sep
): boolean {
  if (path === candidate) {
    return true;
  }

  if (!path || !candidate) {
    return false;
  }

  if (candidate.length > path.length) {
    return false;
  }

  if (ignoreCase) {
    const beginsWith = startsWithIgnoreCase(path, candidate);
    if (!beginsWith) {
      return false;
    }

    if (candidate.length === path.length) {
      return true;
    }

    let sepOffset = candidate.length;
    if (candidate.charAt(candidate.length - 1) === separator) {
      sepOffset--;
    }

    return path.charAt(sepOffset) === separator;
  }

  if (candidate.charAt(candidate.length - 1) !== separator) {
    candidate += separator;
  }

  return path.indexOf(candidate) === 0;
}

export async function realpath(path: string): Promise<string> {
  try {
    return await promisify(fs.realpath)(path);
  } catch (error) {
    // We hit an error calling fs.realpath(). Since fs.realpath() is doing some path normalization
    // we now do a similar normalization and then try again if we can access the path with read
    // permissions at least. If that succeeds, we return that path.
    // fs.realpath() is resolving symlinks and that can fail in certain cases. The workaround is
    // to not resolve links but to simply see if the path is read accessible or not.
    const normalizedPath = normalizePath(path);

    await promisify(fs.access)(normalizedPath, fs.constants.R_OK);

    return normalizedPath;
  }
}

function normalizePath(path: string): string {
  return rtrim(normalize(path), sep);
}
