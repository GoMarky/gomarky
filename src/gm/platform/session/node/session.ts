import { IServerChannel } from '@/gm/base/parts/ipc/common/ipc';
import { Event } from '@/gm/base/common/event';
import { ISessionService } from '@/gm/platform/session/common/session';

const calls = {
  login: 'login',
};

export class SessionChannel implements IServerChannel {
  public readonly calls = calls;

  constructor(private service: ISessionService) {}

  public listen<T>(_: unknown, event: string): Event<T> {
    throw new Error(`Event not found: ${event}`);
  }

  public call(command: string, arg?: any): Promise<any> {
    switch (command) {
      case calls.login:
        return this.service.login(arg);
    }

    throw new Error(`Call not found: ${command}`);
  }
}
