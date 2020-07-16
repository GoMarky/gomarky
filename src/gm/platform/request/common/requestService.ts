import { createDecorator } from '@/gm/platform/instantiation/common/instantiation';

import { Event } from '@/gm/base/common/event';
import {
  IAdditionalDataInterceptor,
  IBeforeRequestInterceptor,
  IErrorInterceptor,
} from '@/gm/platform/request/common/interceptor';
import { BaseTransformer } from '@/gm/platform/request/common/transformer';
import { IErrorResponse, ResponseInstance } from '@/gm/platform/request/common/request';

import { Class } from '@/gm/typings/utils';

export const IRequestService = createDecorator<IRequestService>('requestService');

export interface IRequestRegister {
  id: string;
  ctor: Class;
}

export interface IRequestService {
  onDidAPIError: Event<void>;

  /**
   * @description
   * [RU] Добавляет функцию перехватчик в массив, которая выполнится в случае если один из
   * запросов отвалится с ошибкой.
   *
   * @see {RequestService.call}
   *
   * @returns void
   * @param interceptor
   */
  addErrorInterceptor(interceptor: IErrorInterceptor): void;

  /**
   * @description
   * [RU] Добавляет функцию перехватчик в массив, которая будет выполняться
   * непосредственном перед запросом в ApiService.call()
   *
   * @see {RequestService.call}
   *
   * @returns void
   * @param interceptor
   */
  addBeforeRequestInterceptor(interceptor: IBeforeRequestInterceptor): void;

  /**
   * @description
   * [RU] Добавляет функцию перехватчик в массив, которая будет добавлять дополнительную информацию новому запроск;
   *
   * @see {RequestService.call}
   *
   * @returns void
   * @param interceptor
   */
  addAdditionalDataMakers(interceptor: IAdditionalDataInterceptor): void;

  /**
   * [RU] Убирает функцию перехватчик из списка перехватчиков
   *
   * @see {RequestService.call}
   *
   * @returns void
   * @param interceptor
   */
  removeErrorInterceptor(interceptor: IErrorInterceptor): void;

  /**
   * @description
   * [RU] Убирает функцию перехватчик из списка перехватчиков
   *
   * @see {RequestService.call}
   *
   * @returns void
   * @param interceptor
   */
  removeBeforeRequestInterceptor(interceptor: IBeforeRequestInterceptor): void;

  /**
   * @description
   * [RU] Убирает функцию перехватчик из списка перехватчиков
   *
   * @see {RequestService.call}
   *
   * @param interceptor
   */
  removeAdditionalDataMaker(interceptor: IAdditionalDataInterceptor): void;

  /**
   * @description
   * [RU] Вызывает API запрос.
   *
   * @param {string} request
   * @param {object} [data={}]
   * @param {object | null} [transformer=null]
   * @returns Promise<any>
   */
  call<TAttributes, TResponse, TReturn, TError = IErrorResponse>(
    request: string,
    data?: TAttributes,
    transformer?: BaseTransformer
  ): Promise<ResponseInstance<TResponse, TReturn | TError>>;

  registerRequest(requestStringName: string, request: Class): boolean;

  registerRequests(requests: IRequestRegister[]): boolean;
}
