import { Disposable } from '@/gm/base/common/lifecycle';
import { ISessionLoginCredentials, ISessionService } from '@/gm/platform/session/common/session';
import { ISessionMainService } from '@/gm/platform/session/electron-main/session';

export class SessionService extends Disposable implements ISessionService {
  constructor(@ISessionMainService private readonly sessionMainService: ISessionMainService) {
    super();
  }

  public async login(credentials: ISessionLoginCredentials): Promise<void> {
    return this.sessionMainService.login(credentials);
  }

  public async logout(): Promise<void> {
    return this.sessionMainService.logout();
  }
}
