import { Disposable } from '@/gm/base/common/lifecycle';
import { IRouterService } from '@/gm/platform/router/common/router';
import VueRouter, { RawLocation, Route } from 'vue-router';

import { ILifecycleService } from '@/gm/platform/lifecycle/common/lifecycle';
import { Barrier } from '@/gm/base/common/async';

export class RouterService extends Disposable implements IRouterService {
  private _router: VueRouter;
  public get router(): VueRouter {
    return this._router;
  }

  public readonly serviceBrand = IRouterService;
  public readonly completeRouterBarrier: Barrier = new Barrier();

  constructor(@ILifecycleService private readonly lifecycleService: ILifecycleService) {
    super();
  }

  public push(location: RawLocation): Promise<Route> {
    return this._router.push(location);
  }

  public go(n: number): void {
    return this._router.go(n);
  }

  public loadRouter(router: VueRouter): void {
    if (this.completeRouterBarrier.isOpen()) {
      return;
    }

    this._router = router;

    this.completeRouterBarrier.open();
  }
}
