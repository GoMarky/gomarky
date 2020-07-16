import * as PIXI from 'pixi.js';
import { Disposable } from '@/gm/base/common/lifecycle';

import { Emitter, Event, GlobalEvent } from '@/gm/base/common/event';
import { Color, ColorRGBA } from '@/gm/base/color';
import { Application } from '@/core';

export class RangeSelect extends Disposable {
  public readonly grc: PIXI.Graphics = new PIXI.Graphics();
  public isStarted = false;

  private startY = 0;
  private startX = 0;

  private readonly backgroundColor: Color = new Color(new ColorRGBA(3, 132, 252, 0.5));
  private readonly borderColor: Color = new Color(new ColorRGBA(3, 240, 252, 1));

  private readonly _borderSelectShape: PIXI.Graphics;
  private readonly _borderSelectColor: Color = new Color(new ColorRGBA(3, 240, 252, 1));

  private readonly _onBoundsChanged = this._register(new Emitter<RangeSelectEvent>());
  public readonly onBoundsChanged: Event<RangeSelectEvent> = this._onBoundsChanged.event;

  private readonly _onStart = this._register(new Emitter<void>());
  public readonly onStart: Event<void> = this._onStart.event;

  private readonly _onEnd = this._register(new Emitter<void>());
  public readonly onEnd: Event<void> = this._onEnd.event;

  constructor(private readonly app: Application) {
    super();

    this._borderSelectShape = new PIXI.Graphics();
    // TODO: VERY HACKY, BUT WORKS GOOD. FIX IT LATER
    setTimeout(() => this.app.viewport.screen.addChild(this._borderSelectShape));
  }

  private _canStart: () => boolean = () => true;
  public get canStart(): () => boolean {
    return this._canStart;
  }
  public set canStart(permission: () => boolean) {
    this._canStart = permission;
  }

  public start(startPoint: PIXI.Point): void {
    if (!this._canStart()) {
      return;
    }

    this.app.viewport.screen.addChild(this.grc);

    this.isStarted = true;

    const width = this.app.app.screen.width;
    const height = this.app.app.screen.height;

    this.startX = startPoint.x;
    this.startY = startPoint.y;

    this.grc.interactive = true;
    this.grc.hitArea = new PIXI.Rectangle(0, 0, width, height);
    this.grc.on('pointermove', this.onPointerMove);

    this._onStart.fire();
  }

  public end(): void {
    if (!this.isStarted) {
      return;
    }

    this.isStarted = false;
    this.grc.interactive = false;

    this.grc.removeAllListeners();
    this.grc.clear();

    this._onEnd.fire();
  }

  private draw(event: PIXI.interaction.InteractionEvent): this {
    const worldPoint = this.app.viewport.screen.toWorld(event.data.global.x, event.data.global.y);
    const width = worldPoint.x - this.startX;
    const height = worldPoint.y - this.startY;

    /**
     * TODO:
     *  We calculating bounds of our select before we actually draw it. Need to fix it.
     */
    const selectEvent = new RangeSelectEvent(this.grc.getBounds());

    this._onBoundsChanged.fire(selectEvent);

    if (selectEvent.defaultPrevented) {
      return this;
    }

    this.grc.clear();

    const fillColor = Color.RGBAtoDigitHEX(this.backgroundColor.rgba);
    this.grc.beginFill(fillColor, 0.2);

    const lineColor = Color.RGBAtoDigitHEX(this.borderColor.rgba);
    this.grc.lineStyle(this.app.viewport.scale(1), lineColor);

    const rectangleShape = new PIXI.Rectangle(this.startX, this.startY, width, height);
    this.grc.drawShape(rectangleShape);

    this.grc.endFill();

    return this;
  }

  private readonly onPointerMove = (event: PIXI.interaction.InteractionEvent): void => {
    if (!this.isStarted) {
      return;
    }

    this.draw(event);
  };

  public drawBorderShape(bounds: PIXI.Rectangle): void {
    this.clearBorderShape();

    const lineColor = Color.RGBAtoDigitHEX(this._borderSelectColor.rgba);

    this._borderSelectShape.lineStyle(this.app.viewport.scale(1), lineColor);
    this._borderSelectShape.drawShape(bounds);
    this._borderSelectShape.endFill();
  }

  public clearBorderShape(): void {
    this._borderSelectShape.clear();
  }
}

export class RangeSelectEvent extends GlobalEvent {
  private readonly _bounds: PIXI.Rectangle;
  public get bounds(): PIXI.Rectangle {
    return this._bounds;
  }

  constructor(bounds: PIXI.Rectangle) {
    super();

    this._bounds = bounds;
  }
}
