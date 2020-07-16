/*---------------------------------------------------------------------------------------------
 * Сервис управления рабочими пространствами gomarky
 *--------------------------------------------------------------------------------------------*/

import { ILogService } from '@/gm/platform/log/common/log';
import { createDecorator } from '@/gm/platform/instantiation/common/instantiation';
import { ILifecycleService } from '@/gm/platform/lifecycle/electron-main/lifecycle';

import { Workspace } from '@/gm/platform/workspace/electron-main/workspace';
import {
  IWorkspace,
  IWorkspaceCreationOptions,
  IWorkspaceId,
} from '@/gm/platform/workspace/common/workspace';
import path from 'path';
import { mkdir } from '@/gm/base/node/pfs';
import { originalFSPath, URI } from '@/gm/base/common/uri';

import { IStorageService } from '@/gm/platform/storage/common/storage';
import { ILocalWorkspaceStorageSchema } from '@/gm/platform/storage/common/schema';
import { createHash } from 'crypto';

import { isLinux } from '@/gm/base/platform';
import { defaultWindowState } from '@/gm/platform/window/electron-main/window';

import { IStateService } from '@/gm/platform/state/common/state';
import { IHistoryMainService } from '@/gm/platform/history/common/history';
import product from '@/gm/platform/product/node';

import { IPCServer } from '@/gm/platform/ipc/electron-main/ipcServer';
import { IWindowsMainService } from '@/gm/platform/windows/electron-main/windows';
import { WorkspaceChannel } from '@/gm/platform/workspace/node/workspace';

import { Schemas } from '@/gm/base/common/network';
import { normalizeNFC } from '@/gm/base/common/normalize';

export const IWorkspacesMainService = createDecorator<IWorkspacesMainService>(
  'workspacesMainService'
);

export interface IWorkspacesMainService {
  createUntitledWorkspace(options: IWorkspaceCreationOptions): Promise<IWorkspace>;
  getWorkspaceById(identifier: IWorkspaceId): Promise<IWorkspace>;
  getWorkspaceByURI(uri: URI): Promise<IWorkspace | void>;
}

/* [RU]
* Для того, чтобы создать рабочее пространство проекта, мы должны определиться с местонахождением проекта.
* Это должна быть папка на компьютере. Далее мы создаем на верхнем уровне папки,
* мы создаем папку .gomarky. В теории, структура будет такой:
*
* Project Folder/ <-- class Workspace()
*     .gomarky/ <-- class WorkspaceMetaFolder()
*         settings.json <-- class WorkspaceSettings
*         config.json <-- class WorkspaceStorage
*
*
      dataset-1/ <-- class new WorkspaceWorkFolder()
*         annotations/ <-- class WorkspaceAnnotationFolder
*
*             image-1.png.json <-- class WorkspaceAnnotationFile
*             image-2.png.json <-- class WorkspaceAnnotationFile
*         images/ <-- class WorkspaceImageFolder
*
*             image-1.png <-- class WorkspaceImageFile
*             image-2.png <-- class WorkspaceImageFile
*     dataset-2/
*         annotations/ class WorkspaceAnnotationFolder
*             image-1.png.json class WorkspaceAnnotationFile
*         images/ class WorkspaceImageFolder
*             image-1.png <-- class WorkspaceImageFile()
* */

export class WorkspacesMainService implements IWorkspacesMainService {
  public readonly _workspaces: Map<string, IWorkspace> = new Map();
  private _ipcServer: IPCServer;

  constructor(
    @ILogService public readonly logService: ILogService,
    @ILifecycleService private readonly lifecycleService: ILifecycleService,
    @IHistoryMainService private readonly historyMainService: IHistoryMainService,
    @IStorageService private readonly storageService: IStorageService,
    @IStateService private readonly stateService: IStateService
  ) {}

  public async createUntitledWorkspace(options: IWorkspaceCreationOptions): Promise<IWorkspace> {
    const workspaces: string[] = this.historyMainService.getRecentlyOpened();
    const configPath = normalizeNFC(options.location.path);

    const workspaceURI = URI.file(configPath);
    const workspace = await this.doCreateWorkspace(workspaceURI);

    if (await isEmptyWorkspace(workspace)) {
      if (options.name || options.description) {
        workspace.setName(options.name as string);
        workspace.setDescription(options.description as string);
      }
    } else {
      /**
       * TODO:
       *  Read name and description from .gomarky/config.json file if workspace already exist
       */
    }

    if (workspaces.includes(configPath)) {
      /**
       * TODO:
       *  Does it mean, that workspace already created?!
       *  We should provide edge cases.
       */
    } else {
      this.historyMainService.addRecentlyOpened([configPath]);
    }

    this._workspaces.set(workspace.id, workspace);

    return workspace;
  }

  public async getWorkspaceById(identifier: IWorkspaceId): Promise<IWorkspace> {
    return this._workspaces.get(identifier) as IWorkspace;
  }

  public async getWorkspaceByURI(uri: URI): Promise<IWorkspace | void> {
    const workspace = Array.from(this._workspaces.values()).find(
      (wrk: IWorkspace) => wrk.uri.path === uri.path
    );

    if (workspace) {
      return workspace;
    }
  }

  private async doCreateWorkspace(workspaceURI: URI): Promise<IWorkspace> {
    // create .gomarky folder

    try {
      await mkdir(path.join(workspaceURI.path, product.metaFolderName));
    } catch (error) {
      switch (error.code) {
        case 'EEXIST':
          /**
           * TODO:
           *  If workspace exist - validate config/labels.
           */
          break;
        default:
          this.logService.error(
            `WorkspaceMainService#doCreateWorkspace - ${JSON.stringify(error)}`
          );
          break;
      }
    }

    // Create storage for our workspace;

    const localWorkspaceStorage = this.storageService.createStorage<ILocalWorkspaceStorageSchema>({
      schema: {
        name: { type: 'string', default: path.basename(workspaceURI.path) },
        keymap: { type: 'object', default: {} },
        settings: { type: 'object', default: {} },
        description: { type: 'string', default: '' },
        windowState: { type: 'object', default: defaultWindowState() },
        lastEditedTexture: { type: 'string', default: '' },
      },
      name: 'config',
      cwd: path.join(workspaceURI.path, product.metaFolderName),
    });

    const workspace = new Workspace(
      this.logService,
      this.lifecycleService,
      this.stateService,
      localWorkspaceStorage,
      workspaceURI,
      getWorkspaceId(workspaceURI)
    );

    this._ipcServer.registerChannel(`workspace:${workspace.id}`, new WorkspaceChannel(workspace));
    this._workspaces.set(workspace.id, workspace);

    return workspace;
  }

  public createIPCServer(windowsMainService: IWindowsMainService): void {
    this._ipcServer = new IPCServer(windowsMainService);
  }

  private log(...data: any) {
    return this.logService.info('WorkspaceService', ...data);
  }
}

export function getWorkspaceId(configPath: URI): string {
  let workspaceConfigPath =
    configPath.scheme === Schemas.file ? originalFSPath(configPath) : configPath.toString();

  if (!isLinux) {
    workspaceConfigPath = workspaceConfigPath.toLowerCase(); // sanitize for platform file system
  }

  return createHash('md5')
    .update(workspaceConfigPath)
    .digest('hex');
}

function isEmptyWorkspace(_workspace: any): boolean {
  for (const folder of []) {
    // eslint-disable-next-line @typescript-eslint/ban-ts-ignore
    // @ts-ignore
    const filename = path.basename(folder.uri.path);

    /**
     * TODO:
     *  This time we have only one sign of filled workspace.
     *  If .gomarky folder exists - it is not empty!
     */

    if (filename === product.metaFolderName) {
      return false;
    }
  }

  return true;
}
