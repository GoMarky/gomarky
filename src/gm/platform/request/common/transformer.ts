import { Disposable } from '@/gm/base/common/lifecycle';

export class BaseTransformer extends Disposable {
  public constructor() {
    super();
  }

  protected _transform<T, R>(data: T): T | R {
    return data;
  }

  public static createNullInstance(): BaseTransformer {
    return new BaseTransformer();
  }

  public transform(data: any): any {
    let result;

    if (this._transform instanceof Function) {
      result = this._transform(data);
    } else {
      result = data;
    }

    this.reset();

    return result;
  }

  public reset(): this {
    return this;
  }
}
