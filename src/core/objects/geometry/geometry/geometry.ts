import { Disposable } from '@/gm/base/common/lifecycle';
import * as PIXI from 'pixi.js';

import { Color, ColorRGBA } from '@/gm/base/color';
import { generateUuid } from '@/gm/base/common/uuid';
import { Emitter, Event } from '@/gm/base/common/event';

import { Point, ShapeType, Stage } from '@/core/utils/model';

import {
  GeometryMoveDirection,
  Application,
  ICreateGeometryOptions,
  IShapeDrawOptions,
  ISerializedGeometry,
  PointLike,
} from '@/core';

import { ControlPoint } from '@/core/objects/geometry/geometry/points/controlpoint';
import { Container } from '@/core/objects/geometry/container/container';

const DEFAULT_CHANGE_GEOMETRY_DELAY = 500;

export abstract class Geometry extends Disposable {
  public readonly didControlPointClick = this._register(new Emitter<ControlPoint>());
  protected readonly _didControlPointClick: Event<ControlPoint> = this.didControlPointClick.event;

  public readonly didMoveControlPoint = this._register(new Emitter<void>());
  protected readonly _didMoveControlPoint: Event<void> = this.didMoveControlPoint.event;

  public readonly didUpControlPoint = this._register(new Emitter<void>());
  protected readonly _didUpControlPoint: Event<void> = this.didUpControlPoint.event;

  public readonly didOverControlPoint = this._register(new Emitter<void>());
  protected readonly _didOverControlPoint: Event<void> = this.didOverControlPoint.event;

  public readonly didOutControlPoint = this._register(new Emitter<void>());
  protected readonly _didOutControlPoint: Event<void> = this.didOutControlPoint.event;

  public get lastPoint(): ControlPoint {
    return this._points[this._points.length - 1];
  }

  protected readonly _onDidUpdate = this._register(new Emitter<void>());
  public readonly onDidUpdate = Event.debounce<void>(
    this._onDidUpdate.event,
    () => undefined,
    DEFAULT_CHANGE_GEOMETRY_DELAY
  );

  protected activeGeometry: this | PointLike;
  public activePoint = false;
  protected activePointHover = false;
  public isDisposed = false;

  protected onMouseMoveInit = false;

  public startEvent: PIXI.interaction.InteractionEvent | undefined;

  public fillColor: Color;
  public fillColorHover: Color;
  public lineColor: Color;
  public lineColorHover: Color;

  public lineWidth = 2;

  public type: ShapeType;
  public container: PIXI.Graphics = new PIXI.Graphics();
  public readonly id: string = generateUuid();

  public startX = 0;
  public startY = 0;

  protected pressedX = 0;
  protected pressedY = 0;

  protected _stage: Stage = Stage.Drawning;
  public get stage(): Stage {
    return this._stage;
  }

  public set stage(stage: Stage) {
    this._stage = stage;
  }

  public parent: Container;

  protected constructor(protected readonly app: Application, options: ICreateGeometryOptions) {
    super();

    this.container.alpha = 0.5;
    this.container.interactive = true;
    this.container.buttonMode = true;

    this.startEvent = options?.startEvent;

    switch (this.stage) {
      case Stage.Unselected:
      case Stage.Hover:
      case Stage.Selected:
        break;
      case Stage.Drawning:
        this.container.hitArea = new PIXI.Rectangle(
          0,
          0,
          this.app.viewport.screen.worldScreenWidth,
          this.app.viewport.screen.worldScreenWidth
        );
        break;
    }

    this.enableListeners();
  }

  public serialize(): ISerializedGeometry {
    return {
      id: this.id,
      color: this.fillColor.toJSON(),
      type: this.type,
      points: this._points.map(point => [point.x, point.y]),
    };
  }

  public abstract drawStatic(options?: IShapeDrawOptions): void;
  public abstract stop(): void;
  public abstract onPointerUp(event: PIXI.interaction.InteractionEvent): void;
  protected abstract drawDynamic(event: PIXI.interaction.InteractionEvent): void;
  protected abstract squeezeHitArea(): this;

  public get shadowPoints(): ControlPoint[] {
    return this._points.filter((point: ControlPoint) => point.name === Point.Shadow);
  }

  protected _points: ControlPoint[] = [];
  public abstract points: ControlPoint[];

  public dynamicMove(event: PIXI.interaction.InteractionEvent): void {
    const { x, y } = this.app.viewport.screen.toWorld(event.data.global);

    this.pressedX = this.startX - x;
    this.pressedY = this.startY - y;

    this.startX = x;
    this.startY = y;

    for (const point of this._points) {
      point.x += this.pressedX * -1;
      point.y += this.pressedY * -1;
    }

    this._onDidUpdate.fire();
    this.drawStatic();
  }

  public start(): void {
    this.expandHitArea();

    this.container.interactive = true;
  }

  public move(direction: GeometryMoveDirection) {
    const { points } = this;

    let move: (point: ControlPoint) => void;

    switch (direction) {
      case 'up':
        move = point => (point.y -= this.app.viewport.scale(1));
        break;
      case 'down':
        move = point => (point.y += this.app.viewport.scale(1));
        break;
      case 'left':
        move = point => (point.x -= this.app.viewport.scale(1));
        break;
      case 'right':
        move = point => (point.x += this.app.viewport.scale(1));
        break;
    }

    for (const point of points) {
      move.apply(undefined, [point]);
    }

    this._onDidUpdate.fire();

    this.drawStatic();
  }

  public onSingleClick = (event: PIXI.interaction.InteractionEvent) => {
    const canMakeCurrent = this.doCurrentOnScene();

    if (!canMakeCurrent) {
      return;
    }

    this.start();

    const point = this.app.viewport.screen.toWorld(event.data.global);

    this.startX = point.x;
    this.startY = point.y;

    const startMouseMoveHandler = () => {
      if (!this.onMouseMoveInit) {
        this.container.on('pointermove', this.onPointerMove);

        this.stage = Stage.Dragging;
        this.onMouseMoveInit = true;
      }
    };

    switch (this.stage) {
      case Stage.Unselected:
        // startMouseMoveHandler();
        this.stop();
        break;
      case Stage.Hover:
        this.stage = Stage.Selected;

        startMouseMoveHandler();
        this.activeGeometry = this;

        this.drawStatic();
        this.expandHitArea();

        break;
      case Stage.Selected:
        this.drawStatic();
        startMouseMoveHandler();

        /*
         * When we just select our figure for dragging, we should prevent our single-click actions
         * */
        break;
      case Stage.Drawning:
        this.doClickStageDrawning();
        break;
    }
  };

  public onDoubleClick = (): void => {
    return this.doDoubleClick();
  };

  protected onPointerMove = (event: PIXI.interaction.InteractionEvent) => {
    if (this.activePoint) {
      return;
    }

    switch (this.stage) {
      case Stage.Unselected:
      case Stage.Hover:
      case Stage.Selected:
        break;
      case Stage.Drawning:
        this.drawDynamic(event);
        break;
      case Stage.Dragging:
        this.dynamicMove(event);
        break;
    }
  };

  protected onPointerOver = (): void => {
    switch (this.stage) {
      case Stage.Unselected:
        if (!this.activePoint) {
          drawSelectedGeometry(this);
          this.stage = Stage.Hover;
        }

        break;
      case Stage.Hover:
      case Stage.Selected:
      case Stage.Drawning:
        break;
    }
  };

  protected onPointerOut = (): void => {
    switch (this.stage) {
      case Stage.Unselected:
        this.squeezeHitArea();
        break;
      case Stage.Selected:
        /*
         * When we hover-out from selected figure, we should not redraw it
         * */
        break;
      case Stage.Drawning:
        /*
         * Same as in Selected state.
         * */
        break;
      case Stage.Hover:
        this.drawStatic();
        this.stage = Stage.Unselected;

        break;
    }
  };

  protected doDoubleClick(): void {
    const canMakeCurrent = this.doCurrentOnScene();

    if (!canMakeCurrent) {
      return;
    }

    switch (this.stage) {
      case Stage.Unselected:
      case Stage.Hover:
      case Stage.Selected:
      case Stage.Dragging:
        this.stage = Stage.Drawning;

        this.showAllPoints();
        this.expandHitArea();
        this.container.on('pointermove', this.onPointerMove);
        break;
      case Stage.Drawning:
        break;
    }

    this.app.viewport.scene.setCurrentEditedLayer(this.parent.parentLayer);
  }

  protected doCurrentOnScene(): boolean {
    if (
      this.app.viewport.scene.currentLayer?.container === this.parent ||
      !this.app.viewport.scene.interaction.interactiveChildren
    ) {
      return true;
    }

    return this.app.viewport.scene.setCurrentLayer(this.parent.parentLayer);
  }

  protected expandHitArea(): this {
    this.container.hitArea = new PIXI.Rectangle(
      0,
      0,
      this.app.viewport.screen.worldScreenWidth,
      this.app.viewport.screen.worldScreenHeight
    );

    return this;
  }

  protected enableListeners(): void {
    this.container.on('pointerover', this.onPointerOver);
    this.container.on('pointerout', this.onPointerOut);

    this.onMouseMoveInit = false;
  }

  protected disableListeners(): void {
    this.container.removeAllListeners();

    this.enableListeners();
  }

  protected onDidOverControlPoint(): void {
    this.activePointHover = true;
  }

  protected onDidOutControlPoint(): void {
    this.activePointHover = false;
  }

  protected onDidMoveControlPoint(): void {
    this.hideShadowPoints();
    this.drawStatic();
  }

  public hideAllPoints(): this {
    this._points.forEach(pnt => (pnt.visible = false));

    return this;
  }

  protected showAllPoints(): this {
    this._points.forEach(pnt => (pnt.visible = true));

    return this;
  }

  protected showControlPoints(): this {
    this._points.forEach(point => (point.visible = true));

    return this;
  }

  protected hideControlPoints(): this {
    this._points.forEach(point => (point.visible = false));

    return this;
  }

  protected hideShadowPoints(): this {
    this.shadowPoints.forEach(pnt => (pnt.visible = false));

    return this;
  }

  protected showShadowPoints(): this {
    this.shadowPoints.forEach(pnt => (pnt.visible = true));

    return this;
  }

  protected abstract doClickStageDrawning(): void;

  public dispose(): void {
    super.dispose();

    this.isDisposed = true;
    this._onDidUpdate.dispose();

    this.points.forEach(point => point.dispose());

    this.didControlPointClick.dispose();
    this.didMoveControlPoint.dispose();
    this.didOutControlPoint.dispose();
    this.didUpControlPoint.dispose();
    this.didOverControlPoint.dispose();
  }
}

export function drawSelectedGeometry(figure: Geometry): void {
  return figure.drawStatic({
    lineColor: figure.lineColor,
    fillColor: new Color(new ColorRGBA(255, 255, 255, 1)),
    lineWidth: figure.lineWidth,
  });
}

export function drawDefaultGeometry(figure: Geometry): void {
  return figure.drawStatic();
}
