/**
 * @author Teodor_Dre <swen295@gmail.com>
 *
 * @description
 *  Return random element from array
 *
 * @param {any[]} array - array with elements;
 *
 * @returns ReadonlyArray<T | undefined | null>
 */
export function getRandomElement<T>(
  array: ReadonlyArray<T | undefined | null>
): T | undefined | null {
  return array[Math.floor(array.length * Math.random())];
}

/**
 * @author Teodor_Dre <swen295@gmail.com>
 *
 * @description
 *  New array with all falsy values removed. The original array IS NOT modified.
 *
 * @param {any[]} array - array with elements;
 *
 * @returns any[]
 */
export function coalesce<T>(array: ReadonlyArray<T | undefined | null>): T[] {
  return <T[]>array.filter(e => !!e);
}

/**
 * @author Teodor_Dre <swen295@gmail.com>
 *
 * @description
 *  True if the provided object is an array and has at least one element.
 *
 * @param {any } obj
 *
 * @returns any[]
 */
export function isNonEmptyArray<T>(obj: T[] | undefined | null): obj is T[];
export function isNonEmptyArray<T>(obj: readonly T[] | undefined | null): obj is readonly T[];
export function isNonEmptyArray<T>(
  obj: T[] | readonly T[] | undefined | null
): obj is T[] | readonly T[] {
  return Array.isArray(obj) && obj.length > 0;
}
