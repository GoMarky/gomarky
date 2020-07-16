import { Application } from '@/core/code/application';
import { AbstractContainer } from '@/core/objects/geometry/container/abstractContainer';
import { CommonContainer, ISerializedGeometry } from '@/core';

import { Event } from '@/gm/base/common/event';

export class ContainerGroup extends AbstractContainer {
  private readonly _children: CommonContainer[] = [];

  constructor(app: Application) {
    super(app);
  }

  public get selected(): boolean {
    return this._selected;
  }

  public set selected(selected: boolean) {
    this._selected = selected;
  }

  public appendChild(container: CommonContainer): CommonContainer {
    if (this._children.includes(container)) {
      return container;
    }

    this._children.push(container);
    this.frame.addChild(container.frame);

    return container;
  }

  public removeChild(container: CommonContainer): CommonContainer {
    const childIndex = this._children.findIndex(_container => _container === container);

    if (childIndex !== -1) {
      this._children.splice(childIndex, 1);
      this.frame.removeChild(container.frame);
    }

    return container;
  }
  public onDidUpdate: Event<void>;

  public onDoubleClick = (): void => {
    throw new Error(`Method not implemented`);
  };

  public onSingleClick = (_: PIXI.interaction.InteractionEvent): void => {
    throw new Error(`Method not implemented`);
  };
  public serialize(): ISerializedGeometry {
    throw new Error(`Method not implemented`);
  }

  public remove(): void {
    //
  }
}
