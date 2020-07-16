import { TextureImage } from '@/gl/gomarky/core/textures/image';
import { TextureVideo } from '@/gl/gomarky/core/textures/video';

import { Container } from '@/gl/gomarky/core/geometry/container/container';
import { Layer } from '@/gl/gomarky/core/geometry/layer/layer';

export type CurrentLayerProperty = Layer | null;
export type CurrentTextureProperty = TextureImage | TextureVideo | null;

export interface ITextureRenderEvent {
  texture: TextureImage | TextureVideo | null;
}

export interface IGeometryAddedEvent {
  geometry: Container;
}

export interface IGeometryRemoveEvent {
  geometry: Container;
}

export interface ICurrentGeometrySetEvent {
  geometry: any;
}
