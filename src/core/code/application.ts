import * as PIXI from 'pixi.js';

import { Disposable } from '@/gm/base/common/lifecycle';
import { RangeSelect } from '@/core/code/range';
import { Viewport } from '@/core/code/viewport';

import { Scene } from '@/core/code/stage';
import { ICreateViewportOptions } from '@/core/base/viewport';
import { ILayerHooks, IRootLayerHooks } from '@/core/objects/geometry/layer/common/layer';

export interface IApplication {
  readonly app: PIXI.Application;
  readonly viewport: Viewport;
  readonly select: RangeSelect;
  readonly scene: Scene;

  readonly meta?: IMetaOptions;
}

export interface IMetaOptions {
  hooks: {
    root: IRootLayerHooks;
    layer: ILayerHooks;
  };
}

export class Application extends Disposable implements IApplication {
  private readonly _app: PIXI.Application;
  private readonly _viewport: Viewport;
  private readonly _select: RangeSelect;

  constructor(options: PIXI.ApplicationOptions, public meta?: IMetaOptions) {
    super();

    this._app = new PIXI.Application(options);
    this._select = new RangeSelect(this);

    const viewport = (this._viewport = this.createViewport({
      width: options.width as number,
      height: options.height as number,
      elementSelector: '.gomarky-scene',
    }));

    viewport.createScene();
  }

  public get app(): PIXI.Application {
    return this._app;
  }

  public get select(): RangeSelect {
    return this._select;
  }

  public get viewport(): Viewport {
    return this._viewport;
  }

  public get scene(): Scene {
    return this._viewport.scene;
  }

  private createViewport(options: ICreateViewportOptions): Viewport {
    const _options = {
      width: options.width,
      height: options.height,
      elementSelector: options.elementSelector,
    };

    return new Viewport(this, _options);
  }
}
