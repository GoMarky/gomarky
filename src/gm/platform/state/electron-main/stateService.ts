import {
  IStateService,
  IStateServiceStorageSchema,
  IWillSaveStateEvent,
  WillSaveStateReason,
} from '@/gm/platform/state/common/state';

import { SingleStorage } from '@/gm/platform/storage/electron-main/storage';
import { IEnvironmentService } from '@/gm/platform/env/node/environmentService';
import { Emitter, Event } from '@/gm/base/common/event';
import { Disposable } from '@/gm/base/common/lifecycle';

export class StateService extends Disposable implements IStateService {
  private fileStorage: SingleStorage<IStateServiceStorageSchema>;

  private readonly _onWillSaveState = this._register(new Emitter<IWillSaveStateEvent>());
  public readonly onWillSaveState: Event<IWillSaveStateEvent> = this._onWillSaveState.event;

  constructor(@IEnvironmentService environmentService: IEnvironmentService) {
    super();

    this.fileStorage = new SingleStorage<IStateServiceStorageSchema>({
      name: 'gomarky-global',
      cwd: environmentService.userDataPath,
      schema: {},
    });
  }

  public getItem<T>(key: keyof IStateServiceStorageSchema, defaultValue: T): T;
  public getItem<T>(key: keyof IStateServiceStorageSchema, defaultValue?: T): T | undefined;
  public getItem(key: keyof IStateServiceStorageSchema, defaultValue?: any): any {
    return this.fileStorage.get(key, defaultValue);
  }

  public removeItem(key: keyof IStateServiceStorageSchema): void {
    return this.fileStorage.remove(key);
  }

  public setItem(
    key: keyof IStateServiceStorageSchema,
    data?: object | string | number | boolean | undefined | null,
    reason: WillSaveStateReason = WillSaveStateReason.NONE
  ): void {
    this._onWillSaveState.fire({ reason });

    return this.fileStorage.set(key, data);
  }
}
