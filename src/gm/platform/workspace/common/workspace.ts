import { joinPath, URI } from '@/gm/base/common/uri';
import { createDecorator } from '@/gm/platform/instantiation/common/instantiation';
import { Barrier } from '@/gm/base/common/async';

import * as path from 'path';

import { IPCChannelError } from '@/gm/platform/ipc/common/ipc';
import { SingleStorage } from '@/gm/platform/storage/electron-main/storage';
import { ILocalWorkspaceStorageSchema } from '@/gm/platform/storage/common/schema';

import { IWorkspaceDocument } from '@/gm/code/electron-browser/document/common/workspaceDocument';

export interface IWorkspaceFolderData {
  readonly uri: URI;
  readonly name: string;
}

export interface IWorkspaceDatasetFolderData extends IWorkspaceFolderData {
  images: URI[];
  randomImage: URI | undefined | null;
}

export type IWorkspaceId = string;

export interface IWorkspaceFolder extends IWorkspaceFolderData {
  toResource(relativePath: string): URI;
}

export interface IWorkspaceFoldersChangeEvent {
  added: IWorkspaceFolder[];
  removed: IWorkspaceFolder[];
  changed: IWorkspaceFolder[];
}

export interface IRawFileWorkspaceFolder {
  path: string;
  name?: string;
}

export interface IRawUriWorkspaceFolder {
  uri: string;
  name?: string;
}

export type IStoredWorkspaceFolder = IRawFileWorkspaceFolder | IRawUriWorkspaceFolder;

export class IPCWorkspaceChannelError extends IPCChannelError {
  public readonly name = 'IPCWorkspaceChannelError';
}

export interface ILabelGeoJSONProperties {
  label_title: string;
  fill_color: string;

  label_description?: string;
  keyCode?: string;
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface IWorkspaceConfiguration {
}

export interface IWorkspace {
  readonly id: string;
  readonly uri: URI;

  setName(name: string): void;
  setDescription(description: string): void;
  toJSON(): IWorkspaceData;

  readonly storage: SingleStorage<ILocalWorkspaceStorageSchema>;
}

export const enum WorkbenchState {
  EMPTY = 1,
  FOLDER,
  WORKSPACE,
}

export type WorkspaceBase = Omit<IWorkspace, 'uri' | 'storage' | 'toJSON' | 'assets'>;

export interface IWorkspaceData {
  id: string;
  configuration: IWorkspaceConfiguration;
  name: string;
  uri: URI;
  description: string;
}

export interface IWorkspaceCreationOptions {
  name?: string;
  description?: string;
  location: URI;
}

export interface ICreateWorkspaceDatasetOptions {
  name: string;
  location: URI;
  description?: string;
}

export interface IWorkspaceContextService {
  readonly loadWorkspaceBarrier: Barrier;
  readonly workspace: IWorkspaceRenderer;

  setLastEditedTexture(path: string): Promise<void>;
  getLastEditedTexture(): Promise<URI | null>;
}

export interface IWorkspaceRenderer extends WorkspaceBase {
  readonly resource: URI;
  readonly id: string;

  selectedDocument: IWorkspaceDocument;
  documents: IWorkspaceDocument[];

  setDescription(description: string): Promise<void>;
  setName(name: string): Promise<void>;
}

export const IWorkspaceContextService = createDecorator<IWorkspaceContextService>(
  'workspaceContextService'
);

export function resolveWorkspaceFolder(resource: URI): URI {
  return URI.file(path.resolve(resource.path, '..', '..'));
}

export function resolveAnnotationPath(image: URI): URI {
  return joinPath(resolveWorkspaceFolder(image), 'ann');
}

export function resolveImagePath(ann: URI): URI {
  return joinPath(resolveWorkspaceFolder(ann), 'media');
}
