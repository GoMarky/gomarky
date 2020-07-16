import { HTTPRequest, ResponseInstance } from '@/gm/platform/request/common/request';
import { ENDPOINTS } from '@/gm/platform/request/common/endpoints';
import { ISessionInfoRequestResponse } from '@/gm/platform/session/common/session';

export const SESSION_INFO_REQUEST_ID = 'session.info';

export interface ISessionInfoRequestAttributes {
  sessionId: string;
}

export class SessionInfo extends HTTPRequest<
  ISessionInfoRequestAttributes,
  ISessionInfoRequestResponse,
  ISessionInfoRequestResponse
> {
  public attributes: ISessionInfoRequestAttributes;

  protected readonly endpoint: string = ENDPOINTS.SESSION_INFO;
  public readonly id = SESSION_INFO_REQUEST_ID;

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
