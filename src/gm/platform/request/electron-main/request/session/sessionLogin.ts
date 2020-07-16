import { HTTPRequest, ResponseInstance } from '@/gm/platform/request/common/request';
import { ENDPOINTS } from '@/gm/platform/request/common/endpoints';

import {
  ISessionInfoRequestResponse,
  ISessionLoginCredentials,
} from '@/gm/platform/session/common/session';

export const SESSION_LOGIN_REQUEST_ID = 'session.login';

export class SessionLogin extends HTTPRequest<
  ISessionLoginCredentials,
  ISessionInfoRequestResponse,
  ISessionInfoRequestResponse
> {
  public attributes: ISessionLoginCredentials;
  public readonly id = SESSION_LOGIN_REQUEST_ID;

  protected readonly endpoint: string = ENDPOINTS.SESSION_LOGIN;

  constructor() {
    super();

    this.host = 'client';
  }

  public async handle(): Promise<
    ResponseInstance<ISessionInfoRequestResponse, ISessionInfoRequestResponse>
  > {
    const response = await this.post(this.endpoint, this.getAttributes());

    return this.doHandle(response);
  }
}
