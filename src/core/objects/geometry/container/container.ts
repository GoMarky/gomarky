import { ICreateContainerOptions } from '@/core/base/container';

import { ISerializedGeometry } from '@/core/base/geometry';
import * as PIXI from 'pixi.js';

import { Event } from '@/gm/base/common/event';
import {
  drawDefaultGeometry,
  drawSelectedGeometry,
  Geometry,
} from '@/core/objects/geometry/geometry/geometry';

import { Polygon } from '@/core/objects/geometry/geometry/polygon';
import { Rectangle } from '@/core/objects/geometry/geometry/rectangle';
import { Ellipse } from '@/core/objects/geometry/geometry/ellipse';

import { AbstractContainer } from '@/core/objects/geometry/container/abstractContainer';
import { Shape } from '@/core/objects/geometry/shape/shape';
import { Application } from '@/core';

export class Container extends AbstractContainer {
  constructor(
    app: Application,
    options: ICreateContainerOptions,
    public readonly parentLayer: Shape
  ) {
    super(app);

    this._geometry = options?.geometry;
    this.frame.addChild(options?.geometry.container);

    this.frame.interactive = true;
    this.geometry.parent = this;

    if (
      this.geometry.startEvent &&
      (this.geometry instanceof Polygon ||
        this.geometry instanceof Rectangle ||
        this.geometry instanceof Ellipse)
    ) {
      this.geometry.click(this.geometry.startEvent as PIXI.interaction.InteractionEvent);
    }
  }

  protected readonly _geometry: Geometry;
  public get geometry(): Geometry {
    return this._geometry;
  }

  public get selected(): boolean {
    return this._selected;
  }

  public set selected(selected: boolean) {
    const { geometry } = this;

    selected ? drawSelectedGeometry(geometry) : drawDefaultGeometry(geometry);

    this._selected = selected;
  }

  public get onDidUpdate(): Event<void> {
    return this.geometry.onDidUpdate;
  }

  public hide(): this {
    this.frame.renderable = false;
    this.frame.interactive = false;
    this.geometry.container.buttonMode = false;

    return this;
  }

  public show(): this {
    this.frame.renderable = true;
    this.frame.interactive = true;
    this.geometry.container.buttonMode = true;

    return this;
  }

  public serialize(): ISerializedGeometry {
    return this.geometry.serialize();
  }

  public draw(): void {
    if (this.geometry instanceof Rectangle || this.geometry instanceof Ellipse) {
      this.geometry.drawStaticPreview();
    }
  }

  public onDoubleClick = (): void => {
    return this.geometry.onDoubleClick();
  };

  public onSingleClick = (event: PIXI.interaction.InteractionEvent): void => {
    return this.geometry.onSingleClick(event);
  };

  public remove(): void {
    // eslint-disable-next-line @typescript-eslint/ban-ts-ignore
    // @ts-ignore
    this.parentLayer.parent?.containerGroup.frame.removeChild(this.frame);
  }

  public dispose(): void {
    if (this.isDisposed) {
      return;
    }

    this.isDisposed = true;
    this.geometry.container.removeAllListeners();
    this.geometry.dispose();

    super.dispose();
  }
}
