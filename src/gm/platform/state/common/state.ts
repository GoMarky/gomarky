import { createDecorator } from '@/gm/platform/instantiation/common/instantiation';
import { IWindowState } from '@/gm/platform/window/electron-main/window';
import { UnloadReason } from '@/gm/platform/lifecycle/common/lifecycle';
import { Event } from '@/gm/base/common/event';

export const IStateService = createDecorator<IStateService>('stateService');

export enum WillSaveStateReason {
  NONE = 0,
  SHUTDOWN = 1,
}

export interface IWillSaveStateEvent {
  reason: WillSaveStateReason;
}

export interface IStateService {
  readonly onWillSaveState: Event<IWillSaveStateEvent>;

  getItem<T>(key: keyof IStateServiceStorageSchema, defaultValue: T): T;

  getItem<T>(key: keyof IStateServiceStorageSchema, defaultValue?: T): T | undefined;

  setItem(
    key: keyof IStateServiceStorageSchema,
    data?: object | string | number | boolean | undefined | null,
    reason?: WillSaveStateReason
  ): void;

  removeItem(key: keyof IStateServiceStorageSchema): void;
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface IStateServiceStorageSchema {
}

export interface IRestoredSessionState {
  sessionId: string;
}
