import { IRequestRegister, IRequestService } from '@/gm/platform/request/common/requestService';

import { ILogService } from '@/gm/platform/log/common/log';

import { Emitter, Event } from '@/gm/base/common/event';
import { Disposable } from '@/gm/base/common/lifecycle';
import { IInstantiationService } from '@/gm/platform/instantiation/common/instantiation';
import {
  IAdditionalDataInterceptor,
  IBeforeRequestInterceptor,
  IErrorInterceptor,
} from '@/gm/platform/request/common/interceptor';
import { BaseTransformer } from '@/gm/platform/request/common/transformer';
import { HTTPRequest, ResponseInstance } from '@/gm/platform/request/common/request';
import { Class } from '@/gm/typings/utils';

export class RequestService extends Disposable implements IRequestService {
  private readonly requests: Map<string, HTTPRequest<any, any, any, any>> = new Map();

  private errorInterceptors: IErrorInterceptor[] = [];
  private beforeRequestInterceptors: IBeforeRequestInterceptor[] = [];
  private additionalDataMakers: IAdditionalDataInterceptor[] = [];

  private endpoint = 'http://localhost:8080/';

  private readonly _onDidAPIError: Emitter<void> = new Emitter<void>();
  readonly onDidAPIError: Event<void> = this._onDidAPIError.event;

  constructor(
    @ILogService private readonly logService: ILogService,
    @IInstantiationService private readonly instantiationService: IInstantiationService
  ) {
    super();
  }

  public addErrorInterceptor(interceptor: IErrorInterceptor): void {
    this.errorInterceptors.push(interceptor);
  }

  public addBeforeRequestInterceptor(interceptor: IBeforeRequestInterceptor): void {
    this.beforeRequestInterceptors.push(interceptor);
  }

  public addAdditionalDataMakers(interceptor: IAdditionalDataInterceptor): void {
    this.additionalDataMakers.push(interceptor);
  }

  public removeErrorInterceptor(interceptor: IErrorInterceptor): void {
    this.errorInterceptors = this.errorInterceptors.filter(
      errorInterceptor => errorInterceptor !== interceptor
    );
  }

  public removeBeforeRequestInterceptor(interceptor: IBeforeRequestInterceptor): void {
    this.beforeRequestInterceptors = this.beforeRequestInterceptors.filter(
      beforeRequestInterceptor => beforeRequestInterceptor !== interceptor
    );
  }

  public removeAdditionalDataMaker(interceptor: IAdditionalDataInterceptor): void {
    this.additionalDataMakers = this.additionalDataMakers.filter(
      additionalDataMaker => additionalDataMaker !== interceptor
    );
  }

  public async call<TAttributes, TResponse, TReturn, TError>(
    request: string,
    data?: TAttributes,
    transformer?: BaseTransformer
  ): Promise<ResponseInstance<TResponse, TReturn | TError>> {
    let additionalData;

    try {
      await Promise.all(
        this.beforeRequestInterceptors.map(beforeRequestInterceptor =>
          beforeRequestInterceptor.catch<TAttributes | undefined>(request, data)
        )
      );

      for (const additionalDataMaker of this.additionalDataMakers) {
        additionalData = additionalDataMaker.catch<any>(request);

        if (additionalData) {
          break;
        }
      }

      const response = await this.processRequest<
        TAttributes | undefined,
        TResponse,
        TReturn,
        TError
      >(request, data);

      const originalResult = response.getOriginalResult();

      if (response.hasError && originalResult.status > 400) {
        this._onDidAPIError.fire();

        throw response;
      }

      this.logService.info(
        `RequestService#call - executed ${request} request to: ${
          originalResult.request.responseURL
        }. Success: ${!response.hasError}`
      );

      return response;
    } catch (err) {
      for (const errorInterceptor of this.errorInterceptors) {
        const newResponse = await errorInterceptor.catch<TAttributes | undefined, TReturn>(
          err,
          {
            request,
            data,
            transformer,
          },
          additionalData
        );

        if (newResponse) {
          // eslint-disable-next-line @typescript-eslint/ban-ts-ignore
          // @ts-ignore
          return newResponse;
        }
      }

      throw err;
    }
  }

  public registerRequest(requestStringName: string, Ctor: Class): boolean {
    if (this.requests.has(requestStringName)) {
      this.logService.error(`Request ${requestStringName} already registered`);

      return false;
    }

    if (Ctor instanceof HTTPRequest) {
      this.logService.error(`Request ${Ctor} is not instance of HTTPRequest`);

      return false;
    }

    try {
      const instance = this.instantiationService.createInstance(Ctor);

      this.requests.set(
        requestStringName,
        instance as HTTPRequest<unknown, unknown, unknown, unknown>
      );
    } catch (error) {
      this.logService.error(
        `HTTPRequestService#registerRequest`,
        `Error when register request: ${error}`
      );

      return false;
    }

    return true;
  }

  public registerRequests(requests: IRequestRegister[]): boolean {
    return requests.every((request: IRequestRegister) =>
      this.registerRequest(request.id, request.ctor)
    );
  }

  private getRequestInstance<TAttributes, TResponse, TReturn, TError>(
    requestName: string
  ): HTTPRequest<TAttributes, TResponse, TReturn, TError> {
    const request = this.requests.get(requestName);

    if (!request) {
      throw new Error(`HTTPRequestService#processRequest - Request ${requestName} was not found`);
    }

    return request;
  }

  private async processRequest<TAttributes, TResponse, TReturn, TError>(
    requestName: string,
    data?: TAttributes,
    transformer?: BaseTransformer
  ): Promise<ResponseInstance<TResponse, TReturn | TError>> {
    const requestInstance = this.getRequestInstance<
      TAttributes | undefined,
      TResponse,
      TReturn,
      TError
    >(requestName);

    const response = await requestInstance
      .setAttributes(data)
      .setTransformer(transformer)
      .setEndpoints(this.endpoint)
      .handle();

    const originalResponse = response.getOriginalResult();

    if (originalResponse.status > 500) {
      const serverURL = originalResponse.config.baseURL as string;

      this.logService.error(`RequestService#processRequest - error with server ${serverURL}`);
    }

    return response;
  }
}
