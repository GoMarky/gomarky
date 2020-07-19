import { Layer } from '@/core/objects/geometry/layer/layer';
import { LayerGroup } from '@/core/objects/geometry/layer/layerGroup';
import { ISerializedLayer } from '@/core/objects/geometry/layer/common/layer';

export type CommonLayer = Layer | LayerGroup;

export type CommonSerializedLayer = ISerializedLayer | ISerializedGroupLayer;

export interface ISerializedGroupLayer extends ISerializedLayer {
  layers: CommonSerializedLayer[];
}
