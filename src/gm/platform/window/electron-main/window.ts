import { app, BrowserWindow, screen, systemPreferences } from 'electron';
import { isDev, isMacintosh } from '@/gm/base/platform';
import { ILogService } from '@/gm/platform/log/common/log';

import { IWorkspacesMainService } from '@/gm/platform/workspaces/electron-main/workspacesMainService';
import { Disposable, toDisposable } from '@/gm/base/common/lifecycle';
import { IWindowConfiguration } from '@/gm/platform/windows/common/windows';

import { URI } from '@/gm/base/common/uri';
import { IWorkspaceIdentifier } from '@/gm/platform/workspaces/common/workspaces';
import product from '@/gm/platform/product/node';

import { Emitter, Event } from '@/gm/base/common/event';
import { RunOnceScheduler } from '@/gm/base/common/async';
import * as perf from '@/gm/base/common/perfomance';
import { ISessionMainService } from '@/gm/platform/session/electron-main/session';
import { KeyboardRegistry } from '@/gm/platform/keyboard/electron-main/keyboard';

export interface IWindowState {
  width?: number;
  height?: number;
  x?: number;
  y?: number;
  mode?: WindowMode;
  display?: number;
}

export interface IWindowRestoredState {
  uiState: IWindowState;
  workspace?: { id: string; configPath: URI };
}

export interface IWindowCreationOptions {
  state: IWindowState;
  workspace?: IWorkspaceIdentifier;
  forcedUrl?: string;
}

export const enum WindowMode {
  Maximized,
  Normal,
  Fullscreen,
}

export const defaultWindowState = (mode = WindowMode.Normal): IWindowState => {
  return {
    width: 1280,
    height: 720,
    mode,
  };
};

export interface ICodeWindow {
  readonly id: number;
  readonly win: Electron.BrowserWindow;
  readonly isReady: boolean;

  readonly config: IWindowConfiguration;
  readonly openedFolderUri?: URI;
  readonly openedWorkspace?: IWorkspaceIdentifier;

  readonly onClose: Event<void>;
  readonly onDestroy: Event<void>;
  readonly onLoad: Event<void>;

  isFullScreen: boolean;

  addTabbedWindow(window: ICodeWindow): void;

  focus(): void;
  hide(): void;
  close(): void;

  getBounds(): Electron.Rectangle;
  setReady(): void;
  ready(): Promise<ICodeWindow>;

  send(channel: string, ...args: any[]): void;
  sendWhenReady(channel: string, ...args: any[]): void;
  setBounds(bounds: Partial<Electron.Rectangle>, animate?: boolean): void;

  load(config: IWindowConfiguration, isReload?: boolean): void;
  reload(configurationToReload?: IWindowConfiguration): void;
  toggleFullScreen(): void;

  isMinimized(): boolean;
  hasHiddenTitleBarStyle(): boolean;
  getRepresentedFilename(): string;

  onWindowTitleDoubleClick(): void;
  serializeWindowState(): IWindowState;
  dispose(): void;
}

export const enum ReadyState {
  NONE,
  LOADING,
  NAVIGATING,
  READY,
}

export class CodeWindow extends Disposable implements ICodeWindow {
  private static readonly MIN_WIDTH = 820;
  private static readonly MIN_HEIGHT = 450;

  private static readonly MAX_URL_LENGTH = 2 * 1024 * 1024; // https://cs.chromium.org/chromium/src/url/url_constants.cc?l=32

  private readonly hiddenTitleBarStyle: boolean;
  private readonly showTimeoutHandle: NodeJS.Timeout;

  private _lastFocusTime: number;
  private _readyState: ReadyState = ReadyState.NONE;

  private readonly windowState: IWindowState;
  private representedFilename: string;

  private pendingLoadConfig?: IWindowConfiguration;

  private readonly whenReadyCallbacks: { (window: ICodeWindow): void }[] = [];

  private readonly _onClose = this._register(new Emitter<void>());
  public readonly onClose: Event<void> = this._onClose.event;

  private readonly _onDestroy = this._register(new Emitter<void>());
  public readonly onDestroy: Event<void> = this._onDestroy.event;

  private readonly _onLoad = this._register(new Emitter<void>());
  public readonly onLoad: Event<void> = this._onLoad.event;

  constructor(
    config: IWindowCreationOptions,
    @ILogService private readonly logService: ILogService,
    @IWorkspacesMainService private readonly workspacesMainService: IWorkspacesMainService,
    @ISessionMainService private readonly sessionMainService: ISessionMainService
  ) {
    super();

    this._lastFocusTime = -1;

    {
      const [state] = this.restoreWindowState(config.state);
      this.windowState = state;

      const isFullscreenOrMaximized =
        this.windowState.mode === WindowMode.Maximized ||
        this.windowState.mode === WindowMode.Fullscreen;

      const options: Electron.BrowserWindowConstructorOptions = {
        width: this.windowState.width,
        height: this.windowState.height,
        x: this.windowState.x,
        y: this.windowState.y,
        minWidth: CodeWindow.MIN_WIDTH,
        minHeight: CodeWindow.MIN_HEIGHT,
        show: !isFullscreenOrMaximized,
        title: product.nameLong,
        webPreferences: {
          backgroundThrottling: false,
          nodeIntegration: true,
          webSecurity: false,
        },
      };

      if (isMacintosh) {
        options.fullscreenable = false;
      }

      if (isMacintosh) {
        options.acceptFirstMouse = true;
      }

      if (isMacintosh) {
        options.tabbingIdentifier = 'gomarky';
      }

      this._win = new BrowserWindow(options);
      this._id = this._win.id;

      if (isMacintosh) {
        this._win.setSheetOffset(22);
      }

      if (isFullscreenOrMaximized) {
        this._win.maximize();

        if (this.windowState.mode === WindowMode.Fullscreen) {
          this.setFullScreen(true);
        }

        if (!this._win.isVisible()) {
          this._win.show();
        }
      }

      this._lastFocusTime = Date.now();
    }

    this.registerListeners();
  }

  private currentConfig: IWindowConfiguration;
  public get config(): IWindowConfiguration {
    return this.currentConfig;
  }

  private readonly _id: number;
  public get id(): number {
    return this._id;
  }

  private _win: Electron.BrowserWindow;
  public get win(): Electron.BrowserWindow {
    return this._win;
  }

  public get lastFocusTime(): number {
    return this._lastFocusTime;
  }

  public get isReady(): boolean {
    return this._readyState === ReadyState.READY;
  }

  public get openedWorkspace(): IWorkspaceIdentifier | undefined {
    return this.currentConfig ? this.currentConfig.openedWorkspace : undefined;
  }

  public get openedFolderUri(): URI | undefined {
    return this.currentConfig ? this.currentConfig.folderUri : undefined;
  }

  public hasHiddenTitleBarStyle(): boolean {
    return this.hiddenTitleBarStyle;
  }

  public setRepresentedFilename(filename: string): void {
    if (isMacintosh) {
      this.win.setRepresentedFilename(filename);
    } else {
      this.representedFilename = filename;
    }
  }

  public getRepresentedFilename(): string {
    if (isMacintosh) {
      return this.win.getRepresentedFilename();
    }

    return this.representedFilename;
  }

  public setReady(): void {
    this._readyState = ReadyState.READY;

    while (this.whenReadyCallbacks.length) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      this.whenReadyCallbacks.pop()!(this);
    }
  }

  public ready(): Promise<ICodeWindow> {
    return new Promise<ICodeWindow>(resolve => {
      if (this.isReady) {
        return resolve(this);
      }

      this.whenReadyCallbacks.push(resolve);
    });
  }

  public focus(): void {
    if (!this._win) {
      return;
    }

    if (this._win.isMinimized()) {
      this._win.restore();
    }

    this._win.focus();
  }

  public addTabbedWindow(window: ICodeWindow): void {
    if (isMacintosh) {
      this._win.addTabbedWindow(window.win);
    }
  }

  public reload(configurationToReload?: IWindowConfiguration): void {
    this.currentConfig = {
      ...this.currentConfig,
      ...configurationToReload,
    };

    this.currentConfig.isInitialStartup = false;

    this.load(this.currentConfig, true);
  }

  public load(config: IWindowConfiguration, isReload?: boolean): void {
    // If this is the first time the window is loaded, we associate the paths
    // directly with the window because we assume the loading will just work
    if (this._readyState === ReadyState.NONE) {
      this.currentConfig = config;
    }

    if (!isReload) {
      if (this.getRepresentedFilename()) {
        this.setRepresentedFilename('');
      }

      this._win.setTitle(product.nameLong);
    }

    perf.mark('main:loadWindow');

    const configuration = Object.assign({}, config);
    configuration.session = this.sessionMainService.configuration;
    this._win.loadURL(this.getUrl(configuration)).then(() => this._onLoad.fire());
  }

  public getBounds(): Electron.Rectangle {
    const pos = this._win.getPosition();
    const dimension = this._win.getSize();

    return { x: pos[0], y: pos[1], width: dimension[0], height: dimension[1] };
  }

  public setBounds(bounds: Partial<Electron.Rectangle>, animate = false): void {
    // get current bounds
    const currentBounds = this.getBounds();

    return this._win.setBounds({ ...currentBounds, ...bounds }, animate);
  }

  public toggleFullScreen(): void {
    this.setFullScreen(!this.isFullScreen);
  }

  public get isFullScreen(): boolean {
    return this._win.isFullScreen() || this._win.isSimpleFullScreen();
  }

  public isMinimized(): boolean {
    return this._win.isMinimized();
  }

  public serializeWindowState(): IWindowState {
    const state: IWindowState = Object.create(null);
    const bounds = this.getBounds();
    const display = screen.getDisplayMatching(bounds);

    state.display = display.id;
    state.mode = WindowMode.Normal;

    state.x = bounds.x;
    state.y = bounds.y;
    state.width = bounds.width;
    state.height = bounds.height;

    return state;
  }

  public onWindowTitleDoubleClick(): void {
    if (isMacintosh) {
      const action = systemPreferences.getUserDefault('AppleActionOnDoubleClick', 'string');

      switch (action) {
        case 'Minimize':
          this.win.minimize();
          break;
        case 'None':
          break;
        case 'Maximize':
        default:
          if (this.win.isMaximized()) {
            this.win.unmaximize();
          } else {
            this.win.maximize();
          }
          break;
      }
    } else {
      if (this.win.isMaximized()) {
        this.win.unmaximize();
      } else {
        this.win.maximize();
      }
    }
  }

  public close(): void {
    if (this._win) {
      this._win.close();
    }
  }

  public hide(): void {
    if (this._win) {
      this._win.hide();
    }
  }

  public sendWhenReady(channel: string, ...args: any[]): void {
    if (this.isReady) {
      this.send(channel, ...args);
    }
  }

  public send(channel: string, ...args: any[]): void {
    if (this._win) {
      this._win.webContents.send(channel, ...args);
    }
  }

  public dispose(): void {
    if (this.showTimeoutHandle) {
      clearTimeout(this.showTimeoutHandle);
    }

    this._win = null!;
  }

  private registerListeners(): void {
    this._win.webContents.on('did-finish-load', () => {
      /**
       * TODO: Make it more safe and prevent register new keyboard shortcuts instead of clear it every time.
       *
       * If we reload window, it will come us to register multiple command that execute multiple times.
       * So we reload all shortcuts after window did finish load. (Before we loading renderer process actually)
       */
      KeyboardRegistry.unregisterAll(this._win);

      /**
       * Notify our renderer and send env variables
       */

      this.send('gomarky:acceptEnv', {
        windowId: this.id,
        openedWorkspace: this.openedWorkspace,
      } as IWindowConfiguration);

      if (this.pendingLoadConfig) {
        this.currentConfig = this.pendingLoadConfig;

        this.pendingLoadConfig = undefined;
      }

      if (this._win && !this._win.isVisible()) {
        if (this.windowState.mode === WindowMode.Maximized) {
          this._win.maximize();
        }

        if (!this._win.isVisible()) {
          this._win.show();
        }
      }
    });

    this._win.on('closed', () => {
      this._onClose.fire();

      this.dispose();
    });

    this._win.once('ready-to-show', () => {
      this._win.show();
    });

    if (isMacintosh) {
      const simpleFullScreenScheduler = this._register(
        new RunOnceScheduler(() => {
          if (!this._win) {
            return; // disposed
          }

          if (!this.useNativeFullScreen() && this.isFullScreen) {
            this.setFullScreen(false);
            this.setFullScreen(true);
          }
        }, 100)
      );

      const displayChangedListener = () => simpleFullScreenScheduler.schedule();

      screen.on('display-metrics-changed', displayChangedListener);

      this._register(
        toDisposable(() => screen.removeListener('display-metrics-changed', displayChangedListener))
      );

      screen.on('display-added', displayChangedListener);

      this._register(
        toDisposable(() => screen.removeListener('display-added', displayChangedListener))
      );

      screen.on('display-removed', displayChangedListener);

      this._register(
        toDisposable(() => screen.removeListener('display-removed', displayChangedListener))
      );
    }

    this._win.on('focus', () => {
      this._lastFocusTime = Date.now();
    });

    this._win.on('maximize', (event: Electron.Event) => {
      if (this.currentConfig) {
        this.currentConfig.maximized = true;
      }

      app.emit('browser-window-maximize', event, this._win);
    });

    this._win.on('unmaximize', (event: Electron.Event) => {
      if (this.currentConfig) {
        this.currentConfig.maximized = false;
      }

      app.emit('browser-window-unmaximize', event, this._win);
    });

    this._win.on('enter-full-screen', () => {
      this.sendWhenReady('gomarky:enterFullScreen');
    });

    this._win.on('leave-full-screen', () => {
      this.sendWhenReady('gomarky:leaveFullScreen');
    });

    this._win.webContents.on(
      'did-fail-load',
      (_: Electron.Event, _errorCode: number, errorDescription: string, validatedURL: string) => {
        this.logService.warn(
          `[electron event]: fail to load, ${errorDescription} ValidateURL: ${validatedURL} `,
          (errorDescription as unknown) as boolean
        );
      }
    );
  }

  private getUrl(windowConfiguration: IWindowConfiguration): string {
    windowConfiguration.windowId = this._win.id;
    windowConfiguration.logLevel = this.logService.getLevel();

    windowConfiguration.fullscreen = this.isFullScreen;
    windowConfiguration.accessibilitySupport = app.accessibilitySupportEnabled;
    windowConfiguration.maximized = this._win.isMaximized();

    return this.doGetUrl(windowConfiguration);
  }

  private doGetUrl(config: IWindowConfiguration): string {
    const base = isDev ? 'http://localhost:9080' : `file://${__dirname}`;

    // force opened window with specified url
    if (config.forcedUrl) {
      return `${base}/${config.forcedUrl}?config=${encodeURIComponent(JSON.stringify(config))}`;
    }

    if (!config.openedWorkspace) {
      return `${base}/main.html?config=${encodeURIComponent(JSON.stringify(config))}`;
    }

    Reflect.deleteProperty(config, 'forcedUrl');

    return `${base}/main.html?config=${encodeURIComponent(JSON.stringify(config))}`;
  }

  private setFullScreen(fullscreen: boolean): void {
    this.setSimpleFullScreen(fullscreen);

    this.sendWhenReady(fullscreen ? 'gomarky:enterFullScreen' : 'gomarky:leaveFullScreen');
  }

  private restoreWindowState(state?: IWindowState): [IWindowState, boolean?] {
    let hasMultipleDisplays = false;

    if (state) {
      try {
        const displays = screen.getAllDisplays();

        hasMultipleDisplays = displays.length > 1;

        state = this.validateWindowState(state, displays);
      } catch (err) {
        //
      }
    }

    return [state || defaultWindowState(), hasMultipleDisplays];
  }

  private validateWindowState(
    state: IWindowState,
    _displays: Electron.Display[]
  ): IWindowState | undefined {
    if (
      typeof state.x !== 'number' ||
      typeof state.y !== 'number' ||
      typeof state.width !== 'number' ||
      typeof state.height !== 'number'
    ) {
      return undefined;
    }

    if (state.width <= 0 || state.height <= 0) {
      return undefined;
    }

    return state;
  }

  private useNativeFullScreen(): boolean {
    const windowConfig = {
      nativeFullScreen: true,
      nativeTabs: true,
    };

    if (!windowConfig || typeof windowConfig.nativeFullScreen !== 'boolean') {
      return true; // default
    }

    if (windowConfig.nativeTabs) {
      return true; // https://github.com/electron/electron/issues/16142
    }

    return windowConfig.nativeFullScreen;
  }

  private setNativeFullScreen(fullscreen: boolean): void {
    if (this._win.isSimpleFullScreen()) {
      this._win.setSimpleFullScreen(false);
    }

    this._win.setFullScreen(fullscreen);
  }

  private setSimpleFullScreen(fullscreen: boolean): void {
    if (this._win.isFullScreen()) {
      this._win.setFullScreen(false);
    }

    this._win.setSimpleFullScreen(fullscreen);
    this._win.webContents.focus(); // workaround issue where focus is not going into window
  }
}

export type MenuBarVisibility = 'default' | 'visible' | 'toggle' | 'hidden';
