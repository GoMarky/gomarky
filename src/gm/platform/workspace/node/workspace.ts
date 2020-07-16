import { IServerChannel } from '@/gm/base/parts/ipc/common/ipc';
import { Event } from '@/gm/base/common/event';

import {
  IPCWorkspaceChannelError,
  IWorkspace,
  IWorkspaceRenderer,
} from '@/gm/platform/workspace/common/workspace';
import { Disposable } from '@/gm/base/common/lifecycle';
import { ILabelAddedEvent, ILabelChangeEvent } from '@/gm/platform/workspace/common/workspaceAssets';

type WorkspaceCall = {
  [key in keyof IWorkspaceRenderer]: keyof IWorkspaceRenderer;
};

/**
 * TODO:
 *  Implement all methods from Workspace
 */

const calls = {
  addLabel: 'addLabel',
  removeLabel: 'removeLabel',
  updateLabel: 'updateLabel',
  setName: 'setName',
  setDescription: 'setDescription',
  loadWorkspaceLabels: 'loadWorkspaceLabels',
  loadAttributes: 'loadAttributes',
};

const events = {
  onDidWorkspaceLabelAdded: { name: 'onDidWorkspaceLabelAdded', toAll: true },
  onDidWorkspaceLabelRemoved: { name: 'onDidWorkspaceLabelRemoved', toAll: true },
  onDidWorkspaceLabelChanged: { name: 'onDidWorkspaceLabelChanged', toAll: true },
};

export class WorkspaceChannel extends Disposable implements IServerChannel {
  public readonly calls = calls;
  public readonly events = events;

  private readonly onDidWorkspaceLabelAdded: Event<ILabelAddedEvent>;
  private readonly onDidWorkspaceLabelChanged: Event<ILabelChangeEvent>;
  private readonly onDidWorkspaceLabelRemoved: Event<void>;

  constructor(private readonly workspace: IWorkspace) {
    super();

    this.onDidWorkspaceLabelAdded = Event.bumper(workspace.assets.onLabelAdded);
    this.onDidWorkspaceLabelRemoved = Event.bumper(workspace.assets.onLabelRemoved);
    this.onDidWorkspaceLabelChanged = Event.bumper(workspace.assets.onLabelChanged);
  }

  public listen(_: unknown, event: string): Event<any> {
    switch (event) {
      case events.onDidWorkspaceLabelAdded.name:
        return this.onDidWorkspaceLabelAdded;
      case events.onDidWorkspaceLabelRemoved.name:
        return this.onDidWorkspaceLabelRemoved;
      case events.onDidWorkspaceLabelChanged.name:
        return this.onDidWorkspaceLabelChanged;
    }

    throw new IPCWorkspaceChannelError(`Event not found: ${event}`);
  }

  public async call(command: string, arg?: any): Promise<any> {
    switch (command) {
      case calls.loadAttributes:
        return this.workspace.assets.attributes;
      case calls.addLabel:
        return this.workspace.assets.addLabel(arg);
      case calls.removeLabel:
        return this.workspace.assets.removeLabel(arg);
      case calls.updateLabel:
        return this.workspace.assets.updateLabel(arg);
      case calls.loadWorkspaceLabels:
        return this.workspace.assets.labels;
      case calls.setDescription:
        return this.workspace.setDescription(arg);
      case calls.setName:
        return this.workspace.setName(arg);
    }

    throw new IPCWorkspaceChannelError(`Call not found: ${command}`);
  }
}
