import { Layer } from '@/core/objects/geometry/layer/layer';
import { TextureImage } from '@/core/objects/textures/image';
import { TextureVideo } from '@/core/objects/textures/video';
import { Container } from '@/core/objects/geometry/container/container';

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
