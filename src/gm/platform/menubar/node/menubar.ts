import { IMenubarService, IPCMenubarChannelError } from '@/gm/platform/menubar/common/menubar';
import { IServerChannel } from '@/gm/base/parts/ipc/common/ipc';
import { Event } from '@/gm/base/common/event';

type MenubarCall = {
  [key in keyof IMenubarService]: keyof IMenubarService;
};

/**
 * TODO:
 *  Implement all methods from IMenubarService
 */

// eslint-disable-next-line @typescript-eslint/ban-ts-ignore
// @ts-ignore
const calls: MenubarCall = {
  updateMenubar: 'updateMenubar',
};

export class MenubarChannel implements IServerChannel {
  public readonly calls = calls;

  constructor(private service: IMenubarService) {}

  public listen<T>(_: unknown, event: string): Event<T> {
    throw new IPCMenubarChannelError(`Event not found: ${event}`);
  }

  public call(command: string, arg?: any): Promise<any> {
    switch (command) {
      case calls.updateMenubar:
        return this.service.updateMenubar(arg[0], arg[1]);
    }

    throw new IPCMenubarChannelError(`Call not found: ${command}`);
  }
}
