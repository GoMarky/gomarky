import { Disposable } from '@/gm/base/common/lifecycle';
import { URI } from '@/gm/base/common/uri';
import {
  Application,
  calculateAspectRatio,
  ICreateVideoTextureOptions,
  ISerializedTexture,
  IVideoTexture,
} from '@/core';

export class TextureVideo extends Disposable implements IVideoTexture {
  private readonly _texture: PIXI.Texture;
  private readonly _sprite: PIXI.Sprite;
  private readonly _source: URI;
  private readonly _originalHeight: number;
  private readonly _originalWidth: number;

  public get sprite(): PIXI.Sprite {
    return this._sprite;
  }
  public get texture(): PIXI.Texture {
    return this._texture;
  }

  constructor(private readonly stage: Application, options: ICreateVideoTextureOptions) {
    super();

    this._source = options.resource;

    this._originalWidth = options.source.videoWidth;
    this._originalHeight = options.source.videoHeight;

    const videoTexture = new PIXI.VideoBaseTexture(
      options.source,
      options.scaleMode,
      options.autoPlay
    );
    const ratio = calculateAspectRatio(options.source.videoWidth, options.source.videoHeight);

    this._texture = PIXI.Texture.from(videoTexture);
    this._sprite = new PIXI.Sprite(this._texture);

    this._sprite.width = stage.app.screen.width;
    this._sprite.height =
      (options.source.videoHeight / ratio / (options.source.videoWidth / ratio)) *
      this._sprite.width;

    this._sprite.interactive = false;
  }

  public toJSON(): ISerializedTexture {
    return {
      source: this._source.path,
      viewportWidth: this.sprite.width,
      viewportHeight: this.sprite.height,
      originalWidth: this._originalWidth,
      originalHeight: this._originalHeight,
    };
  }
}
