import { createDecorator } from '@/gm/platform/instantiation/common/instantiation';
import { Disposable } from '@/gm/base/common/lifecycle';
import { IChannel, IServerChannel } from '@/gm/base/parts/ipc/common/ipc';

import { ChannelServer, Client } from '@/gm/platform/ipc/electron-browser/ipcClient';

export const IMainProcessService = createDecorator<IMainProcessService>('mainProcessService');

export interface IMainProcessService {
  getChannel(channelName: string): IChannel;

  registerChannel(channelName: string, channel: IServerChannel<string>): void;
}

export class MainProcessService extends Disposable implements IMainProcessService {
  public readonly serviceBrand = IMainProcessService;

  private mainProcessConnection: Client;
  private readonly channelServer: ChannelServer;

  constructor() {
    super();

    this.channelServer = new ChannelServer();

    this.mainProcessConnection = this._register(new Client(this.channelServer));
  }

  public getChannel(channelName: string): IChannel {
    return this.mainProcessConnection.getChannel(channelName);
  }

  public registerChannel(channelName: string, channel: IServerChannel<string>): void {
    this.mainProcessConnection.registerChannel(channelName, channel);
  }
}
