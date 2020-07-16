import product from '@/gm/platform/product/node';
import { app, shell, WebContents } from 'electron';
import {
  ILifecycleService,
  LifecycleMainPhase,
} from '@/gm/platform/lifecycle/electron-main/lifecycle';

import { ILogService } from '@/gm/platform/log/common/log';
import { ServiceCollection } from '@/gm/platform/instantiation/common/ServiceCollection';
import {
  CreateContext,
  IWindowsMainService,
  WindowsMainService,
} from '@/gm/platform/windows/electron-main/windows';

import {
  IWorkspacesMainService,
  WorkspacesMainService,
} from '@/gm/platform/workspaces/electron-main/workspacesMainService';
import { IStateService } from '@/gm/platform/state/common/state';
import { IStorageService } from '@/gm/platform/storage/common/storage';

import { WindowsService } from '@/gm/platform/windows/electron-main/windowsService';
import { MenubarService } from '@/gm/platform/menubar/electron-main/menubarService';
import { IMenubarService } from '@/gm/platform/menubar/common/menubar';

import { IWindowsService } from '@/gm/platform/windows/common/windows';
import { MenubarChannel } from '@/gm/platform/menubar/node/menubar';
import { IPCServer } from '@/gm/platform/ipc/electron-main/ipcServer';

import { WindowsChannel } from '@/gm/platform/windows/node/windows';
import { WorkspacesChannel } from '@/gm/platform/workspaces/node/workspaces';
import { isWindows } from '@/gm/base/platform';

import { CommandService, ICommandMainService } from '@/gm/platform/commands/electron-main/commands';
import { HistoryMainService } from '@/gm/platform/history/electron-main/history';
import { IHistoryMainService } from '@/gm/platform/history/common/history';
import { StateServiceChannel } from '@/gm/platform/state/node/state';

import { IWindowState, WindowMode } from '@/gm/platform/window/electron-main/window';
import { WorkspacesService } from '@/gm/platform/workspaces/electron-main/workspacesService';
import { IWorkspacesService } from '@/gm/platform/workspaces/common/workspaces';

import { IInstantiationService } from '@/gm/platform/instantiation/common/instantiation';
import { KeyboardChannel } from '@/gm/platform/keyboard/node/keyboard';
import { KeyboardRegistry } from '@/gm/platform/keyboard/electron-main/keyboard';

import {
  IPreferencesService,
  PreferencesService,
} from '@/gm/platform/preferences/electron-main/preferences';

import { FileService } from '@/gm/platform/files/common/fileService';
import { IFileService } from '@/gm/platform/files/common/files';
import { SessionMainService } from '@/gm/platform/session/electron-main/sessionMainService';

import { ISessionMainService } from '@/gm/platform/session/electron-main/session';
import { IRequestService } from '@/gm/platform/request/common/requestService';

import { SessionService } from '@/gm/platform/session/electron-main/sessionService';
import { ISessionService, SessionError } from '@/gm/platform/session/common/session';
import { SessionChannel } from '@/gm/platform/session/node/session';

import { IEnvironmentService } from '@/gm/platform/env/node/environmentService';
import requests from '@/gm/platform/request/electron-main/request/requests';

export class CodeApplication {
  private windowsMainService: IWindowsMainService;

  constructor(
    @IInstantiationService private readonly instantiationService: IInstantiationService,
    @ILifecycleService private readonly lifecycleService: ILifecycleService,
    @ILogService private readonly logService: ILogService,
    @IStateService private readonly stateService: IStateService
  ) {
    this.registerListeners();
  }

  public startup(services: ServiceCollection): void {
    if (isWindows && product) {
      app.setAppUserModelId(product.win32AppUserModelId);
    }

    void this.initServices(services).then(() => this.openFirstWindow(services));
  }

  private async openFirstWindow(services: ServiceCollection): Promise<void> {
    const ipcServer = new IPCServer(this.windowsMainService);

    const menubarService = services.get(IMenubarService);
    const menubarChannel = new MenubarChannel(menubarService);
    ipcServer.registerChannel('menubar', menubarChannel);

    const windowsService = services.get(IWindowsService);
    const windowsChannel = new WindowsChannel(windowsService);
    ipcServer.registerChannel('windows', windowsChannel);

    const workspacesService = services.get(IWorkspacesService);
    const workspacesChannel = new WorkspacesChannel(workspacesService);
    ipcServer.registerChannel('workspaces', workspacesChannel);

    const stateService = services.get(IStateService);
    const stateServiceChannel = new StateServiceChannel(stateService);
    ipcServer.registerChannel('state', stateServiceChannel);

    const sessionService = services.get(ISessionService);
    const sessionChannel = new SessionChannel(sessionService);
    ipcServer.registerChannel('session', sessionChannel);

    const keyboardChannel = new KeyboardChannel(this.instantiationService, KeyboardRegistry);
    ipcServer.registerChannel('keyboard', keyboardChannel);

    this.lifecycleService.phase = LifecycleMainPhase.Ready;

    try {
      // Session time is not coming yet.
      // await sessionMainService.restoreSession();

      return this.doOpenFirstWindow();
    } catch (error) {
      // if we cant restore session we should send user to license window

      if (error instanceof SessionError) {
        this.logService.error(`CodeApplication#openFirstWindow`, `Session was not found`);

        return this.openLicenseWindow();
      }

      return this._onUnexpectedError(error);
    }
  }

  private async doOpenFirstWindow(): Promise<void> {
    // if user has not active license we should show window with it.

    const openedWindows = await this.windowsMainService.open({
      context: CreateContext.API,
      initialStartup: true,
    });

    if (!openedWindows.length) {
      await this.windowsMainService.openWelcomeWindow();
    }

    this.lifecycleService.phase = LifecycleMainPhase.AfterWindowOpen;
  }

  private async openLicenseWindow(): Promise<void> {
    const windowState: IWindowState = {};

    windowState.mode = WindowMode.Normal;

    this.windowsMainService.openNewWindow(CreateContext.API, {
      state: windowState,
      forcedUrl: 'license.html',
    });
  }

  private async initServices(services: ServiceCollection) {
    const lifecycleService = services.get(ILifecycleService);
    const logService = services.get(ILogService);
    const stateService = services.get(IStateService);

    const storageService = services.get(IStorageService);
    const instantiationService = services.get(IInstantiationService);
    const environmentService = services.get(IEnvironmentService);
    const requestService = services.get(IRequestService);

    requestService.registerRequests(requests);

    const fileService = new FileService(logService);
    services.set(IFileService, fileService);

    const sessionMainService = new SessionMainService(
      requestService,
      fileService,
      stateService,
      environmentService
    );
    services.set(ISessionMainService, sessionMainService);

    const historyMainService = new HistoryMainService(stateService);
    services.set(IHistoryMainService, historyMainService);

    const workspaceMainService = new WorkspacesMainService(
      logService,
      lifecycleService,
      historyMainService,
      storageService,
      stateService
    );
    services.set(IWorkspacesMainService, workspaceMainService);

    const workspaceService = new WorkspacesService(
      workspaceMainService,
      logService,
      lifecycleService,
      stateService,
      historyMainService
    );
    services.set(IWorkspacesService, workspaceService);

    const windowsMainService = (this.windowsMainService = new WindowsMainService(
      logService,
      lifecycleService,
      stateService,
      workspaceMainService,
      sessionMainService
    ));
    services.set(IWindowsMainService, windowsMainService);

    const preferencesService = new PreferencesService(
      instantiationService,
      windowsMainService,
      stateService
    );
    services.set(IPreferencesService, preferencesService);

    const commandMainService = new CommandService(windowsMainService);
    services.set(ICommandMainService, commandMainService);

    const windowsService = new WindowsService(
      windowsMainService,
      historyMainService,
      lifecycleService,
      logService,
      environmentService
    );
    services.set(IWindowsService, windowsService);

    const sessionService = new SessionService(sessionMainService);
    services.set(ISessionService, sessionService);

    const menubarService = new MenubarService(
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
    services.set(IMenubarService, menubarService);
  }

  private _onUnexpectedError(err: Error): void {
    this.logService.error(`[uncaught exception in main]: ${err}`);

    if (err.stack) {
      this.logService.error(err.stack);
    }
  }

  private registerListeners(): void {
    this.lifecycleService.onWillOpenWelcomeWindow(() => {
      return this.windowsMainService.openWelcomeWindow();
    });

    process.on('uncaughtException', err => this._onUnexpectedError(err));

    process.on('unhandledRejection', (reason: unknown) => this._onUnexpectedError(reason as Error));

    app.on('web-contents-created', (_: unknown, contents: WebContents) => {
      contents.on('new-window', async (event: Event, url: string) => {
        event.preventDefault();

        try {
          await shell.openExternal(url);
        } catch (err) {
          // catching error when open link
        }
      });
    });
  }
}
