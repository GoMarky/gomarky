import { createDecorator } from '@/gm/platform/instantiation/common/instantiation';
import { Disposable } from '@/gm/base/common/lifecycle';
import { VuexStoreError } from '@/gm/platform/store/common/store';

import { Barrier } from '@/gm/base/common/async';
import { getModule } from 'vuex-module-decorators';
import { ILogService } from '@/gm/platform/log/common/log';

export interface IStoreService {
  /**
   * @author Teodor_Dre <swen295@gmail.com>
   *
   * @description
   *  Getting module.
   *
   * @returns T
   */
  getModule<T>(namespace: string): T;

  /**
   * @author Teodor_Dre <swen295@gmail.com>
   *
   * @description
   *  Getting module.
   *
   * @returns T[]
   */
  getModules<T1>(...namespaces: string[]): [T1];
  getModules<T1, T2>(...namespaces: string[]): [T1, T2];
  getModules<T1, T2, T3>(...namespaces: string[]): [T1, T2, T3];
  getModules<T1, T2, T3, T4>(...namespaces: string[]): [T1, T2, T3, T4];
  getModules<T1, T2, T3, T4, T5>(...namespaces: string[]): [T1, T2, T3, T4, T5];

  /**
   * @author Teodor_Dre <swen295@gmail.com>
   *
   * @description
   *  Create and register store module
   *
   * @param {string} namespace - name of module.
   * @param {any} module
   *
   * @returns void
   */
  registerModule(namespace: string, module: any): void;
  /**
   * @author Teodor_Dre <swen295@gmail.com>
   *
   * @description
   *  Return promise that resolves when module with specified name will registered.
   *
   * @param {string} namespace - name of module.
   *
   * @returns Promise<T>
   */
  whenModuleRegister<T>(namespace: string): Promise<T>;
}

export const IStoreService = createDecorator<IStoreService>('storeService');

export class StoreService extends Disposable implements IStoreService {
  private _modules: Map<string, any> = new Map<string, any>();
  private _resolvers: Map<string, Barrier> = new Map<string, Barrier>();

  public readonly serviceBrand = IStoreService;

  constructor(@ILogService private readonly logService: ILogService) {
    super();
  }

  public async whenModuleRegister<T>(namespace: string): Promise<T> {
    if (this._modules.has(namespace)) {
      return Promise.resolve(this._modules.get(namespace));
    }

    let resolver = this._resolvers.get(namespace);

    if (!resolver) {
      resolver = new Barrier();
      this._resolvers.set(namespace, resolver);
    }

    await resolver.wait();

    return this._modules.get(namespace);
  }

  public registerModule(namespace: string, module: any): void {
    if (this._modules.has(namespace)) {
      throw new VuexStoreError(`Module ${namespace} already registered`);
    }

    const Module = getModule(module);

    this._modules.set(namespace, Module);

    if (this._resolvers.has(namespace)) {
      const resolver = this._resolvers.get(namespace) as Barrier;

      resolver.open();
    }
  }

  public getModules<T1, T2, T3, T4, T5>(
    ...namespaces: string[]
  ): [T1] & [T1, T2] & [T1, T2, T3] & [T1, T2, T3, T4] & [T1, T2, T3, T4, T5] {
    const _modules = [];

    if (namespaces.length >= 6) {
      this.logService.info(
        `StoreService#getMultipleModules`,
        'Method supports only 5 or less quantity typings. Check IStoreService interfaces for more information'
      );
    }

    for (const namespace of namespaces) {
      if (!this._modules.has(namespace)) {
        throw new VuexStoreError(
          `Modules ${namespace} has not found. Are you sure in agreement with lifecycle hooks?`
        );
      }

      const module = this._modules.get(namespace);

      _modules.push(module);
    }

    return _modules as any;
  }

  public getModule<T>(namespace: string): T {
    if (!this._modules.has(namespace)) {
      throw new VuexStoreError(`Module ${namespace} has not found`);
    }

    return this._modules.get(namespace);
  }
}
