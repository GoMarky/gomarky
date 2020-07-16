import * as PIXI from 'pixi.js';
import { Color } from '@/gm/base/color';
import {
  Application,
  BasePoint,
  Container,
  IColorBasedProperties,
  IPointCreateOptions,
  Point,
} from '@/core';

export class ControlPoint extends BasePoint implements IColorBasedProperties {
  constructor(app: Application, parent: Container, options: IPointCreateOptions) {
    super(app, parent, options);

    this.name = options.name || Point.Control;
    this.sprite.name = this.name;

    this.draw();

    this.sprite.on('pointerdown', this.onPointerDown);
    this.sprite.on('pointerover', this.onPointerOver);
    this.sprite.on('pointerout', this.onPointerOut);
  }

  public get name(): Point {
    return this.sprite.name as Point;
  }

  public set name(name: Point) {
    this.sprite.name = name;
  }

  private readonly onPointerDown = (): void => {
    this.draw();
    this.enableListeners();

    this.parentGeometry.didControlPointClick.fire(this);
  };

  private readonly onPointerMove = (event: PIXI.interaction.InteractionEvent): void => {
    const worldPoint = this.app.viewport.screen.toWorld(event.data.global);

    this.sprite.x = worldPoint.x;
    this.sprite.y = worldPoint.y;

    this.draw({
      fillColor: new Color(Color.fromHEXDigit('#8d8c8c')),
      lineColor: this.lineColor,
      radius: this.radius,
      lineWidth: 3,
    });

    this.parentGeometry.didMoveControlPoint.fire();
  };

  private readonly onPointerUp = (): void => {
    this.draw({
      lineColor: this.lineColor,
      fillColor: this.fillColor,
      radius: this.radius,
      lineWidth: 3,
    });
    this.disableListeners();

    this.parentGeometry.didUpControlPoint.fire();
  };

  private readonly onPointerOver = (): void => {
    this.parentGeometry.didOverControlPoint.fire();
  };

  private readonly onPointerOut = (): void => {
    this.parentGeometry.didOutControlPoint.fire();
  };

  private enableListeners(): void {
    this.sprite.on('pointermove', this.onPointerMove);
    this.sprite.on('pointerup', this.onPointerUp);
  }

  private disableListeners(): void {
    this.sprite.removeAllListeners();
    this.sprite.on('pointerdown', this.onPointerDown);
  }

  public dispose(): void {
    super.dispose();
  }
}
