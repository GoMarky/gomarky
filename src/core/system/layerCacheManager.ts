import { Disposable } from '@/gm/base/common/lifecycle';
import { Layer } from '@/core';

export class LayerCacheManager extends Disposable {
  private readonly cachedLayers: WeakSet<Layer> = new WeakSet<Layer>();

  public add(layer: Layer): void {
    this.cachedLayers.add(layer);
  }

  public delete(layer: Layer): boolean {
    return this.cachedLayers.delete(layer);
  }

  public has(layer: Layer): boolean {
    return this.cachedLayers.has(layer);
  }
}
