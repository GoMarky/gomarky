import * as PIXI from 'pixi.js';

import { Event } from '@/gm/base/common/event';
import { Disposable } from '@/gm/base/common/lifecycle';
import { generateUuid } from '@/gm/base/common/uuid';
import { Application, ISerializedGeometry } from '@/core';

export abstract class AbstractContainer extends Disposable {
  protected _selected = false;

  public frame: PIXI.Container = new PIXI.Container();
  public isDisposed = false;

  protected constructor(protected readonly app: Application) {
    super();

    this._id = generateUuid();

    this.frame.interactive = true;
  }

  public abstract selected: boolean;
  public abstract onDidUpdate: Event<void>;

  protected readonly _id: string;
  public get id(): string {
    return this._id;
  }

  public hide(): this {
    return this;
  }

  public show(): this {
    return this;
  }

  public abstract serialize(): ISerializedGeometry;

  public abstract onDoubleClick: () => void;
  public abstract onSingleClick: (event: PIXI.interaction.InteractionEvent) => void;
  public abstract remove(): void;

  public dispose(): void {
    this.isDisposed = true;

    this.frame.destroy();
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    this.frame = null!;

    super.dispose();
  }
}
