import { ILogService } from '@/gm/platform/log/common/log';
import { Menubar } from '@/gm/platform/menubar/electron-main/menubar';
import { IMenubarData, IMenubarService } from '@/gm/platform/menubar/common/menubar';

import { IWindowsService } from '@/gm/platform/windows/common/windows';
import { IWorkspacesMainService } from '@/gm/platform/workspaces/electron-main/workspacesMainService';
import { ICommandMainService } from '@/gm/platform/commands/electron-main/commands';

import { IWindowsMainService } from '@/gm/platform/windows/electron-main/windows';
import { IStateService } from '@/gm/platform/state/common/state';
import { IHistoryMainService } from '@/gm/platform/history/common/history';

import { IPreferencesService } from '@/gm/platform/preferences/electron-main/preferences';
import { ISessionService } from '@/gm/platform/session/common/session';

export class MenubarService implements IMenubarService {
  private readonly _menubar: Menubar;

  constructor(
    @ILogService private readonly logService: ILogService,
    @IPreferencesService private readonly preferencesService: IPreferencesService,
    @IHistoryMainService private readonly historyMainService: IHistoryMainService,
    @IWindowsService private readonly windowsService: IWindowsService,
    @IStateService private readonly stateService: IStateService,
    @IWorkspacesMainService private readonly workspaceMainService: IWorkspacesMainService,
    @IWindowsMainService private readonly windowsMainService: IWindowsMainService,
    @ICommandMainService private readonly commandMainService: ICommandMainService,
    @ISessionService private readonly sessionService: ISessionService
  ) {
    // Install Menubar
    this._menubar = new Menubar(
      logService,
      preferencesService,
      historyMainService,
      windowsService,
      stateService,
      workspaceMainService,
      windowsMainService,
      commandMainService,
      sessionService
    );

    this.registerListeners();
  }

  public updateMenubar(windowId: number, _menus?: IMenubarData): Promise<void> {
    this.logService.trace('menubarService#updateMenubar', `WindowId ${windowId}`);

    if (this._menubar) {
      this._menubar.updateMenu();
    }

    return Promise.resolve(undefined);
  }

  private registerListeners() {
    this.historyMainService.onRecentlyOpenedChange(() => {
      const lastActiveWindow = this.windowsMainService.getLastActiveWindow();

      if (lastActiveWindow) {
        this.updateMenubar(lastActiveWindow.id);
      }
    });
  }
}
