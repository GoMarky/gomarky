import {
  CodeWindow,
  defaultWindowState,
  ICodeWindow,
  IWindowCreationOptions,
  IWindowRestoredState,
  IWindowState,
  WindowMode,
} from '@/gm/platform/window/electron-main/window';
import { isDev, isMacintosh, isWindows } from '@/gm/base/platform';
import { BrowserWindow, dialog, systemPreferences } from 'electron';

import { ILogService } from '@/gm/platform/log/common/log';
import { ILifecycleService } from '@/gm/platform/lifecycle/electron-main/lifecycle';
import { IStateService } from '@/gm/platform/state/common/state';

import { getLastActiveWindow } from '@/gm/code/common/window';
import {
  getWorkspaceId,
  IWorkspacesMainService,
  WorkspacesMainService,
} from '@/gm/platform/workspaces/electron-main/workspacesMainService';
import { createDecorator } from '@/gm/platform/instantiation/common/instantiation';

import { dirname } from 'path';
import { exists } from '@/gm/base/node/pfs';
import { Disposable } from '@/gm/base/common/lifecycle';

import { Emitter, Event } from '@/gm/base/common/event';
import { IWindowsCountChangedEvent } from '@/gm/platform/windows/electron-main/windowsService';
import { IInternalNativeOpenDialogOptions } from '@/gm/platform/windows/common/windows';

import { basename, URI } from '@/gm/base/common/uri';
import { IWorkspaceIdentifier } from '@/gm/platform/workspaces/common/workspaces';
import { IWorkspace, IWorkspaceId } from '@/gm/platform/workspace/common/workspace';

import { restoreWindowsState } from '@/gm/platform/windows/electron-main/state';
import { ISessionMainService } from '@/gm/platform/session/electron-main/session';
import product from '@/gm/platform/product/node';

export const IWindowsMainService = createDecorator<IWindowsMainService>('windowsMainService');

export interface IWindowsState {
  lastActiveWindow?: IWindowState;
  lastPluginDevelopmentHostWindow?: IWindowState;
  openedWindows: IWindowState[];
}

export const enum CreateContext {
  DOCK, // macOS
  MENU, // from menu
  DIALOG, // from dialog
  DESKTOP, // from desktop
  API, // from api
  DEBUG, // DEBUG USE ONLY IN DEVELOPMENT
}

export interface IWindowsMainService {
  readonly onWindowsCountChanged: Event<IWindowsCountChangedEvent>;
  readonly onWindowClose: Event<number>;

  getLastActiveWindow(): ICodeWindow | undefined;
  openNewWindow(_context: CreateContext, options: IWindowCreationOptions): ICodeWindow;
  sendToFocused(channel: string, ...args: any[]): void;

  sendToAll(channel: string, payload: any): void;
  getFocusedWindow(): ICodeWindow | undefined;
  getWindowById(windowId: number): ICodeWindow | undefined;

  getWindows(): ICodeWindow[];
  getWindowCount(): number;
  showMessageBox(options: Electron.MessageBoxOptions, win?: ICodeWindow): Promise<any>;
  pick(options: any): Promise<string[] | undefined>;

  showSaveDialog(
    options: Electron.SaveDialogOptions,
    window?: ICodeWindow
  ): Promise<Electron.SaveDialogReturnValue>;

  showOpenDialog(
    options: Electron.OpenDialogOptions,
    window?: ICodeWindow
  ): Promise<Electron.OpenDialogReturnValue>;

  enterWorkspace(path: URI): Promise<ICodeWindow>;
  createAndEnterWorkspace(path: URI): Promise<ICodeWindow>;
  createWindowAndEnterWorkspace(identifier: IWorkspaceId): Promise<ICodeWindow>;
  doCreateWorkspace(window: ICodeWindow, workspace: IWorkspace): ICodeWindow;
  open(openConfig: IOpenConfiguration): Promise<ICodeWindow[]>;
  quit(): void;

  openWelcomeWindow(): Promise<void>;
}

export interface IOpenConfiguration {
  context: CreateContext;
  forceEmpty?: boolean;
  initialStartup?: boolean;
}

export class WindowsMainService extends Disposable implements IWindowsMainService {
  private static Windows: ICodeWindow[] = [];
  private static readonly windowsStateStorageKey = 'windowsState';

  private readonly _onWindowClose = this._register(new Emitter<number>());
  readonly onWindowClose: Event<number> = this._onWindowClose.event;

  private readonly dialogService: Dialogs;
  private readonly workspacesManager: WorkspacesManager;
  private readonly windowsState: IWindowsState;

  private readonly _onWindowsCountChanged = this._register(
    new Emitter<IWindowsCountChangedEvent>()
  );
  public readonly onWindowsCountChanged: Event<IWindowsCountChangedEvent> = this
    ._onWindowsCountChanged.event;

  constructor(
    @ILogService private readonly logService: ILogService,
    @ILifecycleService private readonly lifecycleService: ILifecycleService,
    @IStateService private readonly stateService: IStateService,
    @IWorkspacesMainService private readonly workspacesMainService: IWorkspacesMainService,
    @ISessionMainService private readonly sessionMainService: ISessionMainService
  ) {
    super();

    const windowsStateStoreData = this.stateService.getItem<object>(
      WindowsMainService.windowsStateStorageKey
    );

    this.windowsState = restoreWindowsState(windowsStateStoreData as object);

    this.dialogService = new Dialogs(logService, stateService, this);
    this.workspacesManager = new WorkspacesManager(workspacesMainService, this);

    (workspacesMainService as WorkspacesMainService).createIPCServer(this);

    this._registerListeners();
  }

  public sendToAll(channel: string, payload?: any): void {
    WindowsMainService.Windows.forEach(window => {
      window.send(channel, payload);
    });
  }

  public pick(options: any): Promise<string[] | undefined> {
    return this.dialogService.pick(options);
  }

  public showSaveDialog(
    options: Electron.SaveDialogOptions,
    window?: ICodeWindow | undefined
  ): Promise<Electron.SaveDialogReturnValue> {
    return this.dialogService.showSaveDialog(options, window);
  }

  public showOpenDialog(
    options: Electron.OpenDialogOptions,
    window?: ICodeWindow | undefined
  ): Promise<Electron.OpenDialogReturnValue> {
    return this.dialogService.showOpenDialog(options, window);
  }

  public getFocusedWindow(): ICodeWindow | undefined {
    const window = BrowserWindow.getFocusedWindow();

    if (window) {
      return this.getWindowById(window.id);
    }
  }

  public getWindowById(windowId: number): ICodeWindow | undefined {
    const result = WindowsMainService.Windows.find(window => window.id === windowId);

    if (result) {
      return result;
    }

    return undefined;
  }

  public getWindows(): ICodeWindow[] {
    return WindowsMainService.Windows;
  }

  public getWindowCount(): number {
    return WindowsMainService.Windows.length;
  }

  public async open(openConfig: IOpenConfiguration): Promise<ICodeWindow[]> {
    const windows: ICodeWindow[] = [];
    const openedWindows = this.windowsState.openedWindows as IWindowRestoredState[];

    if (openConfig.forceEmpty) {
      /**
       * TODO:
       *  Allow open empty workspace and load folders to it
       */
      // return this.createAndEnterWorkspace();
    }

    if (Array.isArray(openedWindows)) {
      for (const win of openedWindows) {
        if (!win.workspace) {
          continue;
        }

        const window = await this.createAndEnterWorkspace(win.workspace.configPath);

        windows.push(window);
      }
    }

    return windows;
  }

  public openNewWindow(_: CreateContext, options: IWindowCreationOptions): ICodeWindow {
    const window = new CodeWindow(
      { state: options.state },
      this.logService,
      this.workspacesMainService,
      this.sessionMainService
    );

    window.load(
      {
        openedWorkspace: options.workspace,
        logLevel: this.logService.getLevel(),
        forcedUrl: options.forcedUrl,
      },
      false
    );

    WindowsMainService.Windows.push(window);

    this._onWindowsCountChanged.fire({
      oldCount: WindowsMainService.Windows.length - 1,
      newCount: WindowsMainService.Windows.length,
    });

    window.win.on('closed', () => this.onWindowClosed(window));

    this.lifecycleService.registerWindow(window);

    return window;
  }

  private onWindowClosed(win: ICodeWindow): void {
    win.dispose();

    const index = WindowsMainService.Windows.indexOf(win);

    WindowsMainService.Windows.splice(index, 1);

    this._onWindowsCountChanged.fire({
      oldCount: WindowsMainService.Windows.length + 1,
      newCount: WindowsMainService.Windows.length,
    });

    this._onWindowClose.fire(win.id);
  }

  public getLastActiveWindow(): CodeWindow | undefined {
    return getLastActiveWindow(WindowsMainService.Windows as CodeWindow[]);
  }

  public quit(): void {
    this.lifecycleService.quit();
  }

  public sendToFocused(channel: string, ...args: any[]): void {
    const focusedWindow = this.getFocusedWindow() || this.getLastActiveWindow();

    if (focusedWindow) {
      focusedWindow.send(channel, ...args);
    }
  }

  public showMessageBox(options: Electron.MessageBoxOptions, win?: ICodeWindow): Promise<any> {
    return this.dialogService.showMessageBox(options, win);
  }

  public enterWorkspace(path: URI): Promise<ICodeWindow> {
    return this.workspacesManager.enterWorkspace(path);
  }

  public async createWindowAndEnterWorkspace(identifier: IWorkspaceId): Promise<ICodeWindow> {
    const workspace: IWorkspace = await this.workspacesMainService.getWorkspaceById(identifier);

    const storage = workspace.storage;

    const window = this.openNewWindow(CreateContext.DESKTOP, {
      state: { ...{ width: 1280, height: 720 }, ...storage.get('windowState') },
    });

    return this.doCreateWorkspace(window, workspace);
  }

  public async createAndEnterWorkspace(path: URI): Promise<ICodeWindow> {
    const workspace: IWorkspace = await this.workspacesMainService.createUntitledWorkspace({
      location: path,
    });

    const storage = workspace.storage;

    const window = this.openNewWindow(CreateContext.DESKTOP, {
      state: {
        ...{ width: 1280, height: 720 },
        ...storage.get('windowState'),
      },
      workspace: {
        id: workspace.id,
        configPath: workspace.uri,
      },
    });

    return this.doCreateWorkspace(window, workspace);
  }

  public doCreateWorkspace(window: ICodeWindow, workspace: IWorkspace): ICodeWindow {
    window.win.on('close', () => {
      workspace.storage.set('windowState', window.serializeWindowState());
    });

    window.win.on('hide', () => {
      workspace.storage.set('windowState', window.serializeWindowState());
    });

    window.win.setTitle(`${product.nameLong} - ${basename(workspace.uri)}`);

    if (isDev) {
      const contents = window.win.webContents;

      contents.openDevTools({ mode: 'right' });
    }

    return window;
  }

  public async openWelcomeWindow(): Promise<void> {
    // window that doesn't have active workspace - is a an welcome window
    const window = WindowsMainService.Windows.find(window => !window.config.openedWorkspace);

    // if welcome window already opened we should only focus on it
    if (window) {
      return window.focus();
    }

    const windowState = this.stateService.getItem<IWindowState>(
      'welcomeWindowState',
      defaultWindowState()
    );

    windowState.mode = WindowMode.Normal;

    const welcomeWindow = this.openNewWindow(CreateContext.API, {
      state: windowState,
    });

    welcomeWindow.win.setTitle(`Welcome to ${product.nameLong}`);
  }

  private toWindowState(win: ICodeWindow): IWindowState {
    return {
      workspace: win.openedWorkspace,
      folderUri: win.openedFolderUri,
      uiState: win.serializeWindowState(),
      // TODO:
    } as any;
  }

  private onBeforeShutdown(): void {
    const currentWindowsState: IWindowsState = {
      openedWindows: [],
    };

    const activeWindow = this.getLastActiveWindow();

    if (activeWindow && activeWindow.openedWorkspace) {
      currentWindowsState.lastActiveWindow = this.toWindowState(activeWindow);
    }

    const workspaceWindows = WindowsMainService.Windows.filter(
      (window: ICodeWindow) => window.openedWorkspace
    );

    const len = workspaceWindows.length - 1;

    if (workspaceWindows.length > 0) {
      const windowsState = [];

      for (let i = 0; i <= len; i += 1) {
        const window = workspaceWindows[i];
        windowsState.push(this.toWindowState(window));
      }

      currentWindowsState.openedWindows = windowsState;
    }

    try {
      this.stateService.setItem(WindowsMainService.windowsStateStorageKey, currentWindowsState);
    } catch (error) {
      this.logService.error(
        'WindowsMainService#onBeforeShutdown',
        `Cant clear ${WindowsMainService.windowsStateStorageKey} states. ${JSON.stringify(error)}`
      );
    }
  }

  private _registerListeners(): void {
    if (isWindows) {
      systemPreferences.on('inverted-color-scheme-changed', () => {
        if (systemPreferences.isInvertedColorScheme()) {
          // notify all windows about enter High Contrast
        } else {
          // notify all windows about leaving High Contrast
        }
      });
    }

    this.lifecycleService.onBeforeShutdown(() => this.onBeforeShutdown());
  }
}

export class Dialogs {
  private static readonly workingDirPickerStorageKey = 'pickerWorkingDir';

  constructor(
    @ILogService private readonly logService: ILogService,
    private readonly stateService: IStateService,
    private readonly windowsMainService: IWindowsMainService
  ) {}

  public pick(options: IInternalNativeOpenDialogOptions): Promise<string[] | undefined> {
    const dialogOptions: Electron.OpenDialogOptions = {
      title: options.title,
      buttonLabel: options.buttonLabel,
      filters: options.filters,
    };

    dialogOptions.defaultPath =
      options.defaultPath || this.stateService.getItem<string>(Dialogs.workingDirPickerStorageKey);

    if (typeof options.pickFiles === 'boolean' || typeof options.pickFolders === 'boolean') {
      dialogOptions.properties = undefined;

      if (options.pickFiles && options.pickFolders) {
        dialogOptions.properties = [
          'multiSelections',
          'openDirectory',
          'openFile',
          'createDirectory',
        ];
      }
    }

    if (!dialogOptions.properties) {
      dialogOptions.properties = [
        'multiSelections',
        options.pickFolders ? 'openDirectory' : 'openFile',
        'createDirectory',
      ];
    }

    if (isMacintosh) {
      dialogOptions.properties.push('treatPackageAsDirectory');
    }

    const focusedWindow =
      (typeof options.windowId === 'number'
        ? this.windowsMainService.getWindowById(options.windowId)
        : undefined) || this.windowsMainService.getFocusedWindow();

    return this.showOpenDialog(dialogOptions, focusedWindow).then(result => {
      if (result.filePaths.length > 0) {
        this.stateService.setItem(Dialogs.workingDirPickerStorageKey, dirname(result.filePaths[0]));

        return result.filePaths;
      }

      return undefined;
    });
  }

  public showSaveDialog(
    options: Electron.SaveDialogOptions,
    window?: ICodeWindow
  ): Promise<Electron.SaveDialogReturnValue> {
    if (window) {
      return dialog.showSaveDialog(window.win, options);
    } else {
      return dialog.showSaveDialog(options);
    }
  }

  public showOpenDialog(
    options: Electron.OpenDialogOptions,
    window?: ICodeWindow
  ): Promise<Electron.OpenDialogReturnValue> {
    return new Promise((resolve: any) => {
      let validatePathPromise: Promise<void> = Promise.resolve();

      if (options.defaultPath) {
        validatePathPromise = exists(options.defaultPath).then(exists => {
          if (!exists) {
            options.defaultPath = undefined;
          }
        });
      }

      validatePathPromise.then(async () => {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const data = dialog.showOpenDialog(window!.win, options);

        resolve(data);
      });
    });
  }

  public showMessageBox(options: Electron.MessageBoxOptions, window?: ICodeWindow): Promise<any> {
    if (window) {
      return dialog.showMessageBox(window.win, options);
    } else {
      return dialog.showMessageBox(options);
    }
  }
}

export class WorkspacesManager {
  constructor(
    private readonly workspacesMainService: IWorkspacesMainService,
    private readonly windowsMainService: IWindowsMainService
  ) {}

  public async enterWorkspace(path: URI): Promise<ICodeWindow> {
    const workspace = await this.workspacesMainService.getWorkspaceByURI(path);

    if (!workspace) {
      return this.windowsMainService.createAndEnterWorkspace(path);
    }

    return this.doOpenWorkspace(workspace);
  }

  private async doOpenWorkspace(workspace: IWorkspace): Promise<ICodeWindow> {
    const storage = workspace.storage;

    const window = this.windowsMainService.openNewWindow(CreateContext.DESKTOP, {
      state: {
        ...{ width: 1280, height: 720 },
        ...storage.get('windowState'),
      },
      workspace: {
        id: workspace.id,
        configPath: workspace.uri,
      },
    });

    window.win.setTitle(`GoMarky-M - ${basename(workspace.uri)}`);

    return this.windowsMainService.doCreateWorkspace(window, workspace);
  }
}

export function getWorkspaceIdentifier(configPath: URI): IWorkspaceIdentifier {
  return {
    configPath,
    id: getWorkspaceId(configPath),
  };
}
