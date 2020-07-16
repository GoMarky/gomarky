import { Viewport as PIXIViewport } from 'pixi-viewport';
import * as PIXI from 'pixi.js';
import { Disposable } from '@/gm/base/common/lifecycle';

import { Event } from '@/gm/base/common/event';
import { Application, ICreateViewportOptions, Scene } from '@/core';

export class Viewport extends Disposable {
  private readonly _screen: PIXIViewport;
  private _scene: Scene;

  private readonly ticker: PIXI.ticker.Ticker = PIXI.ticker.shared;

  public static WorldWidthMax = 25000;
  public static WorldHeightMax = 20000;

  public static WorldWidthMin = 10;
  public static WorldHeightMin = 10;

  public onZoomViewport: Event<void>;
  public onZoomViewportEnd: Event<void>;

  constructor(private readonly app: Application, options: ICreateViewportOptions) {
    super();

    this._screen = new PIXIViewport({
      screenHeight: options.height,
      screenWidth: options.width,
      worldWidth: Viewport.WorldWidthMax,
      worldHeight: Viewport.WorldHeightMax,
      divWheel: document.querySelector(options.elementSelector) as HTMLCanvasElement,
      interaction: this.app.app.renderer.plugins.interaction,
    });

    this.doCreate();
  }

  public get screen(): PIXIViewport {
    return this._screen;
  }

  public get scene(): Scene {
    return this._scene;
  }

  public createScene(): void {
    this._scene = new Scene(this.app);
    this.screen.addChild(this._scene.root.containerGroup.frame);
    this.registerTicker();
  }

  public scale(pixels: number): number {
    return pixels / this.screen.scale.x;
  }

  public reset(): void {
    this.screen.setTransform(40, 40, 1, 1);
  }

  public dispose(): void {
    super.dispose();
  }

  private registerTicker(): void {
    this.onZoomViewport = Event.fromNodeEventEmitter<void>(
      this._screen as Event.NodeEventEmitter,
      'zoomed'
    );

    this.onZoomViewportEnd = Event.fromNodeEventEmitter<void>(
      this._screen as Event.NodeEventEmitter,
      'zoomed-end'
    );

    this._screen.on('zoomed', () => {
      const { worldScreenWidth, worldScreenHeight } = this._screen;

      const isWorldBoundsMaxValue =
        worldScreenWidth > Viewport.WorldWidthMax || worldScreenHeight > Viewport.WorldHeightMax;
      const isWorldBoundsMinValue =
        worldScreenWidth < Viewport.WorldWidthMin || worldScreenWidth < Viewport.WorldHeightMin;

      if (isWorldBoundsMaxValue) {
        return this._screen.fit(false, Viewport.WorldWidthMax, Viewport.WorldHeightMax);
      }

      if (isWorldBoundsMinValue) {
        this._screen.fit(false, Viewport.WorldWidthMin, Viewport.WorldHeightMin);
      }
    });
  }

  private doCreate(): void {
    this._screen.wheel().drag();

    this._screen.plugins.pause('drag');
    this._screen.interactive = true;
    this.app.app.stage.addChild(this.screen);
  }
}
