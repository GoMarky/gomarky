import { IWorkspacesService } from '@/gm/platform/workspaces/common/workspaces';
import {
  IWorkspaceCreationOptions,
  IWorkspaceData,
  IWorkspaceId,
} from '@/gm/platform/workspace/common/workspace';

import { IMainProcessService } from '@/gm/platform/ipc/electron-browser/mainProcessService';
import { IChannel } from '@/gm/base/parts/ipc/common/ipc';

export class WorkspacesService implements IWorkspacesService {
  private channel: IChannel;

  public readonly serviceBrand = IWorkspacesService;

  constructor(@IMainProcessService mainProcessService: IMainProcessService) {
    this.channel = mainProcessService.getChannel('workspaces');
  }

  public createUntitledWorkspace(options: IWorkspaceCreationOptions): Promise<IWorkspaceData> {
    return this.channel.call('createUntitledWorkspace', options);
  }

  public getWorkspaceById(identifier: IWorkspaceId): Promise<IWorkspaceData> {
    return this.channel.call('getWorkspaceById', identifier);
  }

  public setLastEditedTexture(workspaceId: IWorkspaceId, path: string): Promise<void> {
    return this.channel.call('setLastEditedTexture', [workspaceId, path]);
  }

  public async getLastEditedTexture(workspaceId: IWorkspaceId): Promise<string | undefined> {
    return this.channel.call('getLastEditedTexture', [workspaceId]);
  }
}
