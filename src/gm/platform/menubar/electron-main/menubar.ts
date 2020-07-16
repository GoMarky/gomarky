import { ILogService } from '@/gm/platform/log/common/log';
import { app, Menu, MenuItem } from 'electron';
import { isLinux, isMacintosh } from '@/gm/base/platform';

import path from 'path';
import { IWorkspacesMainService } from '@/gm/platform/workspaces/electron-main/workspacesMainService';
import { URI } from '@/gm/base/common/uri';

import product from '@/gm/platform/product/node';
import { IWindowsService } from '@/gm/platform/windows/common/windows';
import { IMenubarMenu } from '@/gm/platform/menubar/common/menubar';

import { ICommandMainService } from '@/gm/platform/commands/electron-main/commands';
import { IWindowsMainService } from '@/gm/platform/windows/electron-main/windows';
import { IStateService } from '@/gm/platform/state/common/state';

import { IHistoryMainService } from '@/gm/platform/history/common/history';
import { IPreferencesService } from '@/gm/platform/preferences/electron-main/preferences';
import { ISessionService } from '@/gm/platform/session/common/session';

function __separator__(): Electron.MenuItem {
  return new MenuItem({ type: 'separator' });
}

export interface IMenubar {
  install(): void;
}

export class Menubar implements IMenubar {
  private menubarMenus: { [id: string]: IMenubarMenu };

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
    this.install();
  }

  public updateMenu() {
    /**
     * TODO:
     *  This time - just installing again.
     */
    this.install();
  }

  public install() {
    this.logService.info('Menubar#install');

    const menubar = new Menu();

    let macApplicationMenuItem: Electron.MenuItem;

    // Application Menu

    if (isMacintosh) {
      const applicationMenu = new Menu();
      macApplicationMenuItem = new MenuItem({ label: 'gomarky', submenu: applicationMenu });
      this.setMacApplicationMenu(applicationMenu);
      menubar.append(macApplicationMenuItem);
    }

    const fileMenu = new Menu();
    const fileMenuItem = new MenuItem({ label: 'File', submenu: fileMenu });

    const openWorkspaceItem = new MenuItem({
      label: 'Open project list',
      click: () => this.windowsMainService.openWelcomeWindow(),
    });

    const recentWorkspaceMenu = new Menu();
    const reopenClosedWorkspaceItem = new MenuItem({
      label: 'Reopen closed Workspace',
      click: () => ({}),
    });

    const recentWorkspaces: string[] = this.historyMainService.getRecentlyOpened();
    const workspacesMenuItems: MenuItem[] = [];

    for (const projectPath of recentWorkspaces) {
      const uri = URI.file(projectPath);

      workspacesMenuItems.push(
        new MenuItem({
          label: path.basename(uri.path),
          click: () => this.windowsMainService.enterWorkspace(uri),
        })
      );
    }

    recentWorkspaceMenu.append(reopenClosedWorkspaceItem);
    recentWorkspaceMenu.append(__separator__());
    workspacesMenuItems.forEach((item: Electron.MenuItem) => recentWorkspaceMenu.append(item));
    recentWorkspaceMenu.append(__separator__());

    const recentWorkspaceItem = new MenuItem({
      label: 'Open Recent',
      submenu: recentWorkspaceMenu,
    });

    const closeWindowItem = new MenuItem({
      label: 'Close Window',
      click: () => ({}),
    });

    fileMenu.append(openWorkspaceItem);
    fileMenu.append(recentWorkspaceItem);
    fileMenu.append(__separator__());

    const preferences = new MenuItem({
      label: 'Preferences',
      click: () => {
        const lastActiveWindow = this.windowsMainService.getLastActiveWindow();

        if (!lastActiveWindow?.openedWorkspace) {
          return;
        }

        const settingsWindow = this.preferencesService.openSettingsWindow(
          lastActiveWindow.openedWorkspace
        );

        settingsWindow.win.setParentWindow(lastActiveWindow.win);
      },
    });

    if (isLinux) {
      fileMenu.append(preferences);
    }

    menubar.append(fileMenuItem);

    const developmentMenu = new Menu();

    const redoCommandMenuItem = new MenuItem({
      label: 'Redo',
      click: () => {
        this.commandMainService.executeCommandInRenderer('gomarky.command.redo');
      },
    });

    const undoCommandMenuItem = new MenuItem({
      label: 'Undo',
      click: () => {
        this.commandMainService.executeCommandInRenderer('gomarky.command.undo');
      },
    });

    const devToolsMenuItem = new MenuItem({
      label: 'Toggle DevTools',
      click: () => {
        const lastActiveWindow = this.windowsMainService.getLastActiveWindow();

        if (!lastActiveWindow) {
          return;
        }

        return this.windowsService.toggleDevTools(lastActiveWindow.id);
      },
    });

    const actions = [redoCommandMenuItem, undoCommandMenuItem, __separator__(), devToolsMenuItem];

    actions.forEach((item: Electron.MenuItem) => developmentMenu.append(item));

    const developmentMenuItem: Electron.MenuItem = new MenuItem({
      label: 'Development',
      submenu: developmentMenu,
    });

    menubar.append(developmentMenuItem);

    // Dock Menu

    if (isMacintosh) {
      const dockMenu = new Menu();

      // create "New Window" dock menu

      dockMenu.append(
        new MenuItem({
          label: 'Open project List',
          click: () => this.windowsMainService.openWelcomeWindow(),
        })
      );

      dockMenu.append(__separator__());

      // create "Recent Projects" dock menu

      const recentWorkspaces: string[] = this.historyMainService.getRecentlyOpened();
      const projectsMenu: MenuItem[] = [];

      for (const projectPath of recentWorkspaces) {
        const uri = URI.file(projectPath);

        projectsMenu.push(
          new MenuItem({
            label: path.basename(uri.path),
            click: () => this.windowsMainService.enterWorkspace(uri),
          })
        );
      }

      if (projectsMenu.length > 0) {
        dockMenu.append(
          new MenuItem({
            label: 'Recent Projects',
            submenu: Menu.buildFromTemplate(projectsMenu),
          })
        );
      }

      app.dock.setMenu(dockMenu);
    }

    // Help
    const helpMenu = new Menu();
    const helpMenuItem = new MenuItem({ label: 'Help', submenu: helpMenu, role: 'help' });

    if (isLinux) {
      const about = new MenuItem({
        label: `About ${product.nameLong}`,
        click: () => {
          return this.windowsService.openAboutDialog();
        },
      });

      helpMenu.append(about);
      helpMenu.append(__separator__());
    }

    const checkForUpdatesMenuItem = new MenuItem({ label: 'Check for updates' });

    const sessionLogoutMenuItem = new MenuItem({
      label: 'Close session',
      click: () => {
        return this.sessionService.logout();
      },
    });

    helpMenu.append(checkForUpdatesMenuItem);
    helpMenu.append(sessionLogoutMenuItem);
    menubar.append(helpMenuItem);

    Menu.setApplicationMenu(menubar);
  }

  private setMacApplicationMenu(macApplicationMenu: Electron.Menu): void {
    const about = new MenuItem({
      label: `About ${product.nameLong}`,
      click: () => {
        return this.windowsService.openAboutDialog();
      },
    });

    const preferences = new MenuItem({
      label: 'Preferences',
      click: () => {
        const lastActiveWindow = this.windowsMainService.getLastActiveWindow();

        if (!lastActiveWindow?.openedWorkspace) {
          return;
        }

        const settingsWindow = this.preferencesService.openSettingsWindow(
          lastActiveWindow.openedWorkspace
        );

        settingsWindow.win.setParentWindow(lastActiveWindow.win);
      },
    });

    const servicesMenu = new Menu();
    const services = new MenuItem({
      label: 'Services',
      role: 'services',
      submenu: servicesMenu,
    });

    const hide = new MenuItem({
      label: 'Hide',
      role: 'hide',
      accelerator: 'Command+H',
    });

    const hideOthers = new MenuItem({
      label: 'Hide others',
      role: 'hideOthers',
      accelerator: 'Command+Alt+H',
    });

    const showAll = new MenuItem({ label: 'Show all', role: 'unhide' });

    const quit = new MenuItem({
      label: 'Quit',
      click: () => {
        return this.windowsService.quit();
      },
    });

    const actions = [];

    actions.push(...[__separator__(), about]);

    if (preferences) {
      actions.push(...[__separator__(), preferences]);
    }

    actions.push(
      ...[
        __separator__(),
        services,
        __separator__(),
        hide,
        hideOthers,
        showAll,
        __separator__(),
        quit,
      ]
    );

    actions.forEach((item: Electron.MenuItem) => macApplicationMenu.append(item));
  }

  private setMenuById(menu: Electron.Menu, menuId: string): void {
    if (this.menubarMenus && this.menubarMenus[menuId]) {
      this.setMenu(menu, this.menubarMenus[menuId].items);
    }
  }

  private setMenu(_menu: Electron.Menu, _items: any[]) {
    //
  }
}
