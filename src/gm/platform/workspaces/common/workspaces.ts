import {
  IWorkspace,
  IWorkspaceCreationOptions,
  IWorkspaceData,
  IWorkspaceId,
} from '@/gm/platform/workspace/common/workspace';

import { joinPath, URI } from '@/gm/base/common/uri';
import { createDecorator } from '@/gm/platform/instantiation/common/instantiation';
import { IPCChannelError } from '@/gm/platform/ipc/common/ipc';
import { readdir, stat } from '@/gm/base/node/pfs';

export const IWorkspacesService = createDecorator<IWorkspacesService>('workspacesService');

export class IPCWorkspacesChannelError extends IPCChannelError {
  public readonly name = 'IPCWorkspacesChannelError';
}

export interface IWorkspacesService {
  createUntitledWorkspace(options: IWorkspaceCreationOptions): Promise<IWorkspaceData | IWorkspace>;
  getWorkspaceById(identifier: IWorkspaceId): Promise<IWorkspaceData | IWorkspace>;
  setLastEditedTexture(workspaceId: IWorkspaceId, path: string): Promise<void>;
  getLastEditedTexture(workspaceId: IWorkspaceId): Promise<string | undefined>;
}

export interface IFolderTreeItem {
  uri: URI;
  children?: IFolderTreeItem[];
}

export interface IWorkspaceIdentifier {
  id: string;
  configPath: URI;
  lastEditedTexture?: string;
}

export async function createFolderTree(
  resource: URI,
  recursiveScanning = true
): Promise<IFolderTreeItem[]> {
  const folders = await readdir(resource.fsPath);

  return Promise.all(
    folders
      .filter(filename => {
        return filename !== '.DS_Store' && filename !== '.gomarky';
      })
      .map(async (filename: string) => {
        const uri = joinPath(resource, filename);

        const stat_info = await stat(uri.fsPath);

        /*
         * TODO:
         *  [Ru]
         *  Нужно в будущем добавить возможность НЕ индексировать системные / служебные или рабочие папки проектов.
         *  Эти папки как правило имеют очень большие размер и вложенность. Нужно проверять сначала размеры папок (в байтах),
         *  и если они больше SAFE_SIZE_LIMIT то пропускать индексацию, и индексировать только по мере открытия этих папок
         *  в workspace.
         *  ------------------------------------------------
         *  Одна из таких папок (как пример) это папка node_modules.
         *
         * */

        if (filename === 'node_modules') {
          return { uri };
        }

        if (stat_info.isDirectory() && recursiveScanning) {
          return { uri, children: await createFolderTree(uri) };
        }

        return { uri };
      })
  );
}
