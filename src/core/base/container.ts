import { Geometry } from '@/gl/gomarky/core/geometry/geometry/geometry';
import { Container, ContainerGroup } from '@/gl/gomarky';

export interface ICreateContainerOptions {
  geometry: Geometry;
}

export type CommonContainer = Container | ContainerGroup;
