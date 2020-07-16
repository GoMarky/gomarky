import { Disposable, IDisposable } from '@/gm/base/common/lifecycle';
import { IChannel, IServerChannel } from '@/gm/base/parts/ipc/common/ipc';
import { ipcRenderer } from 'electron';

/**
 * @description
 * TODO:
 *  Make it more flexible. (Should can working with multiple renderer instances)
 */

export class Client extends Disposable {
  constructor(private readonly channelServer: ChannelServer) {
    super();
  }

  public getChannel(channelName: string): IChannel {
    const self = this;

    return {
      call(command: string, arg?: any) {
        return ipcRenderer.invoke(`${channelName}:${command}`, arg);
      },
      listen(event: string, emitter: any) {
        const eventName = `${channelName}:${event}`;

        ipcRenderer.on(eventName, (_: unknown, arg: any) => {
          emitter.fire(arg);
        });
      },
    };
  }

  public registerChannel(channelName: string, channel: IServerChannel<string>): void {
    return this.channelServer.registerChannel(channelName, channel);
  }
}

export class ChannelServer<TContext = string> extends Disposable implements IDisposable {
  private channels = new Map<string, IServerChannel<TContext>>();

  constructor() {
    super();
  }

  public registerChannel(channelName: string, channel: IServerChannel<TContext>) {
    if (this.isChannelRegistered(channelName)) {
      console.warn(`ChannelServer#registerChannel - Channel ${channelName} already registered`);

      return;
    }

    this.channels.set(channelName, channel);
  }

  public isChannelRegistered(channelName: string): boolean {
    return this.channels.has(channelName);
  }
}
