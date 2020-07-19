import { Disposable } from '@/gm/base/common/lifecycle';

export abstract class DisplayObject extends Disposable {
  public abstract draw(): this;

  public abstract insert(displayObject: DisplayObject, index?: number): this;
  public abstract remove(displayObject: DisplayObject): this;

  public abstract parent: DisplayObject;

  public abstract intersects(point: PIXI.Point): boolean;
}
