import { Viewport as PIXIViewport } from 'pixi-viewport';
import * as PIXI from 'pixi.js';
import { Disposable } from '@/gm/base/common/lifecycle';

import { Event } from '@/gm/base/common/event';
import { Application } from '@/core/code/application';
import { Scene } from '@/core/code/scene';
import { ICreateViewportOptions } from '@/core/base/viewport';

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

  constructor(private readonly stage: Application, options: ICreateViewportOptions) {
    super();

    const { width, height } = options;

    this._screen = new PIXIViewport({
      screenHeight: height,
      screenWidth: width,
      worldWidth: Viewport.WorldWidthMax,
      worldHeight: Viewport.WorldHeightMax,
      divWheel: document.querySelector(options.elementSelector) as HTMLCanvasElement,
      interaction: this.stage.app.renderer.plugins.interaction,
    });

    const canvasElement = this.stage.app.view;

    canvasElement.style.setProperty('width', `${width}px`);

    this.doCreate();
  }

  public get screen(): PIXIViewport {
    return this._screen;
  }

  public get scene(): Scene {
    return this._scene;
  }

  public createScene(): void {
    this._scene = new Scene(this.stage);
    this.screen.addChild(this._scene.root.containerGroup.frame);
    this.registerListeners();

    this.doCreate();
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

  private registerListeners(): void {
    this.onZoomViewport = Event.fromNodeEventEmitter<void>(
      this._screen as Event.NodeEventEmitter,
      'zoomed'
    );

    this.onZoomViewportEnd = Event.fromNodeEventEmitter<void>(
      this._screen as Event.NodeEventEmitter,
      'zoomed-end'
    );

    const onResizeHandler = () => {
      const { innerWidth, innerHeight } = window;
      const { view: canvasElement } = this.stage.app;

      canvasElement.width = innerWidth;
      canvasElement.style.setProperty('width', `${innerWidth}px`);

      this.stage.app.renderer.resize(innerWidth, innerHeight);
      this.stage.viewport.screen.resize(innerWidth, innerHeight);
    };

    window.addEventListener('resize', onResizeHandler);

    const onZoomHandler = () => {
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
    };

    this._screen.on('zoomed', onZoomHandler);
  }

  private doCreate(): void {
    this._screen.wheel().drag();

    this._screen.plugins.pause('drag');
    this._screen.interactive = true;
    this.stage.app.stage.addChild(this.screen);
  }
}
