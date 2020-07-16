import * as PIXI from 'pixi.js';
import { Point, ShapeType, Stage } from '@/core/utils/model';

import {
  ICreateGeometryOptions,
  ISerializedPolygon,
  IShapeDrawOptions,
} from '@/core/base/geometry';

import { Geometry } from '@/core/objects/geometry/geometry/geometry';
import { ControlPoint } from '@/core/objects/geometry/geometry/points/controlpoint';
import { Application } from '@/core';

export class Polygon extends Geometry {
  private sides: number[][][] = [];
  public onMouseMoveInit = false;

  public set points(points: ControlPoint[]) {
    this._points = points;

    this.drawStatic();
  }

  public get points(): ControlPoint[] {
    return this._points;
  }

  constructor(application: Application, options?: ICreateGeometryOptions) {
    super(application, { startEvent: options?.startEvent });

    this.type = ShapeType.Polygon;

    this._didMoveControlPoint(() => {
      this.onDidMoveControlPoint();
    });
    this._didControlPointClick((point: ControlPoint) => {
      this.onDidClickControlPoint(point);
    });
    this._didUpControlPoint(() => {
      this.onDidUpControlPoint();
    });
    this._didOverControlPoint(() => {
      this.onDidOverControlPoint();
    });
    this._didOutControlPoint(() => {
      this.onDidOutControlPoint();
    });
  }

  public addPoint(point: ControlPoint): this {
    this._points.push(point);

    this._onDidUpdate.fire();

    this.drawStatic();

    return this;
  }

  public createPoint(point: PIXI.Point): ControlPoint {
    const options = { x: point.x, y: point.y, radius: 5, show: true };
    return new ControlPoint(this.app, this.parent, options);
  }

  public removePoint(point: ControlPoint): this {
    this.parent.frame.removeChild(point.sprite);
    this._onDidUpdate.fire();

    this.drawStatic();

    point.dispose();

    return this;
  }

  /**
   * @description
   * [RU] - Метод который прекращает взаимодействие с фигурой. Мы должны сделать следущее:
   * 1) Спрятать все точки
   * 2) Обновить HitArea у полигона
   * 3) Отрисовать наш полигон заново
   * 4) Отключить обработчики событий
   * 5) Перевести наш this.stage в состояние Stages.UNSELECTED
   *
   * @public
   * @returns void
   */
  public stop(): void {
    this.hideAllPoints();
    this.drawStatic();
    this.disableListeners();

    this.squeezeHitArea(this._points.map(point => new PIXI.Point(point.x, point.y)));

    this.stage = Stage.Unselected;
  }

  public drawDynamic(
    event: PIXI.interaction.InteractionEvent,
    options: IShapeDrawOptions = {
      lineColor: this.lineColor,
      fillColor: this.fillColor,
      lineWidth: this.lineWidth,
    }
  ): void {
    const { lineColor, fillColor, lineWidth } = options;

    const { x, y } = this.app.viewport.screen.toWorld(event.data.global);

    this.container.clear();
    this.container.lineStyle(this.app.viewport.scale(lineWidth), lineColor.digitHex);
    this.container.beginFill(fillColor.digitHex);

    if (this._points.length > 0) {
      const { x: lastX, y: lastY } = this.lastPoint;

      this.container.moveTo(lastX, lastY);
      this.container.lineTo(x, y);

      this.container.drawPolygon(this._points.map(pnt => new PIXI.Point(pnt.x, pnt.y)));
    }

    this.container.endFill();
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
    this.container.lineStyle(this.app.viewport.scale(lineWidth), lineColor.digitHex);
    this.container.beginFill(fillColor.digitHex);

    this.container.drawPolygon(this._points.map(pnt => new PIXI.Point(pnt.x, pnt.y)));

    this.container.endFill();
  }

  public click(event: PIXI.interaction.InteractionEvent): void {
    this.onSingleClick(event);
    this.addPoint(this.createPoint(this.app.viewport.screen.toWorld(event.data.global)));
  }

  public serialize(): ISerializedPolygon {
    return {
      ...super.serialize(),
      points: toDoubleDimensionArray(this._points),
    };
  }

  protected squeezeHitArea(
    array: PIXI.Point[] = this._points.map(
      (point: ControlPoint) => new PIXI.Point(point.x, point.y)
    )
  ): this {
    this.container.hitArea = new PIXI.Polygon(...array);

    return this;
  }

  private addPreControlPoints(): void {
    for (const point of this.shadowPoints) {
      this.parent.frame.removeChild(point.sprite);
    }

    this.sides = this._points
      .map(point => [point.x, point.y])
      .map((_, index, array) => [array[index], array[index + 1]])
      .filter(point => point[0] && point[1]);

    for (const side of this.sides) {
      const pointOne: number[] = side[0];
      const pointTwo: number[] = side[1];

      const differenceX: number = pointOne[0] - pointTwo[0];
      const differenceY: number = pointOne[1] - pointTwo[1];

      const middleX: number = pointOne[0] - differenceX / 2;
      const middleY: number = pointOne[1] - differenceY / 2;

      const options = {
        x: middleX,
        y: middleY,
        radius: 5,
        show: false,
        name: Point.Shadow,
      };

      const point = new ControlPoint(this.app, this.parent, options);

      const firstPoint = this._points.find(
        (point: ControlPoint) => point.x === pointOne[0] && point.y === pointOne[1]
      );

      const index = this.parent.frame.getChildIndex(firstPoint?.sprite as PIXI.DisplayObject);

      this.parent.frame.addChildAt(point.sprite, index + 1);
    }
  }

  private onDidClickControlPoint(point: ControlPoint): void {
    if (point.name === Point.Shadow) {
      point.name = Point.Control;
    }

    this.activePoint = true;
    this.activeGeometry = point;
  }

  private onDidUpControlPoint(): void {
    this.addPreControlPoints();
    this.showShadowPoints();
    this.drawStatic();
    this.activeGeometry = this;
    this.activePoint = false;

    this._onDidUpdate.fire();
  }

  public onPointerUp = (): void => {
    switch (this.stage) {
      case Stage.Unselected:
        break;
      case Stage.Hover:
        break;
      case Stage.Dragging:
      case Stage.Selected:
        this.stage = Stage.Unselected;
        this.disableListeners();
        this.squeezeHitArea();
        break;
      case Stage.Drawning:
        break;
    }

    this.startX = 0;
    this.startY = 0;
    this.pressedX = 0;
    this.pressedY = 0;
  };

  protected doClickStageDrawning(): void {
    if (!this.activePoint) {
      this.drawStatic();

      if (!this.onMouseMoveInit) {
        this.container.on('pointermove', this.onPointerMove);
        this.stage = Stage.Drawning;
        this.onMouseMoveInit = true;
      }

      // polygon was here
      // this.addPreControlPoints();
    }
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

export function toDoubleDimensionArray(points: ControlPoint[]): number[][] {
  return points.map((point: ControlPoint) => [point.x, point.y]);
}
