import { FunctionLike } from '@/gm/base/common/types';

export function once<T extends FunctionLike>(this: any, fn: T): T {
  // eslint-disable-next-line @typescript-eslint/no-this-alias
  const _this = this;
  let didCall = false;
  let result: any;

  // tslint:disable-next-line:only-arrow-functions
  return (function() {
    if (didCall) {
      return result;
    }

    didCall = true;
    // eslint-disable-next-line @typescript-eslint/ban-ts-ignore
    // @ts-ignore
    // eslint-disable-next-line prefer-rest-params
    result = fn.apply(_this, arguments);

    return result;
  } as any) as T;
}
