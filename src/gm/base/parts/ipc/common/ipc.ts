import { Event } from '@/gm/base/common/event';

export interface IChannel {
  call<T>(command: string, arg?: any): Promise<T>;

  listen(event: string, arg?: any): any;
}

export interface IServerChannel<TContext = string> {
  calls: object;
  events?: object;

  call<T>(command: string, arg?: any): Promise<T>;

  listen<T>(ctx: TContext, event: string, arg?: any): Event<T>;
}
