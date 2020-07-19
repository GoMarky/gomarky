import { DisplayObject } from '@/core/objects/display/display';

export class Container extends DisplayObject {
  constructor(public readonly parent: DisplayObject) {
    super();
  }

  public draw(): this {
    return this;
  }

  public insert(displayObject: DisplayObject, index?: number): this {
    return this;
  }

  public intersects(point: PIXI.Point): boolean {
    return false;
  }

  public remove(displayObject: DisplayObject): this {
    return this;
  }
}
