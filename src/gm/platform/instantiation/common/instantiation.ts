import { ServiceCollection } from '@/gm/platform/instantiation/common/ServiceCollection';

export const serviceIds = new Map<string, IServiceIdentifier<any>>();

export const DI_TARGET = '$di$target';
export const DI_DEPENDENCIES = '$di$dependencies';

export type BrandedService = { _serviceBrand: undefined };

export function getServiceDependencies(
  ctor: any
): { id: IServiceIdentifier<any>; index: number; optional: boolean }[] {
  return ctor[DI_DEPENDENCIES] || [];
}

export class SyncDescriptor<T> {
  readonly ctor: any;
  readonly staticArguments: any[];
  readonly supportsDelayedInstantiation: boolean;

  constructor(ctor: new (...args: any[]) => T, staticArguments: any[] = []) {
    this.ctor = ctor;
    this.staticArguments = staticArguments;
  }
}

export interface IServiceIdentifier<T> {
  (...args: any[]): void;

  type: T;
}

export class InstantiationService implements IInstantiationService {
  private readonly _services: ServiceCollection;
  private readonly _strict: boolean;
  private readonly _parent?: InstantiationService;

  constructor(
    services: ServiceCollection = new ServiceCollection(),
    strict = false,
    parent?: InstantiationService
  ) {
    this._services = services;
    this._strict = strict;
    this._parent = parent;

    this._services.set(IInstantiationService, this);
  }

  public createChild(services: ServiceCollection): IInstantiationService {
    return new InstantiationService(services, this._strict, this);
  }

  public createInstance<T>(ctor: any, ...args: any[]): T {
    const instance = this._createInstance<T>(ctor, args);

    // eslint-disable-next-line @typescript-eslint/ban-ts-ignore
    // @ts-ignore
    if (instance.serviceBrand) {
      // eslint-disable-next-line @typescript-eslint/ban-ts-ignore
      // @ts-ignore
      this._services.set(instance.serviceBrand, instance);
    }

    return instance;
  }

  public createInstance2<T>(ctor: any, id: IServiceIdentifier<any>): T {
    const instance = this._createInstance<T>(ctor);

    this._services.set(id, instance);

    return instance;
  }

  private _createInstance<T>(ctor: any, args: any[] = []): T {
    const serviceDependencies = getServiceDependencies(ctor).sort((a, b) => a.index - b.index);

    const serviceArgs: any[] = [];

    for (const dependency of serviceDependencies) {
      const service = this.getServiceInstance(dependency.id);
      if (!service && this._strict && !dependency.optional) {
        throw new Error(
          `[createInstance] ${ctor.name} depends on UNKNOWN service ${dependency.id}.`
        );
      }

      serviceArgs.push(service);
    }

    const finalArgs = [...[...args, ...serviceArgs]];

    return <T>new ctor(...finalArgs);
  }

  private getServiceInstance(id: IServiceIdentifier<any>) {
    const service = this._services.get(id);

    if (service) {
      return service;
    }
  }

  public invokeFunction<R, TS extends any[] = []>(
    fn: (accessor: IServicesAccessor, ...args: TS) => R,
    ...args: TS
  ): R {
    let _done = false;

    try {
      const accessor: IServicesAccessor = {
        get: <T>(id: ServiceIdentifier<T>) => {
          if (_done) {
            console.warn(
              'service accessor is only valid during the invocation of its target method'
            );
          }

          const result = this._services.get(id);
          if (!result) {
            throw new Error(`[invokeFunction] unknown service '${id}'`);
          }

          return result;
        },
      };

      return (fn as any).apply(undefined, [accessor, ...args]);
    } finally {
      _done = true;
    }
  }
}

function storeServiceDependency(
  id: () => void,
  target: any,
  index: number,
  optional: boolean
): void {
  if (target[DI_TARGET] === target) {
    target[DI_DEPENDENCIES].push({ id, index, optional });
  } else {
    target[DI_DEPENDENCIES] = [{ id, index, optional }];
    target[DI_TARGET] = target;
  }
}

export interface ServiceIdentifier<T> {
  (...args: any[]): void;

  type: T;
}

export function createDecorator<T>(serviceId: string): IServiceIdentifier<T> {
  if (serviceIds.has(serviceId)) {
    return serviceIds.get(serviceId)!;
  }

  // tslint:disable-next-line:only-arrow-functions
  const id = <any>function(target: () => void, _key: string, index: number): any {
    if (arguments.length !== 3) {
      throw new Error('@IServiceName-decorator can only be used to decorate a parameter');
    }
    storeServiceDependency(id, target, index, false);
  };

  id.toString = () => serviceId;

  serviceIds.set(serviceId, id);

  return id;
}

export interface IServicesAccessor {
  get<T>(id: IServiceIdentifier<T>): T;
}

export interface IInstantiationService {
  createChild(services: ServiceCollection): IInstantiationService;

  invokeFunction<R, TS extends any[] = []>(
    fn: (accessor: IServicesAccessor, ...args: TS) => R,
    ...args: TS
  ): R;

  createInstance<T>(ctor: any, ...args: any[]): T;
  createInstance2<T>(ctor: any, id: IServiceIdentifier<any>): T;
}

export const IInstantiationService = createDecorator<IInstantiationService>('instantiationService');
