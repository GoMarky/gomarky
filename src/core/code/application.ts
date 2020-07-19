import * as PIXI from 'pixi.js';

import { Disposable } from '@/gm/base/common/lifecycle';
import { Viewport } from '@/core/code/viewport';

import { Scene } from '@/core/code/scene';
import { ICreateViewportOptions } from '@/core/base/viewport';
import { ILayerHooks, IRootLayerHooks } from '@/core/objects/geometry/layer/common/layer';
import { PluginRegistry } from '@/core/utils/plugins';

export interface IApplication {
  readonly app: PIXI.Application;
  readonly viewport: Viewport;
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
  private readonly _pluginRegistry: PluginRegistry;

  constructor(options: PIXI.ApplicationOptions, public meta?: IMetaOptions) {
    super();

    this._app = new PIXI.Application(options);

    const { width, height } = options;

    const viewport = (this._viewport = this.createViewport({
      width: width as number,
      height: height as number,
      elementSelector: '.gomarky-scene',
    }));

    viewport.createScene();

    this._pluginRegistry = new PluginRegistry(this);
  }

  public get app(): PIXI.Application {
    return this._app;
  }

  public get viewport(): Viewport {
    return this._viewport;
  }

  public get scene(): Scene {
    return this._viewport.scene;
  }

  public get plugins(): PluginRegistry {
    return this._pluginRegistry;
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
