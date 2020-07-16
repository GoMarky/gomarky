import { createDecorator } from '@/gm/platform/instantiation/common/instantiation';
import { Event } from '@/gm/base/common/event';
import { IWorkspaceIdentifier } from '@/gm/platform/workspaces/common/workspaces';

export interface IRecentWorkspace {
  workspace: IWorkspaceIdentifier;
  label?: string;
}

export interface IHistoryMainService {
  onRecentlyOpenedChange: Event<void>;

  addRecentlyOpened(recents: string[]): void;

  getRecentlyOpened(): string[];

  clearRecentlyOpened(): void;
}

export const IHistoryMainService = createDecorator<IHistoryMainService>('historyMainService');
