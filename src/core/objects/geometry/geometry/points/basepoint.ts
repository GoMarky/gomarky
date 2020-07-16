import * as PIXI from 'pixi.js';
import { Disposable, IDisposable } from '@/gm/base/common/lifecycle';
import { generateUuid } from '@/gm/base/common/uuid';
import { Color } from '@/gm/base/color';

import {
  Application,
  Container,
  IColorBasedProperties,
  IPointCreateOptions,
  IPointDrawOptions,
} from '@/core';
import { Geometry } from '@/core/objects/geometry/geometry/geometry';

export abstract class BasePoint extends Disposable implements IColorBasedProperties {
  public readonly sprite: PIXI.Sprite = new PIXI.Sprite();
  public readonly graphics: PIXI.Graphics = new PIXI.Graphics();
  public radius: number;

  public readonly id: string = generateUuid();

  public fillColor: Color;
  public fillColorHover: Color;
  public lineColor: Color;
  public lineColorHover: Color;

  private readonly _zoomListener: IDisposable;

  protected constructor(
    protected readonly app: Application,
    protected _parent: Container,
    options: IPointCreateOptions
  ) {
    super();

    this.sprite.x = options.x;
    this.sprite.y = options.y;

    this.radius = options.radius;

    this.sprite.anchor.x = 0.5;
    this.sprite.anchor.y = 0.5;
    this.sprite.interactive = true;
    this.sprite.buttonMode = true;
    this.sprite.visible = options.show;

    this.sprite.addChild(this.graphics);

    this._parent.frame.addChild(this.sprite);

    this._zoomListener = this.app.viewport.onZoomViewport(() => {
      this.onZoomViewport();
    });
  }

  public get parent(): Container {
    return this._parent;
  }

  public setParent(parent: Container): this {
    if (this._parent === parent) {
      return this;
    }

    this._parent.frame.removeChild(this.sprite);
    this._parent = parent;

    this._parent.frame.addChild(this.sprite);

    return this;
  }

  public get x(): number {
    return this.sprite.x;
  }

  public set x(value) {
    this.sprite.x = value;
  }

  public get y(): number {
    return this.sprite.y;
  }

  public set y(value) {
    this.sprite.y = value;
  }

  public get visible(): boolean {
    return this.sprite.visible;
  }

  public set visible(value: boolean) {
    this.sprite.visible = value;
  }

  public dispose(): void {
    this._zoomListener.dispose();

    this.graphics.destroy(true);
    this.sprite.destroy(true);
    super.dispose();
  }

  protected onZoomViewport(): void {
    this.draw();
  }

  protected get parentGeometry(): Geometry {
    return this.parent.geometry;
  }

  protected draw(
    options: IPointDrawOptions = {
      lineColor: this.lineColor,
      fillColor: this.fillColor,
      radius: this.radius,
      lineWidth: 3,
    }
  ): void {
    const { lineColor, fillColor, radius, lineWidth } = options;

    this.graphics.clear();
    this.graphics.lineStyle(this.app.viewport.scale(lineWidth), lineColor.digitHex);
    this.graphics.beginFill(fillColor.digitHex);
    this.graphics.drawCircle(0, 0, this.app.viewport.scale(radius));
    this.graphics.endFill();
  }

  protected expandHitArea(): void {
    this.graphics.hitArea = new PIXI.Circle(
      this.sprite.x,
      this.sprite.y,
      this.app.viewport.scale(50)
    );
  }
}
