import { Disposable } from '@/gm/base/common/lifecycle';
import { IHistoryMainService } from '@/gm/platform/history/common/history';
import { Emitter, Event } from '@/gm/base/common/event';

import { IStateService } from '@/gm/platform/state/common/state';
import { app } from 'electron';
import { existsSync } from 'fs';

import * as path from 'path';
import product from '@/gm/platform/product/node';

export class HistoryMainService extends Disposable implements IHistoryMainService {
  private _onRecentlyOpenedChange = new Emitter<void>();
  public readonly onRecentlyOpenedChange: Event<void> = this._onRecentlyOpenedChange.event;

  constructor(@IStateService private readonly stateService: IStateService) {
    super();
  }

  public addRecentlyOpened(recents: string[]): void {
    const currentProjects = this.getRecentlyOpened().concat(recents);

    this.saveRecentlyOpened({ workspaces: Array.from(new Set(currentProjects)) });

    recents.forEach((recentDocument: string) => app.addRecentDocument(recentDocument));
  }

  public clearRecentlyOpened(): void {
    this.saveRecentlyOpened({ workspaces: [] });
    app.clearRecentDocuments();

    this._onRecentlyOpenedChange.fire();
  }

  public getRecentlyOpened(): string[] {
    const recentWorkspacesSet: Set<string> = new Set(
      this.stateService.getItem<string[]>('projects', []).filter((folder: string) => folder)
    );

    for (const projectPath of recentWorkspacesSet) {
      if (existsSync(path.join(projectPath, product.metaFolderName))) {
        continue;
      }

      recentWorkspacesSet.delete(projectPath);
    }

    const recentWorkspacesArray = Array.from(recentWorkspacesSet);

    /**
     * TODO:
     *  DONT CALL this.saveRecentlyOpened HERE!!! It calls recursion.
     *  Find another way for handling onRecentlyOpenedChanged()
     */

    this.stateService.setItem('projects', recentWorkspacesArray);

    return Array.from(recentWorkspacesArray);
  }

  private saveRecentlyOpened({ workspaces }: { workspaces: string[] }): void {
    this.stateService.setItem('projects', workspaces);

    this._onRecentlyOpenedChange.fire();
  }
}
