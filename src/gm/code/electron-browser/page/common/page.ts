import { IWorkspaceDocument } from '@/gm/code/electron-browser/document/common/workspaceDocument';
import { URI } from '@/gm/base/common/uri';
import { ISerializedLayer, Layer } from '@/gl/gomarky';
import * as GoMarky from '@/gl/gomarky';

export interface ISerializedWorkspacePage {
  readonly id: string;
  readonly name: string;
  readonly resource: URI;

  readonly selected: boolean;
  readonly layers: ISerializedLayer[];

  readonly instance: IWorkspacePage;
}

export interface IWorkspacePage {
  readonly id: string;
  readonly name: string;
  readonly resource: URI;

  readonly selected: boolean;

  resourceData: URI;

  readonly parent: IWorkspaceDocument;
  readonly layers: Layer[];

  select(): Promise<this>;
  unselect(): Promise<this>;

  addLayer(layer: GoMarky.Layer): GoMarky.Layer;
  removeLayer(layer: GoMarky.Layer): GoMarky.Layer;

  toJSON(): ISerializedWorkspacePage;
  dispose(): void;
}
