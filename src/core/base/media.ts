import { URI } from '@/gm/base/common/uri';
import PIXI from 'pixi.js';
import { TextureVideo } from '@/gl/gomarky/core/textures/video';
import { TextureImage } from '@/gl/gomarky/core/textures/image';

export type CommonTexture = TextureVideo | TextureImage;

export interface ISerializedTexture {
  readonly source: string;

  readonly viewportWidth: number;
  readonly viewportHeight: number;

  readonly originalHeight: number;
  readonly originalWidth: number;
}

export interface ICreateTextureImageOption {
  source: URI;
  imageWidth: number;
  imageHeight: number;
}

export interface ITextureImage {
  sprite: PIXI.Sprite;
  texture: PIXI.Texture;

  toJSON(): ISerializedTexture;
}

export interface ICreateVideoTextureOptions {
  source: HTMLVideoElement;
  autoPlay?: boolean;
  scaleMode?: number;
  resource: URI;
}

export interface IVideoTexture {
  sprite: PIXI.Sprite;
  texture: PIXI.Texture;

  toJSON(): ISerializedTexture;
}
