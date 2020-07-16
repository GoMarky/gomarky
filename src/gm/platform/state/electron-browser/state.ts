import { IMainProcessService } from '@/gm/platform/ipc/electron-browser/mainProcessService';
import { IChannel } from '@/gm/base/parts/ipc/common/ipc';
import { Emitter, Event } from '@/gm/base/common/event';

import {
  IStateService,
  IStateServiceStorageSchema,
  IWillSaveStateEvent,
  WillSaveStateReason,
} from '@/gm/platform/state/common/state';

export class StateService implements IStateService {
  private channel: IChannel;
  private _onWillSaveState = new Emitter<IWillSaveStateEvent>();

  public readonly serviceBrand = IStateService;

  constructor(@IMainProcessService mainProcessService: IMainProcessService) {
    this.channel = mainProcessService.getChannel('state');

    this.channel.listen('onWillSaveState', this._onWillSaveState);
  }

  public get onWillSaveState(): Event<IWillSaveStateEvent> {
    return this._onWillSaveState.event;
  }

  public getItem<T>(key: keyof IStateServiceStorageSchema, defaultValue: T): T;
  public getItem<T>(key: keyof IStateServiceStorageSchema, defaultValue?: T): T | undefined;
  public getItem(key: keyof IStateServiceStorageSchema, defaultValue?: any): any {
    return this.channel.call('getItem', [key, defaultValue]);
  }

  public removeItem(key: keyof IStateServiceStorageSchema): Promise<void> {
    return this.channel.call('removeItem', key);
  }

  public setItem(
    key: keyof IStateServiceStorageSchema,
    data?: object | string | number | boolean | undefined | null,
    reason?: WillSaveStateReason
  ): Promise<void> {
    return this.channel.call('setItem', [key, data, reason]);
  }
}
