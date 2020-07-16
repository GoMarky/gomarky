import { IServerChannel } from '@/gm/base/parts/ipc/common/ipc';
import { Event } from '@/gm/base/common/event';
import { IStateService, IWillSaveStateEvent } from '@/gm/platform/state/common/state';

const calls = {
  setItem: 'setItem',
  getItem: 'getItem',
  removeItem: 'removeItem',
};

const events = {
  onWillSaveState: { name: 'onWillSaveState', toAll: true },
};

export class StateServiceChannel implements IServerChannel {
  public readonly calls = calls;
  public readonly events = events;

  private readonly onWillSaveState: Event<IWillSaveStateEvent>;

  constructor(@IStateService private readonly service: IStateService) {
    this.onWillSaveState = Event.bumper(service.onWillSaveState);
  }

  public listen(_: unknown, event: string): Event<any> {
    switch (event) {
      case events.onWillSaveState.name:
        return this.onWillSaveState;
    }

    throw new Error(`Event not found: ${event}`);
  }

  public async call(command: string, arg?: any): Promise<any> {
    switch (command) {
      case calls.setItem:
        // eslint-disable-next-line @typescript-eslint/ban-ts-ignore
        // @ts-ignore
        return this.service.setItem(arg[0], arg[1], arg[2]);
      case calls.getItem:
        // eslint-disable-next-line @typescript-eslint/ban-ts-ignore
        // @ts-ignore
        return this.service.getItem(arg[0], arg[1]);
      case calls.removeItem:
        // eslint-disable-next-line @typescript-eslint/ban-ts-ignore
        // @ts-ignore
        return this.service.removeItem(arg);
    }

    throw new Error(`Call not found: ${command}`);
  }
}
