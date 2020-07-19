import { Disposable } from '@/gm/base/common/lifecycle';
import { LinkedMap } from '@/gm/base/common/map';
import { Application } from '@/core/code/application';
import { GlCoreError } from '@/core/utils/errors';
import { Class } from '@/gm/typings/utils';
import { FPSPlugin } from '@/core/utils/plugins/fps';

export interface IPluginRegistry {
  register(name: string, Plugin: any): void;

  registerAndRun(name: string, Plugin: any): void;

  run(name: string): void;

  stop(name: string): void;

  forEach(
    callbackfn: (value: IGLPlugin, key: string, map: LinkedMap<string, IGLPlugin>) => void,
    thisArg?: any
  ): void;

  forEachAsync(
    callbackfn: (value: IGLPlugin, key: string, map: LinkedMap<string, IGLPlugin>) => void,
    thisArg?: any
  ): Promise<void>;
}

export interface IGLPlugin {
  run(): void;

  stop(): void;

  dispose(): Promise<void>;
}

export class PluginRegistry extends Disposable implements IPluginRegistry {
  private readonly plugins: LinkedMap<string, IGLPlugin> = new LinkedMap<string, IGLPlugin>();

  constructor(private readonly stage: Application) {
    super();
    this.initialize();
  }

  public register(name: string, plugin: Class): void {
    if (this.plugins.has(name)) {
      throw new GlCoreError(`PluginRegistry#register - plugin ${name} already registered`);
    }

    const _plugin = new plugin(this.stage);

    this.plugins.set(name, _plugin);
  }

  public forEach(
    callbackfn: (value: IGLPlugin, key: string, map: LinkedMap<string, IGLPlugin>) => void,
    thisArg?: any
  ): void {
    return this.plugins.forEach(callbackfn, thisArg);
  }

  public forEachAsync(
    callbackfn: (value: IGLPlugin, key: string, map: LinkedMap<string, IGLPlugin>) => void,
    thisArg?: any
  ): Promise<void> {
    return this.plugins.forEachAsync(callbackfn, thisArg);
  }

  public registerAndRun(name: string, Plugin: any): void {
    if (this.plugins.has(name)) {
      throw new GlCoreError(`PluginRegistry#register - plugin ${name} already registered`);
    }

    const plugin = new Plugin(this.stage);

    this.plugins.set(name, plugin);

    plugin.run();
  }

  public run(name: string): void {
    const plugin = this.plugins.get(name);

    if (plugin) {
      plugin.run();
    }
  }

  public stop(name: string): void {
    const plugin = this.plugins.get(name);

    if (plugin) {
      plugin.stop();
    }
  }

  public destroy(name: string): void {
    const plugin = this.plugins.get(name);

    void plugin?.dispose();
  }

  private registerSystemPlugins(): void {
    this.registerAndRun('FPSPlugin', FPSPlugin);
  }

  private initialize(): void {
    this.registerSystemPlugins();
  }
}
