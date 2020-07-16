import { ISerializedWorkspacePage, IWorkspacePage } from '@/gm/code/electron-browser/page/common/page';
import { URI } from '@/gm/base/common/uri';

export interface ISerializedWorkspaceDocument {
  readonly resource: URI;
  readonly id: string;
  readonly name: string;

  readonly pages: ISerializedWorkspacePage[];
}

export interface IWorkspaceDocument {
  readonly id: string;
  readonly resource: URI;
  readonly name: string;

  readonly pages: IWorkspacePage[];
  readonly selectedPage: IWorkspacePage | undefined;

  initialize(): Promise<this>;
  toJSON(): ISerializedWorkspaceDocument;

  contains(resource: URI): boolean;
}
