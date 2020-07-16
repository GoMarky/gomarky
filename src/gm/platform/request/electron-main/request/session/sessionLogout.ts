import { HTTPRequest, ResponseInstance } from '@/gm/platform/request/common/request';
import { ENDPOINTS } from '@/gm/platform/request/common/endpoints';

export interface ISessionLogoutRequestResponse {
  status: string;
}

export interface ISessionLogoutRequestAttributes {
  sessionId: string;
}

export const SESSION_LOGOUT_REQUEST_ID = 'session.logout';

export class SessionLogout extends HTTPRequest<
  ISessionLogoutRequestAttributes,
  ISessionLogoutRequestResponse,
  ISessionLogoutRequestResponse
> {
  public attributes: ISessionLogoutRequestAttributes;

  protected readonly endpoint: string = ENDPOINTS.SESSION_LOGOUT;

  public readonly id = SESSION_LOGOUT_REQUEST_ID;

  constructor() {
    super();

    this.host = 'client';
  }

  public async handle(): Promise<
    ResponseInstance<ISessionLogoutRequestResponse, ISessionLogoutRequestResponse>
  > {
    const response = await this.post(this.endpoint, this.getAttributes());

    return this.doHandle(response);
  }
}
