import { Disposable } from '@/gm/base/common/lifecycle';
import { ISessionLoginCredentials, ISessionService } from '@/gm/platform/session/common/session';
import { IMainProcessService } from '@/gm/platform/ipc/electron-browser/mainProcessService';

import { IChannel } from '@/gm/base/parts/ipc/common/ipc';

export class SessionService extends Disposable implements ISessionService {
  private channel: IChannel;

  constructor(@IMainProcessService mainProcessService: IMainProcessService) {
    super();

    this.channel = mainProcessService.getChannel('session');
  }

  public async login(credentials: ISessionLoginCredentials): Promise<void> {
    return this.channel.call('login', credentials);
  }

  public async logout(): Promise<void> {
    return this.channel.call('logout');
  }

  public serviceBrand: ISessionService;
}
