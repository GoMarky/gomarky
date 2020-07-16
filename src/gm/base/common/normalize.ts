import { LRUCache } from '@/gm/base/common/map';

export const canNormalize = typeof (<any>'').normalize === 'function';

const nfcCache = new LRUCache<string, string>(10000);
export function normalizeNFC(str: string): string {
  return normalize(str, 'NFC', nfcCache);
}

const nfdCache = new LRUCache<string, string>(10000);
export function normalizeNFD(str: string): string {
  return normalize(str, 'NFD', nfdCache);
}

// eslint-disable-next-line no-control-regex
const nonAsciiCharactersPattern = /[^\u0000-\u0080]/;
/**
 * The normalize() method returns the Unicode Normalization Form of a given string. The form will be
 * the Normalization Form Canonical Composition.
 *
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/normalize}
 */
function normalize(str: string, form: string, normalizedCache: LRUCache<string, string>): string {
  if (!canNormalize || !str) {
    return str;
  }

  const cached = normalizedCache.get(str);
  if (cached) {
    return cached;
  }

  let res: string;
  if (nonAsciiCharactersPattern.test(str)) {
    res = (<any>str).normalize(form);
  } else {
    res = str;
  }

  // Use the cache for fast lookup
  normalizedCache.set(str, res);

  return res;
}
