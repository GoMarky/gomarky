import { Disposable } from '@/gm/base/common/lifecycle';
import { IServerChannel } from '@/gm/base/parts/ipc/common/ipc';
import { ipcMain } from 'electron';

import { IWindowsMainService } from '@/gm/platform/windows/electron-main/windows';

export class IPCServerError extends Error {
  public readonly name = 'IPCServerError';
}

export class IPCServer extends Disposable {
  private channels = new Map<string, IServerChannel>();

  constructor(private readonly windowsService: IWindowsMainService) {
    super();
  }

  /**
   * @description
   * TODO:
   *  Make correct implementation
   *
   *  @deprecated
   */
  public getChannel(): any {}

  public registerChannel(channelName: string, channel: IServerChannel) {
    if (this.channels.has(channelName)) {
      throw new IPCServerError(`Channel ${channelName} already registered`);
    }

    if (channel.calls) {
      for (const call of Object.values(channel.calls)) {
        ipcMain.handle(`${channelName}:${call}`, (_: unknown, arg) => {
          return channel.call(call, arg);
        });
      }
    }

    if (channel.events) {
      for (const eventBody of Object.values(channel.events)) {
        const event = channel.listen('', eventBody.name);
        const eventName = `${channelName}:${eventBody.name}`;

        event((arg: any) => {
          this.windowsService.sendToAll(eventName, arg);
        });
      }
    }

    console.info(`IPCServer#registerChannel - Channel ${channelName} registered`);

    this.channels.set(channelName, channel);
  }
}
