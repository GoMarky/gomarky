import { Disposable } from '@/gm/base/common/lifecycle';
import { createDecorator } from '@/gm/platform/instantiation/common/instantiation';
import { Emitter, Event } from '@/gm/base/common/event';

import { IContextKey, IContextKeyService } from '@/gm/platform/contextkey/common/contextkey';
import { ToolbarContextKeys } from '@/gm/gomarky/scene/common/sceneContextKeys';

export interface ILayerToolbarService {
  readonly onCloseAllMaskPopup: Event<void>;
  readonly maskPopupContext: IContextKey<boolean>;

  readonly canSelectLayer: boolean;

  closeAllMaskPopup(): void;
  setCanSelectLayer(value: boolean): void;
}

export const ILayerToolbarService = createDecorator<ILayerToolbarService>('layerToolbarService');

export class LayerToolbarService extends Disposable implements ILayerToolbarService {
  private _onCloseAllMaskPopup = new Emitter<void>();
  public readonly onCloseAllMaskPopup: Event<void> = this._onCloseAllMaskPopup.event;

  public readonly maskPopupContext: IContextKey<boolean>;
  private readonly canSelectLayersContext: IContextKey<boolean>;

  constructor(@IContextKeyService private readonly contextKeyService: IContextKeyService) {
    super();

    this.maskPopupContext = ToolbarContextKeys.hasOpenMaskPopup.bindTo(contextKeyService);
    this.canSelectLayersContext = ToolbarContextKeys.canSelectLayersInToolbar.bindTo(
      contextKeyService
    );
  }

  public get canSelectLayer(): boolean {
    return Boolean(this.canSelectLayersContext.get());
  }

  public setCanSelectLayer(value: boolean) {
    return this.canSelectLayersContext.set(value);
  }

  public closeAllMaskPopup(): void {
    this.maskPopupContext.set(false);

    return this._onCloseAllMaskPopup.fire();
  }

  public serviceBrand = ILayerToolbarService;
}
