import { ISerializedLayer, Layer, LayerGroup } from '@/core';

export type CommonLayer = Layer | LayerGroup;

export type CommonSerializedLayer = ISerializedLayer | ISerializedGroupLayer;

export interface ISerializedGroupLayer extends ISerializedLayer {
  layers: CommonSerializedLayer[];
}
