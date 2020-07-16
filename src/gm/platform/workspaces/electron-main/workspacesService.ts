import { Disposable } from '@/gm/base/common/lifecycle';
import { IWorkspacesService } from '@/gm/platform/workspaces/common/workspaces';
import {
  IWorkspace,
  IWorkspaceCreationOptions,
  IWorkspaceId,
} from '@/gm/platform/workspace/common/workspace';

import { ILogService } from '@/gm/platform/log/common/log';
import { ILifecycleService } from '@/gm/platform/lifecycle/electron-main/lifecycle';
import { IStateService } from '@/gm/platform/state/common/state';

import { IWorkspacesMainService } from '@/gm/platform/workspaces/electron-main/workspacesMainService';
import { IHistoryMainService } from '@/gm/platform/history/common/history';
import { URI } from '@/gm/base/common/uri';

export class WorkspacesService extends Disposable implements IWorkspacesService {
  constructor(
    @IWorkspacesMainService private readonly workspacesMainService: IWorkspacesMainService,
    @ILogService private readonly logService: ILogService,
    @ILifecycleService private readonly lifecycleService: ILifecycleService,
    @IStateService private readonly stateService: IStateService,
    @IHistoryMainService private readonly historyMainService: IHistoryMainService
  ) {
    super();
  }

  public createUntitledWorkspace(options: IWorkspaceCreationOptions): Promise<IWorkspace> {
    return this.workspacesMainService.createUntitledWorkspace(options);
  }

  public getWorkspaceById(identifier: IWorkspaceId): Promise<IWorkspace> {
    return this.workspacesMainService.getWorkspaceById(identifier);
  }

  public setLastEditedTexture(workspaceId: IWorkspaceId, path: string): Promise<void> {
    return this.withWorkspace(workspaceId, (workspace: IWorkspace) => {
      const storage = workspace.storage;

      storage.set('lastEditedTexture', path);
    });
  }

  public getLastEditedTexture(workspaceId: IWorkspaceId): Promise<string | undefined> {
    return this.withWorkspace<string | undefined>(workspaceId, workspace => {
      const storage = workspace.storage;

      const lastEditedTexturePath = storage.get('lastEditedTexture', '');

      return lastEditedTexturePath;
    });
  }

  private async withWorkspace<T>(
    workspaceId: IWorkspaceId,
    fn: (workspace: IWorkspace) => T,
    fallback?: () => T
  ): Promise<T | undefined> {
    const workspace = await this.workspacesMainService.getWorkspaceById(workspaceId);

    if (workspace) {
      return fn(workspace);
    }
    if (fallback) {
      return fallback();
    }

    return undefined;
  }
}
