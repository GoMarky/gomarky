import * as PIXI from 'pixi.js';

import { Disposable } from '@/gm/base/common/lifecycle';
import { Emitter, Event as CommonEvent, GlobalEvent } from '@/gm/base/common/event';
import { getImageInfo } from '@/gm/base/common/mime';
import {
  CurrentLayerProperty,
  LayerGroup,
  ShapeType,
  BeforeLayerAppendEvent,
  Shape,
  MaskType,
  Layer,
  CurrentLayerSetEvent,
  Application,
  handleSelectBounds, multiClickHandler, Stage, ITextureRenderEvent, CurrentTextureProperty, TextureImage, TextureVideo,
} from '@/core';
import { RangeSelectEvent } from '@/core/code/range';
import { URI } from '@/gm/base/common/uri';

const DELAY_DOUBLE_CLICK_TIME = 200;

export class Scene extends Disposable {
  public static RootName = 'RootLayer';

  public readonly interaction: SceneInteraction;
  public readonly texture: SceneTexture;

  private _lastFocused: CurrentLayerProperty = null;
  public get lastFocused(): CurrentLayerProperty {
    return this._lastFocused;
  }

  //#region processing layers

  public root: LayerGroup = new LayerGroup(Scene.RootName, this.app);

  public addShape(type: ShapeType, startEvent?: PIXI.interaction.InteractionEvent): Shape {
    const event = new BeforeLayerAppendEvent(type, startEvent);

    this._onBeforeAppendLayer.fire(event);

    if (event.defaultPrevented) {
      throw new Error(
        `Scene#addShape - Creating shape was failed due reason ${event.preventReason}`
      );
    }

    const layer = new Shape(`Layer ${this.root.layers.length}`, type, this.app, startEvent);

    return this.doAddLayer<any>(layer);
  }

  public createGroupWithSelectedLayers(mask?: MaskType): LayerGroup | Layer {
    const group = new LayerGroup('Group 1', this.app);

    const selectedLayers = this.root.layers.filter(layer => layer.selected);
    const length = selectedLayers.length;

    for (let i = 0; i < length; i += 1) {
      const layer = selectedLayers[i];

      layer.setParent(group);

      const lastIndex = length - 1;
      if (mask && lastIndex !== i) {
        layer.setMask(mask);
      }
    }

    return this.doAddLayer<any>(group);
  }

  private doAddLayer<T extends Layer>(layer: T): T {
    this.root.appendChild(layer);

    this.setCurrentEditedLayer(layer);

    return layer;
  }

  //#endregion

  //#region current layer

  private readonly _onBeforeCurrentLayerSet = new Emitter<CurrentLayerSetEvent>();
  public readonly onBeforeCurrentLayerSet: CommonEvent<CurrentLayerSetEvent> = this
    ._onBeforeCurrentLayerSet.event;

  private readonly _didCurrentLayerSet = new Emitter<CurrentLayerSetEvent>();
  public readonly didCurrentLayerSet: CommonEvent<CurrentLayerSetEvent> = this._didCurrentLayerSet
    .event;

  private readonly _didCurrentEditedLayerSet = new Emitter<CurrentLayerSetEvent>();
  public readonly didCurrentEditedLayerSet: CommonEvent<CurrentLayerSetEvent> = this
    ._didCurrentEditedLayerSet.event;

  private _currentLayer: CurrentLayerProperty = null;
  public get currentLayer(): CurrentLayerProperty {
    return this._currentLayer;
  }

  public setCurrentLayer(layer: CurrentLayerProperty): boolean {
    const event = new CurrentLayerSetEvent(layer);
    this._onBeforeCurrentLayerSet.fire(event);

    if (event.defaultPrevented) {
      return false;
    }

    this._currentLayer = layer;
    this._lastFocused = layer;
    this._didCurrentLayerSet.fire(event);

    return true;
  }

  private _currentEditedLayer: CurrentLayerProperty = null;
  public get currentEditedLayer(): CurrentLayerProperty {
    return this._currentEditedLayer;
  }

  public setCurrentEditedLayer(layer: CurrentLayerProperty): boolean {
    const event = new CurrentLayerSetEvent(layer);
    this._currentEditedLayer = layer;
    this._lastFocused = layer;
    this._didCurrentEditedLayerSet.fire(event);

    return true;
  }

  //#endregion

  constructor(private readonly app: Application) {
    super();

    this.app.viewport.screen.addChild(this.root.containerGroup.frame);

    this.interaction = new SceneInteraction(app);
    this.texture = new SceneTexture(app);

    this.registerListeners();
  }

  //#region APPEND/GEOMETRY REMOVE

  private readonly _onBeforeAppendLayer = this._register(new Emitter<BeforeLayerAppendEvent>());
  public readonly onBeforeAppendLayer: CommonEvent<BeforeLayerAppendEvent> = this
    ._onBeforeAppendLayer.event;

  //#endregion

  public drawSelectPreviewShape(): void {
    const selectedLayers = this.root.layers.filter(layer => layer.selected);

    if (!selectedLayers.length) {
      this.app.select.clearBorderShape();
      return;
    }

    // ._bounds property allow access to minX/minY/maxX/maxY properties, but it is protected :(

    // eslint-disable-next-line @typescript-eslint/ban-ts-ignore
    // @ts-ignore
    interface PublicBoundsContainer extends PIXI.Container {
      _bounds: PIXI.Bounds;
    }

    const firstSelected = selectedLayers[0];

    const geometry = (firstSelected.container.frame as unknown) as PublicBoundsContainer;
    geometry.getLocalBounds();

    const minFirstX = geometry._bounds.minX;
    const maxFirstX = geometry._bounds.maxX;
    const minFirstY = geometry._bounds.minY;
    const maxFirstY = geometry._bounds.maxY;

    const bounds = selectedLayers.reduce(
      (accumulator: number[], layer) => {
        const geometry = (layer.container.frame as unknown) as PublicBoundsContainer;
        geometry.getLocalBounds();

        const minAccX = accumulator[0];
        const maxAccX = accumulator[1];

        const minAccY = accumulator[2];
        const maxAccY = accumulator[3];

        const minX = geometry._bounds.minX;
        const maxX = geometry._bounds.maxX;
        const minY = geometry._bounds.minY;
        const maxY = geometry._bounds.maxY;

        return [
          minAccX > minX ? minX : minAccX,
          maxAccX > maxX ? maxAccX : maxX,
          minAccY > minY ? minY : minAccY,
          maxAccY > maxY ? maxAccY : maxY,
        ];
      },
      [minFirstX, maxFirstX, minFirstY, maxFirstY]
    );

    const minX = bounds[0];
    const maxX = bounds[1];

    const minY = bounds[2];
    const maxY = bounds[3];

    this.doDrawSelectPreviewShape(new PIXI.Rectangle(minX, minY, maxX - minX, maxY - minY));
  }

  private doDrawSelectPreviewShape(bounds: PIXI.Rectangle): void {
    this.app.select.drawBorderShape(bounds);
  }

  private findGeometryByCoordinate(point: PIXI.Point): Layer | undefined {
    // Small hack: we should reverse our containers for correct getting hitArea.
    const layers = this.root.layers.reverse();

    return layers.find(layer =>
      layer.container.geometry.container.hitArea.contains(point.x, point.y)
    );
  }

  private registerListeners(): void {
    const onBoundsChanged = (event: RangeSelectEvent) => {
      this.root.layers.forEach(layer => handleSelectBounds(layer, event.bounds));
    };
    this.app.select.onBoundsChanged(onBoundsChanged);

    const onSingleClick = (event: PIXI.interaction.InteractionEvent) => {
      const point: PIXI.Point = this.app.viewport.screen.toWorld(
        new PIXI.Point(event.data.global.x, event.data.global.y)
      );

      const canNavigate = this.interaction.canNavigate;

      if (canNavigate) {
        return;
      }

      const selectedLayers = this.root.layers.filter(layer => layer.selected);
      const hasSelectedLayers = selectedLayers.length > 0;

      // Если мы уже выбрали какие-то фигуры до этого, то начинаем действия с выделенными фигурами.
      if (hasSelectedLayers) {
        const clickWasInsideSomeLayer = selectedLayers.some(layer =>
          layer.container.geometry.container.hitArea.contains(point.x, point.y)
        );

        if (clickWasInsideSomeLayer) {
          for (const layer of selectedLayers) {
            layer.container.geometry.startX = point.x;
            layer.container.geometry.startY = point.y;
          }

          return;
        } else {
          selectedLayers.forEach(layer => (layer.selected = false));
        }

        // Выходим из функции и продолжаем перемещение выделенных фигур в pointerMove
        return this.app.select.start(point);
      }

      if (this.app.select.canStart()) {
        const layer = this.findGeometryByCoordinate(point);

        if (layer) {
          return layer.container.onSingleClick(event);
        }

        return this.app.select.start(point);
      }
    };
    this.app.viewport.screen.on('pointerdown', onSingleClick);

    const onDoubleClick = multiClickHandler<PIXI.interaction.InteractionEvent>(
      {
        2: event => {
          const point: PIXI.Point = this.app.viewport.screen.toWorld(
            new PIXI.Point(event.data.global.x, event.data.global.y)
          );

          const layer = this.findGeometryByCoordinate(point);

          layer?.container.onDoubleClick();
        },
      },
      DELAY_DOUBLE_CLICK_TIME,
      this
    );
    this.app.viewport.screen.on('pointerdown', onDoubleClick);

    const onPointerMove = (event: PIXI.interaction.InteractionEvent) => {
      if (this.interaction.canMoveSelectedLayers() && !this.app.select.isStarted) {
        const selectedLayers = this.root.layers.filter(layer => layer.selected);

        if (selectedLayers.length) {
          selectedLayers.forEach(layer => {
            layer.container.geometry.dynamicMove(event);
          });

          this.drawSelectPreviewShape();
        }
      }
    };
    this.app.viewport.screen.on('pointermove', onPointerMove);

    const onPointerUp = (event: PIXI.interaction.InteractionEvent) => {
      const point: PIXI.Point = this.app.viewport.screen.toWorld(
        new PIXI.Point(event.data.global.x, event.data.global.y)
      );

      const selectedLayers = this.root.layers.filter(layer => layer.selected);
      // We should update hit area of our geometries before we actually start to do operation with hitArea
      selectedLayers.forEach(layer => layer.container.geometry.stop());

      const hasSelectedLayers = Boolean(selectedLayers.length);
      // check if pointer up was indie layer
      const pointerUpWasInsideSomeLayer = selectedLayers.some(layer =>
        layer.container.geometry.container.hitArea.contains(point.x, point.y)
      );

      if (hasSelectedLayers && !this.app.select.isStarted && !pointerUpWasInsideSomeLayer) {
        selectedLayers.forEach(layer => {
          layer.container.geometry.stop();
          layer.selected = false;
        });

        this.setCurrentLayer(null);
        this.setCurrentEditedLayer(null);
      }

      if (this.app.select.isStarted) {
        return this.app.select.end();
      }

      if (this.currentLayer) {
        const stage = this.currentLayer.container.geometry.stage;

        this.currentLayer.container.geometry.onPointerUp(event);

        switch (stage) {
          case Stage.Dragging:
            this.currentLayer.container.geometry.hideAllPoints();
            this.setCurrentLayer(null);
            this.setCurrentEditedLayer(null);
            break;
          default:
            break;
        }
      }
    };
    this.app.viewport.screen.on('pointerup', onPointerUp);

    const onPointerOut = () => {
      if (this.app.select.canStart()) {
        this.app.select.end();
      }
    };
    this.app.viewport.screen.on('pointerout', onPointerOut);
  }
}

export class SceneInteraction extends Disposable {
  constructor(private readonly app: Application) {
    super();

    this.registerListeners();
  }

  private readonly _onPointerDown = new Emitter<PIXI.interaction.InteractionEvent>();
  public readonly onPointerDown: CommonEvent<PIXI.interaction.InteractionEvent> = this
    ._onPointerDown.event;

  private readonly _onPointerUp = new Emitter<PIXI.interaction.InteractionEvent>();
  public readonly onPointerUp: CommonEvent<PIXI.interaction.InteractionEvent> = this._onPointerUp
    .event;

  private readonly _onPointerOut = new Emitter<PIXI.interaction.InteractionEvent>();
  public readonly onPointerOut: CommonEvent<PIXI.interaction.InteractionEvent> = this._onPointerOut
    .event;

  private readonly _onPointerOver = new Emitter<PIXI.interaction.InteractionEvent>();
  public readonly onPointerOver: CommonEvent<PIXI.interaction.InteractionEvent> = this
    ._onPointerOver.event;

  private readonly _onPointerMove = new Emitter<PIXI.interaction.InteractionEvent>();
  public readonly onPointerMove: CommonEvent<PIXI.interaction.InteractionEvent> = this
    ._onPointerMove.event;

  private _interactiveChildren = true;
  public get interactiveChildren(): boolean {
    return this._interactiveChildren;
  }

  private _canNavigate = false;
  public get canNavigate(): boolean {
    return this._canNavigate;
  }
  public set canNavigate(value: boolean) {
    this._canNavigate = value;

    const { plugins } = this.app.viewport.screen;

    value ? plugins.resume('drag') : plugins.pause('drag');
  }

  private _canEquilateral = false;
  public get canEquilateral(): boolean {
    return this._canEquilateral;
  }
  public set canEquilateral(value: boolean) {
    this._canEquilateral = value;
  }

  public disable(): void {
    this._interactiveChildren = false;
  }

  public enable(): void {
    this._interactiveChildren = true;
  }

  public canMoveSelectedLayers: () => boolean = () => true;

  private registerListeners(): void {
    this.app.viewport.screen.on('pointerdown', event => this._onPointerDown.fire(event));
    this.app.viewport.screen.on('pointerup', event => this._onPointerUp.fire(event));
    this.app.viewport.screen.on('pointermove', event => this._onPointerMove.fire(event));

    this.app.viewport.screen.on('pointerout', event => this._onPointerOut.fire(event));
    this.app.viewport.screen.on('pointerover', event => this._onPointerOver.fire(event));
  }
}

export class CurrentTextureSetEvent extends GlobalEvent {
  constructor(public readonly texture: CurrentTextureProperty) {
    super();
  }
}

export class SceneTexture extends Disposable {
  constructor(private readonly app: Application) {
    super();
  }

  private readonly _onBeforeCurrentTextureSet = new Emitter<CurrentTextureSetEvent>();
  public readonly onBeforeCurrentTextureSet: CommonEvent<CurrentTextureSetEvent> = this
    ._onBeforeCurrentTextureSet.event;

  private readonly _didCurrentTextureSet = new Emitter<ITextureRenderEvent>();
  public readonly didCurrentTextureSet: CommonEvent<ITextureRenderEvent> = this
    ._didCurrentTextureSet.event;

  private _currentTexture: CurrentTextureProperty;
  public get currentTexture(): CurrentTextureProperty {
    return this._currentTexture;
  }
  public set currentTexture(texture: CurrentTextureProperty) {
    const event = new CurrentTextureSetEvent(texture);
    this._onBeforeCurrentTextureSet.fire(event);

    if (event.defaultPrevented) {
      return;
    }

    this._currentTexture = texture;
    this._didCurrentTextureSet.fire({ texture });
  }

  public async renderImage(path: URI): Promise<TextureImage> {
    if (this.currentTexture) {
      this.clearTexture();
    }

    const imageInfo = await getImageInfo(path.path);

    const texture = new TextureImage(this.app, {
      source: path,
      imageWidth: imageInfo.width,
      imageHeight: imageInfo.height,
    });

    this.app.viewport.screen.addChildAt(texture.sprite, 0);
    this.currentTexture = texture;

    this._didCurrentTextureSet.fire({ texture });

    return texture;
  }

  public async renderVideo(source: HTMLVideoElement, resource: URI): Promise<TextureVideo> {
    return new Promise(resolve => {
      source.addEventListener('loadeddata', (event: Event) => {
        const texture = new TextureVideo(this.app, {
          source: event.composedPath()[0] as HTMLVideoElement,
          resource,
        });

        this.app.viewport.screen.addChildAt(texture.sprite, 0);
        this.currentTexture = texture;

        this._didCurrentTextureSet.fire({ texture });

        resolve(texture);
      });
    });
  }

  public destroyVideo(video: TextureVideo): void {
    this.app.viewport.screen.removeChild(video.sprite);
    (video.texture.baseTexture.source as HTMLVideoElement).pause();
    this.currentTexture = null;

    video.dispose();
  }

  public destroyImage(image: TextureImage): void {
    this.app.viewport.screen.removeChild(image.sprite);
    this.currentTexture = null;

    image.dispose();
  }

  public reset(): void {
    this.clearTexture();

    this.currentTexture = null;
  }

  private clearTexture(): void {
    if (this._currentTexture instanceof TextureVideo) {
      this.app.scene.texture.destroyVideo(this._currentTexture);
    }
    if (this._currentTexture instanceof TextureImage) {
      this.app.scene.texture.destroyImage(this._currentTexture);
    }
  }
}
