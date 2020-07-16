import { Disposable } from '@/gm/base/common/lifecycle';
import { LinkedMap } from '@/gm/base/common/map';
import { Application, GlCoreError } from '@/core';

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
  }

  public register(name: string, Plugin: any): void {
    if (this.plugins.has(name)) {
      throw new GlCoreError(`PluginRegistry#register - plugin ${name} already registered`);
    }

    const plugin = new Plugin(this.stage);

    this.plugins.set(name, plugin);
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
}
