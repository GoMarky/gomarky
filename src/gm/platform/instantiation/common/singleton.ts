import { ServiceIdentifier } from '@/gm/platform/instantiation/common/instantiation';

const singletons: [ServiceIdentifier<any>, any][] = [];

export function registerSingleton<T>(id: ServiceIdentifier<T>, ctor: any): void {
  singletons.push([id, ctor]);
}

export function getSingletonServiceDescriptors(): [ServiceIdentifier<any>, any][] {
  return singletons;
}
