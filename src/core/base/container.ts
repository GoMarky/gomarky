import { Geometry } from '@/core/objects/geometry/geometry/geometry';
import { Container } from '@/core/objects/geometry/container/container';
import { ContainerGroup } from '@/core/objects/geometry/container/containerGroup';

export interface ICreateContainerOptions {
  geometry: Geometry;
}

export type CommonContainer = Container | ContainerGroup;
