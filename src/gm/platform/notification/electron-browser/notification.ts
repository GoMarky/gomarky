import { Disposable } from '@/gm/base/common/lifecycle';
import { INotificationState } from '@/gm/platform/store/electron-browser/notification';
import { ILifecycleService, LifePhase } from '@/gm/platform/lifecycle/common/lifecycle';
import { IStoreService } from '@/gm/platform/store/common/storeService';
import {
  INotification,
  INotificationService,
  IStatusMessageOptions,
  NotificationMessage,
  Severity,
} from '@/gm/platform/notification/common/notification';

export class NotificationService extends Disposable implements INotificationService {
  public readonly serviceBrand = INotificationService;

  private _model: INotificationState;

  constructor(
    @ILifecycleService private readonly lifecycleService: ILifecycleService,
    storeService: IStoreService
  ) {
    super();

    this.lifecycleService.when(LifePhase.Ready).then(() => {
      this._model = storeService.getModule<INotificationState>('notification');
    });
  }

  public get model(): INotificationState {
    return this._model;
  }

  public info(message: NotificationMessage): void {
    return this.model.mAddNotification({ message, level: Severity.Info });
  }

  public success(message: NotificationMessage): void {
    return this.model.mAddNotification({ message, level: Severity.Success });
  }

  public warn(message: NotificationMessage): void {
    return this.model.mAddNotification({ message, level: Severity.Warning });
  }

  public error(message: NotificationMessage): void {
    return this.model.mAddNotification({ message, level: Severity.Error });
  }

  public status(message: NotificationMessage, options?: IStatusMessageOptions): void {
    return this.model.mAddStatusMessage({ message, statusOptions: options, level: Severity.Info });
  }
  public notify(notification: INotification): void {
    return this.model.mAddNotification(notification);
  }
}
