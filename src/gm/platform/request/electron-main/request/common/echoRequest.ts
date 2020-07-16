import { HTTPRequest, ResponseInstance } from '@/gm/platform/request/common/request';
import { ENDPOINTS } from '@/gm/platform/request/common/endpoints';

export interface IEchoRequestResponse {
  status: string;
}

export const ECHO_REQUEST_ID = 'common.echo';

export class EchoRequest extends HTTPRequest<null, IEchoRequestResponse, IEchoRequestResponse> {
  public attributes: null;

  protected readonly endpoint: string = ENDPOINTS.ECHO;

  public readonly id = ECHO_REQUEST_ID;

  constructor() {
    super();

    this.host = 'client';
  }

  public async handle(): Promise<ResponseInstance<IEchoRequestResponse, IEchoRequestResponse>> {
    const response = await this.get(this.endpoint);
    const responseInstance = new ResponseInstance<IEchoRequestResponse, IEchoRequestResponse>(
      response,
      this.id
    );

    const result = this.transformer.transform(response.data);

    responseInstance.setResult(result);

    return responseInstance;
  }
}
