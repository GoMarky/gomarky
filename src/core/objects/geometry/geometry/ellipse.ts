import * as PIXI from 'pixi.js';
import {
  Application,
  ControlPoint,
  ICreateGeometryOptions,
  ISerializedEllipse,
  IShapeDrawOptions,
  ShapeType, Stage, toDoubleDimensionArray,
} from '@/core';
import { Geometry } from '@/core/objects/geometry/geometry/geometry';


export class Ellipse extends Geometry {
  private lastEvent: PIXI.interaction.InteractionEvent | null = null;

  constructor(application: Application, options?: ICreateGeometryOptions) {
    super(application, { startEvent: options?.startEvent });

    this.type = ShapeType.Ellipse;
  }

  public get maxEllipsePoints(): boolean {
    return this.points.length > 1;
  }

  public start(): void {
    this.expandHitArea();

    this.container.interactive = true;
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
    this._points.push(point);
    this._onDidUpdate.fire();

    return this;
  }

  public createPoint(point: PIXI.Point): ControlPoint {
    const options = { x: point.x, y: point.y, radius: 5, show: false };

    return new ControlPoint(this.app, this.parent, options);
  }

  public removePoint(point: ControlPoint): this {
    this.parent.frame.removeChild(point.sprite);

    this._onDidUpdate.fire();
    point.dispose();

    return this;
  }

  public drawDynamic(
    event: PIXI.interaction.InteractionEvent,
    options: IShapeDrawOptions = {
      lineColor: this.lineColor,
      fillColor: this.fillColor,
      lineWidth: this.lineWidth,
    }
  ): void {
    this.lastEvent = event;

    return this.doDrawPreview(event, options);
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

    return this.doDrawPreview(this.lastEvent, options);
  }

  private doDrawPreview(
    event: PIXI.interaction.InteractionEvent,
    options: IShapeDrawOptions = {
      lineColor: this.lineColor,
      fillColor: this.fillColor,
      lineWidth: this.lineWidth,
    }
  ): void {
    const { lineColor, fillColor, lineWidth } = options;

    const { x: pointX, y: pointY } = this.app.viewport.screen.toWorld(event.data.global);

    this.container.clear();
    this.container.lineStyle(lineWidth, lineColor.digitHex);
    this.container.beginFill(fillColor.digitHex);

    const x = this.points[0].x + (pointX - this.points[0].x);
    const y = this.points[0].y + (pointY - this.points[0].y);
    const width = Math.abs(pointX - this.points[0].x);
    const height = Math.abs(pointY - this.points[0].y);

    this.container.drawEllipse(
      x,
      y,
      width,
      this.app.viewport.scene.interaction.canEquilateral ? width : height
    );
  }

  public drawStatic(
    options: IShapeDrawOptions = {
      lineColor: this.lineColor,
      fillColor: this.fillColor,
      lineWidth: this.lineWidth,
    }
  ): void {
    const { lineColor, fillColor, lineWidth } = options;

    this.container.clear();
    this.container.lineStyle(lineWidth, lineColor.digitHex);
    this.container.beginFill(fillColor.digitHex);

    const x = this._points[0].x + (this._points[1].x - this._points[0].x);
    const y = this._points[0].y + (this._points[1].y - this._points[0].y);
    const width = Math.abs(this._points[1].x - this._points[0].x);
    const height = Math.abs(this.points[1].y - this._points[0].y);

    this.squeezeHitArea();
    this.container.drawEllipse(x, y, width, height);
  }

  public click(event: PIXI.interaction.InteractionEvent): void {
    if (this.maxEllipsePoints) {
      return;
    }

    this.addPoint(this.createPoint(this.app.viewport.screen.toWorld(event.data.global)));

    this.onSingleClick(event);
  }

  public serialize(): ISerializedEllipse {
    return {
      ...super.serialize(),
      points: toDoubleDimensionArray(this._points),
    };
  }

  public onPointerUp = (event: PIXI.interaction.InteractionEvent): void => {
    switch (this.stage) {
      case Stage.Unselected:
        break;
      case Stage.Hover:
        break;
      case Stage.Dragging:
      case Stage.Selected:
        this.squeezeHitArea();
        this.stage = Stage.Unselected;
        window.setTimeout(() => this.disableListeners(), 100);

        break;
      case Stage.Drawning:
        this.addPoint(this.createPoint(this.app.viewport.screen.toWorld(event.data.global)));
        this.squeezeHitArea();
        this.stage = Stage.Unselected;
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
    const x = this._points[0].x + (this._points[1].x - this._points[0].x);
    const y = this._points[0].y + (this._points[1].y - this._points[0].y);
    const width = Math.abs(this._points[1].x - this._points[0].x);
    const height = Math.abs(this._points[1].y - this._points[0].y);

    this.container.hitArea = new PIXI.Ellipse(x, y, width, height);

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
