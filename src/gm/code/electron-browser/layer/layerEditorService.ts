import { Disposable } from '@/gm/base/common/lifecycle';
import { createDecorator } from '@/gm/platform/instantiation/common/instantiation';

import { IStoreService } from '@/gm/platform/store/common/storeService';
import { ILayerState } from '@/gm/platform/store/electron-browser/layer';
import { ILifecycleService, LifePhase } from '@/gm/platform/lifecycle/common/lifecycle';
import { IToolbarState } from '@/gm/platform/store/electron-browser/toolbar';

import * as GoMarky from '@/gl/gomarky';
import { IGlSceneService } from '@/gm/code/common/graphic/glScene';
import { INotificationService } from '@/gm/platform/notification/common/notification';
import { CommonSerializedLayer, ISerializedGroupLayer, Layer, LayerGroup } from '@/gl/gomarky';
import { IWorkspaceContextService } from '@/gm/platform/workspace/common/workspace';

export interface ILayerEditorService {
  readonly layers: CommonSerializedLayer[];

  updateRootLayer(layer: Layer | LayerGroup): void;
  updateLayer(layer: Layer | LayerGroup): void;
  addLayer(layer: Layer | LayerGroup): void;
  removeLayer(layer: Layer | LayerGroup): void;

  applyMaskForSelected(mask: GoMarky.MaskType): void;
}

export const ILayerEditorService = createDecorator<ILayerEditorService>('layerEditorService');

const LAYERS_GROUP_CREATE_VALUE = 2;

export class LayerEditorService extends Disposable implements ILayerEditorService {
  private _layerStore: ILayerState;
  private _toolbarStore: IToolbarState;

  constructor(
    @ILifecycleService private readonly lifecycleService: ILifecycleService,
    @IStoreService private readonly storeService: IStoreService,
    @IGlSceneService private readonly glSceneService: IGlSceneService,
    @INotificationService private readonly notificationService: INotificationService,
    @IWorkspaceContextService private readonly workspaceService: IWorkspaceContextService
  ) {
    super();

    this.lifecycleService.when(LifePhase.Ready).then(() => {
      const [ToolbarModule, LayerModule] = this.storeService.getModules<IToolbarState, ILayerState>(
        'toolbar',
        'layer'
      );

      this._toolbarStore = ToolbarModule;
      this._layerStore = LayerModule;
    });
  }

  public applyMaskForSelected(mask: GoMarky.MaskType): void {
    this.glSceneService.app.scene.createGroupWithSelectedLayers(mask);
  }

  public addLayer(layer: Layer | LayerGroup): void {
    const page = this.workspaceService.workspace.selectedDocument.selectedPage;

    if (page?.selected) {
      page?.addLayer(layer);
      this._layerStore.mAddLayer(layer);
    }
  }

  public removeLayer(layer: Layer | LayerGroup): void {
    const page = this.workspaceService.workspace.selectedDocument.selectedPage;

    if (page?.selected) {
      this._layerStore.mRemoveLayer(layer.id);
      this._toolbarStore.mSetMaskPanelState(this.canCreateLayerGroup());
    }
  }

  public get layers(): CommonSerializedLayer[] {
    return this._layerStore.layers;
  }

  public updateRootLayer(layer: Layer | LayerGroup): void {
    const page = this.workspaceService.workspace.selectedDocument.selectedPage;

    if (page?.selected) {
      this._layerStore.updateLayer(layer);

      this._toolbarStore.mSetMaskPanelState(this.canCreateLayerGroup());
    }
  }

  public updateLayer(layer: Layer | LayerGroup): void {
    let rootLayer = layer.parent;
    const rootName = GoMarky.Scene.RootName;

    if (rootLayer && rootLayer.name === rootName) {
      return this.updateRootLayer(layer);
    }

    while (rootLayer?.parent?.name === rootName) {
      if (rootLayer?.parent?.name === rootName) {
        break;
      }

      rootLayer = rootLayer.parent;
    }

    if (rootLayer) {
      return this.updateRootLayer(rootLayer);
    }
  }

  private canCreateLayerGroup(): boolean {
    let numberOfSelectedLayers = 0;

    if (this.layers.length <= 1) {
      return false;
    }

    for (const layer of this.layers) {
      if (layer.selected) {
        numberOfSelectedLayers += 1;

        if ((layer as ISerializedGroupLayer).layers?.length) {
          this.notificationService.error(
            `Creating group with another layer group inside is forbidden`
          );

          return false;
        }
      }
    }

    return numberOfSelectedLayers >= LAYERS_GROUP_CREATE_VALUE;
  }
}
