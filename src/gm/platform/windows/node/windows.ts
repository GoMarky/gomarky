import { IServerChannel } from '@/gm/base/parts/ipc/common/ipc';
import { Event } from '@/gm/base/common/event';
import { IPCWindowsChannelError, IWindowsService } from '@/gm/platform/windows/common/windows';

type WindowsCall = {
  [key in keyof IWindowsService]: keyof IWindowsService;
};

/**
 * TODO:
 *  Implement all methods from WindowsService
 */

// eslint-disable-next-line @typescript-eslint/ban-ts-ignore
// @ts-ignore
const calls: WindowsCall = {
  showMessageBox: 'showMessageBox',
  openAboutDialog: 'openAboutDialog',
  pick: 'pick',
  openDevTools: 'openDevTools',
  enterWorkspace: 'enterWorkspace',
  toggleDevTools: 'toggleDevTools',
  createWindowAndEnterWorkspace: 'createWindowAndEnterWorkspace',
  createAndEnterWorkspace: 'createAndEnterWorkspace',
  toggleFullScreen: 'toggleFullScreen',
  maximize: 'maximize',
};

const events = {
  onWindowFocus: { name: 'onWindowFocus', toAll: true },
  onRecentlyOpenedChange: { name: 'onRecentlyOpenedChange', toAll: true },
};

export class WindowsChannel implements IServerChannel {
  public readonly calls = calls;
  public readonly events = events;

  private readonly onWindowFocus: Event<number>;
  private readonly onRecentlyOpenedChange: Event<void>;

  constructor(private service: IWindowsService) {
    this.onWindowFocus = Event.bumper(service.onWindowFocus);
    this.onRecentlyOpenedChange = Event.bumper(service.onRecentlyOpenedChange, false);
  }

  public listen(_: unknown, event: string): Event<any> {
    switch (event) {
      case events.onWindowFocus.name:
        return this.onWindowFocus;
      case events.onRecentlyOpenedChange.name:
        return this.onRecentlyOpenedChange;
    }

    throw new IPCWindowsChannelError(`Event not found: ${event}`);
  }

  public async call(command: string, arg?: any): Promise<any> {
    switch (command) {
      case calls.showMessageBox:
        return this.service.showMessageBox(arg[0], arg[1]);
      case calls.openAboutDialog:
        return this.service.openAboutDialog();
      case calls.openDevTools:
        return this.service.openDevTools(arg[0], arg[1]);
      case calls.pick:
        return this.service.pick(arg[0]);
      case calls.enterWorkspace:
        return this.service.enterWorkspace(arg[0]);
      case calls.toggleDevTools:
        return this.service.toggleDevTools(arg);
      case calls.createWindowAndEnterWorkspace:
        return this.service.createWindowAndEnterWorkspace(arg);
      case calls.toggleFullScreen:
        return this.service.toggleFullScreen(arg);
      case calls.maximize:
        return this.service.maximize(arg);
      case calls.createAndEnterWorkspace:
        await this.service.createAndEnterWorkspace(arg);

        return;
    }

    throw new IPCWindowsChannelError(`Call not found: ${command}`);
  }
}
