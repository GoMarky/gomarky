import {
  Application,
  CommonLayer,
  CommonSerializedLayer,
  ContainerGroup,
  ISerializedGroupLayer,
  Layer,
  UpdateTick,
} from '@/core';

export class LayerGroup extends Layer {
  private readonly _children: CommonLayer[] = [];

  public readonly containerGroup: ContainerGroup;

  constructor(name = 'Group', app: Application) {
    super(name, app);

    this.containerGroup = new ContainerGroup(app);
  }

  public get layers(): CommonLayer[] {
    return this._children;
  }

  public serialize(): CommonSerializedLayer {
    const serialized = super.serialize();

    ((serialized as unknown) as ISerializedGroupLayer).layers = this.layers.map(layer =>
      layer.serialize()
    );

    return serialized;
  }

  public appendChild(layer: CommonLayer): CommonLayer {
    if (this._children.includes(layer)) {
      return layer;
    }

    this._children.push(layer);

    if (layer?.parent !== this) {
      layer.parent = this;
    }

    if (layer instanceof LayerGroup) {
      this.containerGroup.appendChild(layer.containerGroup);
    } else {
      this.containerGroup.appendChild(layer.container);
    }

    this.$didUpdate = { type: UpdateTick.AppendChild, child: layer };

    return layer;
  }

  public removeChild(layer: CommonLayer): CommonLayer {
    const childIndex = this._children.findIndex(_layer => _layer === layer);

    if (childIndex !== -1) {
      const children = this._children.splice(childIndex, 1);
      this.containerGroup.removeChild(layer.container);
      this.$didUpdate = { type: UpdateTick.RemoveChild, child: children[0] };
    }

    return layer;
  }

  public duplicate(): this {
    return this;
  }
}
