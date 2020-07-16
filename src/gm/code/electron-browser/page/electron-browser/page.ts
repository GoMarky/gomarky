import { Disposable } from '@/gm/base/common/lifecycle';
import { ISerializedWorkspacePage, IWorkspacePage } from '@/gm/code/electron-browser/page/common/page';

import { URI } from '@/gm/base/common/uri';
import { IWorkspaceDocument } from '@/gm/code/electron-browser/document/common/workspaceDocument';
import { generateUuid } from '@/gm/base/common/uuid';

import * as GoMarky from '@/gl/gomarky';
import { ITextureService } from '@/gm/code/common/texture/texture';
import { IStoreService } from '@/gm/platform/store/common/storeService';
import { IWorkspaceState } from '@/gm/platform/store/electron-browser/workspace';
import { ILogService } from '@/gm/platform/log/common/log';
import { IGlSceneService } from '@/gm/code/common/graphic/glScene';

export class WorkspacePage extends Disposable implements IWorkspacePage {
  public readonly id: string;
  private _workspaceStore: IWorkspaceState;

  constructor(
    public readonly resource: URI,
    private readonly _resourceData: URI,
    public readonly name: string,
    public readonly parent: IWorkspaceDocument,
    @ITextureService private readonly textureService: ITextureService,
    @ILogService private readonly logService: ILogService,
    @IGlSceneService private readonly glSceneService: IGlSceneService,
    @IStoreService storeService: IStoreService
  ) {
    super();

    this._workspaceStore = storeService.getModule<IWorkspaceState>('workspace');

    this.id = generateUuid();
  }

  private _selected = false;
  public get selected(): boolean {
    return this._selected;
  }
  public async select(): Promise<this> {
    if (this.parent.selectedPage === this && this._selected) {
      return this;
    }

    await this.parent.selectedPage?.unselect();

    this._selected = true;

    if (this._layers.length) {
      this.logService.debug(
        `WorkspacePage#select - page ${this.resource.toString2()} was in cache. Load cache.`
      );

      for (const layer of this._layers) {
        layer.setParent(this.glSceneService.app.scene.root);
      }
    }

    this._workspaceStore.mSetCurrentWorkspacePage(this);
    await this.textureService.render(this);

    return this;
  }

  public async unselect(): Promise<this> {
    if (this._layers.length) {
      for (const layer of this._layers) {
        layer.remove();
      }
    }

    this._selected = false;

    return this;
  }

  public get resourceData(): URI {
    return this._resourceData;
  }

  private _layers: GoMarky.Layer[] = [];
  public get layers(): GoMarky.Layer[] {
    return this._layers;
  }

  private async save(): Promise<this> {
    return this;
  }

  public toJSON(): ISerializedWorkspacePage {
    const { id, name, layers, resource, selected } = this;

    const serialized = {
      id,
      name,
      layers: layers.map(layer => layer.serialize()),
      selected,
      resource,
    };

    Object.defineProperty(serialized, 'instance', { configurable: false, value: this });

    return serialized as ISerializedWorkspacePage;
  }

  public addLayer(layer: GoMarky.Layer): GoMarky.Layer {
    this._layers.push(layer);

    return layer;
  }

  public removeLayer(layer: GoMarky.Layer): GoMarky.Layer {
    this._layers = this._layers.filter(currentLayer => currentLayer !== layer);

    return layer;
  }

  public dispose(): void {
    //
  }
}
