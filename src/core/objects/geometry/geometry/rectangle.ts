import * as PIXI from 'pixi.js';
import { Geometry } from '@/core/objects/geometry/geometry/geometry';
import {
  Application,
  ControlPoint,
  ICreateGeometryOptions,
  ISerializedRectangle,
  IShapeDrawOptions,
  ShapeType,
  Stage, toDoubleDimensionArray,
} from '@/core';

export class Rectangle extends Geometry {
  private lastEvent: PIXI.interaction.InteractionEvent | null = null;

  public get maxRectPoints(): boolean {
    return this.points.length > 1;
  }

  constructor(app: Application, options?: ICreateGeometryOptions) {
    super(app, { startEvent: options?.startEvent });

    this.type = ShapeType.Rectangle;
  }

  public stop(): void {
    this.hideAllPoints();
    this.squeezeHitArea();
    this.drawStatic();
    this.disableListeners();

    this.stage = Stage.Unselected;
  }

  public set points(points: ControlPoint[]) {
    this._points = points;
  }

  public get points(): ControlPoint[] {
    return this._points;
  }

  public addPoint(point: ControlPoint): this {
    if (this.maxRectPoints) {
      return this;
    }

    this._points.push(point);
    this._onDidUpdate.fire();

    return this;
  }

  public createPoint(point: PIXI.Point): ControlPoint {
    const options = {
      x: point.x,
      y: point.y,
      radius: 5,
      show: true,
    };

    return new ControlPoint(this.app, this.parent, options);
  }

  public removePoint(point: ControlPoint): this {
    this.parent.frame.removeChild(point.sprite);

    point.dispose();
    this._onDidUpdate.fire();

    return this;
  }

  public click(event: PIXI.interaction.InteractionEvent): void {
    this.onSingleClick(event);

    if (this.maxRectPoints) {
      return;
    }

    this.addPoint(this.createPoint(this.app.viewport.screen.toWorld(event.data.global)));
  }

  public drawStatic(
    options: IShapeDrawOptions = {
      lineColor: this.lineColor,
      fillColor: this.fillColor,
      lineWidth: this.lineWidth,
    }
  ): void {
    if (this._points[0] && this._points[0]) {
      this.container.clear();
      this.container.lineStyle(options.lineWidth, options.lineColor.digitHex);
      this.container.beginFill(options.fillColor.digitHex);

      const x = this._points[0].x;
      const y = this._points[0].y;
      const width = this._points[1].x - this._points[0].x;
      const height = this._points[1].y - this._points[0].y;

      // eslint-disable-next-line no-constant-condition
      this.container.drawRect(
        x,
        y,
        width,
        this.app.scene.interaction.canEquilateral ? width : height
      );
    }
  }

  public drawDynamic(
    event: PIXI.interaction.InteractionEvent,
    options: IShapeDrawOptions = {
      lineColor: this.lineColor,
      fillColor: this.fillColor,
      lineWidth: this.lineWidth,
    }
  ): void {
    this.container.clear();
    this.container.lineStyle(options.lineWidth, options.lineColor.digitHex);
    this.container.beginFill(options.fillColor.digitHex);

    const { x: xAxis, y: yAxis } = this.app.viewport.screen.toWorld(event.data.global);

    const x = this._points[0].x;
    const y = this._points[0].y;
    const width = xAxis - this._points[0].x;
    const height = yAxis - this._points[0].y;

    this.lastEvent = event;

    this.container.drawRect(
      x,
      y,
      width,
      this.app.viewport.scene.interaction.canEquilateral ? width : height
    );
  }

  public drawStaticPreview(
    options: IShapeDrawOptions = {
      lineColor: this.lineColor,
      fillColor: this.fillColor,
      lineWidth: this.lineWidth,
    }
  ): void {
    if (!this.lastEvent) {
      return;
    }

    this.container.clear();
    this.container.lineStyle(options.lineWidth, options.lineColor.digitHex);
    this.container.beginFill(options.fillColor.digitHex);

    const { x: xAxis, y: yAxis } = this.app.viewport.screen.toWorld(this.lastEvent.data.global);

    const x = this._points[0].x;
    const y = this._points[0].y;
    const width = xAxis - this._points[0].x;
    const height = yAxis - this._points[0].y;

    this.container.drawRect(
      x,
      y,
      width,
      this.app.viewport.scene.interaction.canEquilateral ? width : height
    );
  }

  public serialize(): ISerializedRectangle {
    return {
      ...super.serialize(),
      points: toDoubleDimensionArray(this._points),
    };
  }

  public onPointerUp = (event: PIXI.interaction.InteractionEvent): void => {
    switch (this.stage) {
      case Stage.Unselected:
      case Stage.Hover:
        break;
      case Stage.Dragging:
      case Stage.Selected:
        this.squeezeHitArea();

        this.stage = Stage.Unselected;
        this.disableListeners();
        break;
      case Stage.Drawning:
        this.addPoint(this.createPoint(this.app.viewport.screen.toWorld(event.data.global)));

        this.stage = Stage.Unselected;
        this.squeezeHitArea();
        this.disableListeners();

        break;
    }

    this.lastEvent = null;
    this.startX = 0;
    this.startY = 0;
    this.pressedX = 0;
    this.pressedY = 0;
  };

  protected doClickStageDrawning(): void {
    if (!this.activePoint) {
      this.showAllPoints();

      if (!this.onMouseMoveInit) {
        this.container.on('pointermove', this.onPointerMove);
        this.stage = Stage.Drawning;
        this.onMouseMoveInit = true;
      }
    }
  }

  protected squeezeHitArea(): this {
    const x = this._points[0].x;
    const y = this._points[0].y;
    const width = this._points[1].x - this._points[0].x;
    const height = this._points[1].y - this._points[0].y;

    this.container.hitArea = new PIXI.Rectangle(x, y, width, height);

    return this;
  }

  public dispose(): void {
    super.dispose();

    this.disableListeners();

    this.didUpControlPoint.dispose();
    this.didMoveControlPoint.dispose();
    this.didOverControlPoint.dispose();

    this.container.destroy();
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    this.container = null!;
    this._points.splice(0, this._points.length);
  }
}
