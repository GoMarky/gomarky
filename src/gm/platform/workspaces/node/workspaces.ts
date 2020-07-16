import { IServerChannel } from '@/gm/base/parts/ipc/common/ipc';
import { Event } from '@/gm/base/common/event';

import {
  IPCWorkspacesChannelError,
  IWorkspacesService,
} from '@/gm/platform/workspaces/common/workspaces';

import { IWorkspace } from '@/gm/platform/workspace/common/workspace';

type WorkspacesMainCall = {
  [key in keyof IWorkspacesService]: keyof IWorkspacesService;
};

/**
 * TODO:
 *  Implement all methods from IWorkspacesMainService
 */

// eslint-disable-next-line @typescript-eslint/ban-ts-ignore
// @ts-ignore
const calls: WorkspacesMainCall = {
  createUntitledWorkspace: 'createUntitledWorkspace',
  getWorkspaceById: 'getWorkspaceById',
  setLastEditedTexture: 'setLastEditedTexture',
  getLastEditedTexture: 'getLastEditedTexture',
};

export class WorkspacesChannel implements IServerChannel {
  public readonly calls = calls;

  constructor(@IWorkspacesService private service: IWorkspacesService) {}

  public listen<T>(_: unknown, event: string): Event<T> {
    throw new IPCWorkspacesChannelError(`Event not found: ${event}`);
  }

  public async call(command: string, arg?: any): Promise<any> {
    switch (command) {
      case calls.createUntitledWorkspace:
        return ((await this.service.createUntitledWorkspace(arg)) as IWorkspace).toJSON();
      case calls.getWorkspaceById:
        return ((await this.service.getWorkspaceById(arg)) as IWorkspace).toJSON();
      case calls.setLastEditedTexture:
        return this.service.setLastEditedTexture(arg[0], arg[1]);
      case calls.getLastEditedTexture:
        return this.service.getLastEditedTexture(arg[0]);
    }

    throw new IPCWorkspacesChannelError(`Call not found: ${command}`);
  }
}
