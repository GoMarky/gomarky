import { BaseTransformer } from '@/gm/platform/request/common/transformer';

export interface IErrorInterceptorOptions<TAttributes> {
  request: string;
  data?: TAttributes;
  transformer: BaseTransformer | undefined;
}

export interface IErrorInterceptor {
  catch<TAttributes, TResponse>(
    error: Error,
    requestInfo: IErrorInterceptorOptions<TAttributes>,
    requestData: TAttributes
  ): Promise<TResponse>;
}

export interface IBeforeRequestInterceptor {
  catch<T>(request: string, requestData?: T): void;
}

export interface IAdditionalDataInterceptor {
  catch<T>(request: string): T;
}
