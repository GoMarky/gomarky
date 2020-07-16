import { IModalService } from '@/gm/platform/modal/common/modal';
import { ILifecycleService, LifePhase } from '@/gm/platform/lifecycle/common/lifecycle';
import { IStoreService } from '@/gm/platform/store/common/storeService';

import { Disposable } from '@/gm/base/common/lifecycle';
import { IModalState, ModalViewName } from '@/gm/platform/store/electron-browser/modal';
import { IContextKey, IContextKeyService } from '@/gm/platform/contextkey/common/contextkey';
import { LayoutContextKeys } from '@/gm/gomarky/layout/common/layoutContextKeys';

export class ModalService extends Disposable implements IModalService {
  private _modalStore: IModalState;

  private _hasOpenModalContextKey: IContextKey<boolean>;

  constructor(
    @ILifecycleService private readonly lifecycleService: ILifecycleService,
    @IStoreService private readonly storeService: IStoreService,
    @IContextKeyService private readonly contextKeyService: IContextKeyService
  ) {
    super();

    this._hasOpenModalContextKey = LayoutContextKeys.hasOpenModal.bindTo(contextKeyService);

    this.lifecycleService.when(LifePhase.Ready).then(() => {
      this._modalStore = this.storeService.getModule<IModalState>('modal');
    });
  }

  public hide(): void {
    this._modalStore.mSetModal(null);
    this._hasOpenModalContextKey.set(false);
  }

  public show(componentName: ModalViewName): void {
    this._modalStore.mSetModal(componentName);
    this._hasOpenModalContextKey.set(true);
  }
}
