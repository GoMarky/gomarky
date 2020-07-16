export type FunctionLike = (...args: any[]) => any;

const _typeof = {
  number: 'number',
  string: 'string',
  undefined: 'undefined',
  object: 'object',
  function: 'function',
};

export function isUndefined(obj: any): obj is undefined {
  return typeof obj === _typeof.undefined;
}

export function isUndefinedOrNull(obj: any): obj is undefined | null {
  return isUndefined(obj) || obj === null;
}

export function isString(str: any): str is string {
  return typeof str === _typeof.string || str instanceof String;
}

export function isObject(obj: any): obj is object {
  return (
    typeof obj === _typeof.object &&
    obj !== null &&
    !Array.isArray(obj) &&
    !(obj instanceof RegExp) &&
    !(obj instanceof Date)
  );
}

type AnyFunction = (...args: any[]) => any;
type Unpacked<T> = T extends Promise<infer U> ? U : T;

export type PromisifiedFunction<T extends AnyFunction> = T extends () => infer U
  ? () => Promise<Unpacked<U>>
  : T extends (a1: infer A1) => infer U
  ? (a1: A1) => Promise<Unpacked<U>>
  : T extends (a1: infer A1, a2: infer A2) => infer U
  ? (a1: A1, a2: A2) => Promise<Unpacked<U>>
  : T extends (a1: infer A1, a2: infer A2, a3: infer A3) => infer U
  ? (a1: A1, a2: A2, a3: A3) => Promise<Unpacked<U>> // ...
  : T extends (...args: any[]) => infer U
  ? (...args: any[]) => Promise<Unpacked<U>>
  : T;

export type Promisified<T> = {
  [K in keyof T]: T[K] extends AnyFunction ? PromisifiedFunction<T[K]> : never;
};
