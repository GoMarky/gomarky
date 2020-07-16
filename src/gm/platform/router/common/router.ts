import { createDecorator } from '@/gm/platform/instantiation/common/instantiation';
import VueRouter, { RawLocation, Route } from 'vue-router';
import { Barrier } from '@/gm/base/common/async';

export interface IRouterService {
  push(location: RawLocation): Promise<Route>;
  go(n: number): void;

  loadRouter(router: VueRouter): void;
  router: VueRouter;
  readonly completeRouterBarrier: Barrier;
}

export const IRouterService = createDecorator<IRouterService>('routerService');
