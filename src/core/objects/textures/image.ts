import * as PIXI from 'pixi.js';
import { Disposable } from '@/gm/base/common/lifecycle';
import {
  Application,
  calculateAspectRatio,
  ICreateTextureImageOption,
  ISerializedTexture,
  ITextureImage,
} from '@/core';
import { URI } from '@/gm/base/common/uri';

export class TextureImage extends Disposable implements ITextureImage {
  private readonly _source: URI;
  private readonly _originalHeight: number;
  private readonly _originalWidth: number;

  private readonly _texture: PIXI.Texture;
  private readonly _sprite: PIXI.Sprite = new PIXI.Sprite();

  public get sprite(): PIXI.Sprite {
    return this._sprite;
  }
  public get texture(): PIXI.Texture {
    return this._texture;
  }

  constructor(private readonly stage: Application, options: ICreateTextureImageOption) {
    super();

    this._source = options.source;

    this._originalWidth = options.imageWidth;
    this._originalHeight = options.imageHeight;

    const imagePath = `${this._source.scheme}://${this._source.path}`;
    this._texture = PIXI.Texture.fromImage(imagePath);

    const ratio = calculateAspectRatio(options.imageWidth, options.imageHeight);

    this.sprite.width = stage.app.screen.width;
    this.sprite.height =
      (options.imageHeight / ratio / (options.imageWidth / ratio)) * this.sprite.width;
    this.sprite.texture = this._texture;
    this.sprite.interactive = false;
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

  public dispose(): void {
    super.dispose();
  }
}
