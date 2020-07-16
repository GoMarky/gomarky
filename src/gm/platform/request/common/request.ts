import axios, { AxiosInstance, AxiosPromise, AxiosResponse } from 'axios';
import { Disposable } from '@/gm/base/common/lifecycle';
import { BaseTransformer } from '@/gm/platform/request/common/transformer';

const DEFAULT_TIMEOUT_TIME = 15000;

export function isApiErrorResponse(response: any): response is IErrorResponse {
  return response.result === 'error';
}

export enum APIError {
  InvalidAuthData = 1,
  UnexpectedError = 25,
}

export interface IErrorResponse {
  result: 'error';
  code: APIError;
  message: string;
}

export class ResponseInstance<T, R> extends Disposable {
  public result: R;
  public hasError = false;

  constructor(public readonly response: AxiosResponse<T>, public readonly requestName?: string) {
    super();
  }

  public setResult(result: R): void {
    this.result = result;
  }

  public getOriginalResult(): AxiosResponse<T> {
    return this.response;
  }
}

type EndpointMethod = (...args: (string & object & boolean & number)[]) => string;

export abstract class HTTPRequest<
  TAttributes = unknown,
  TResponse = unknown,
  TReturn = unknown,
  TError = IErrorResponse
> {
  protected host: string;
  protected readonly axios: AxiosInstance;

  public abstract id: string;

  public abstract attributes: TAttributes;
  public transformer: BaseTransformer;

  protected abstract readonly endpoint: string | EndpointMethod;

  protected constructor() {
    this.axios = axios.create({
      timeout: DEFAULT_TIMEOUT_TIME,
    });

    this.transformer = BaseTransformer.createNullInstance();
  }

  public setEndpoints(endpoint: string): this {
    this.host = endpoint;

    if (this.axios && this.host) {
      this.axios.defaults.baseURL = this.host;
    }

    return this;
  }

  public setAttributes(attributes: TAttributes): this {
    this.attributes = attributes;

    return this;
  }

  public getAttribute(key: keyof TAttributes): TAttributes[keyof TAttributes] | null {
    if (this.attributes && ((this.attributes as unknown) as object).hasOwnProperty(key)) {
      return this.attributes[key];
    }

    return null;
  }

  public getAttributes(): TAttributes | null {
    if (this.attributes) {
      return this.attributes;
    }

    return null;
  }

  public setTransformer(transformer?: BaseTransformer): this {
    this.transformer = transformer || this.transformer;

    return this;
  }

  public abstract handle(): Promise<ResponseInstance<TResponse, TReturn | TError>>;

  protected doHandle<T, R>(response: AxiosResponse<T>): ResponseInstance<T, R> {
    const responseInstance = new ResponseInstance<T, R>(response, this.id);

    let result;

    if (isApiErrorResponse(response.data)) {
      responseInstance.hasError = true;
      result = response.data;
    } else {
      result = this.transformer.transform(response.data);
    }

    responseInstance.setResult(result);

    return responseInstance;
  }

  protected get(url: string, config?: object): AxiosPromise<TResponse> {
    return this.axios.get(url, {
      ...config,
      baseURL: this.host,
    });
  }

  protected post(url: string, data: TAttributes | null, config?: object): AxiosPromise<TResponse> {
    return this.axios.post(url, data, {
      ...config,
      baseURL: this.host,
    });
  }
}
