import { Disposable } from '@/gm/base/common/lifecycle';
import * as os from 'os';
import { app, clipboard } from 'electron';

import product from '@/gm/platform/product/node';
import { CreateContext, IWindowsMainService } from '@/gm/platform/windows/electron-main/windows';
import { ILogService } from '@/gm/platform/log/common/log';

import { ILifecycleService } from '@/gm/platform/lifecycle/electron-main/lifecycle';
import { isDev, isLinux, isMacintosh } from '@/gm/base/platform';
import { ICodeWindow, IWindowCreationOptions } from '@/gm/platform/window/electron-main/window';

import {
  IDevToolsOptions,
  IInternalNativeOpenDialogOptions,
  IMessageBoxResult,
  IWindowsService,
} from '@/gm/platform/windows/common/windows';
import { Event } from '@/gm/base/common/event';

import { URI } from '@/gm/base/common/uri';
import { IHistoryMainService } from '@/gm/platform/history/common/history';
import { IWorkspaceId } from '@/gm/platform/workspace/common/workspace';
import { IEnvironmentService } from '@/gm/platform/env/node/environmentService';

export interface IWindowsCountChangedEvent {
  readonly oldCount: number;
  readonly newCount: number;
}

export class WindowsService extends Disposable implements IWindowsService {
  public readonly onWindowFocus: Event<number> = Event.any(
    Event.map(
      Event.filter(
        Event.map(this.windowsMainService.onWindowsCountChanged, () =>
          this.windowsMainService.getLastActiveWindow()
        ),
        w => !!w
      ),
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      w => w!.id
    ),
    Event.filter(
      Event.fromNodeEventEmitter(
        app,
        'browser-window-focus',
        (_, w: Electron.BrowserWindow) => w.id
      ),
      id => !!this.windowsMainService.getWindowById(id)
    )
  );

  public readonly onWindowOpen: Event<number> = Event.any(
    Event.map(
      Event.filter(
        Event.map(this.windowsMainService.onWindowsCountChanged, () =>
          this.windowsMainService.getLastActiveWindow()
        ),
        w => !!w
      ),
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      w => w!.id
    ),
    Event.filter(
      Event.fromNodeEventEmitter(
        app,
        'browser-window-created',
        (_, w: Electron.BrowserWindow) => w.id
      ),
      id => !!this.windowsMainService.getWindowById(id)
    )
  );

  public readonly onRecentlyOpenedChange: Event<void> = this.historyService.onRecentlyOpenedChange;

  constructor(
    @IWindowsMainService private readonly windowsMainService: IWindowsMainService,
    @IHistoryMainService private readonly historyService: IHistoryMainService,
    @ILifecycleService private readonly lifecycleService: ILifecycleService,
    @ILogService private readonly logService: ILogService,
    @IEnvironmentService private readonly environmentService: IEnvironmentService
  ) {
    super();
  }

  public pick(options: IInternalNativeOpenDialogOptions): Promise<string[] | undefined> {
    return this.windowsMainService.pick(options);
  }

  public async openNewWindow(options: IWindowCreationOptions): Promise<ICodeWindow> {
    return this.windowsMainService.openNewWindow(CreateContext.API, options);
  }

  public async toggleFullScreen(windowId: number): Promise<void> {
    return this.withWindow(windowId, window => window.toggleFullScreen());
  }

  public async maximize(windowId: number): Promise<void> {
    return this.withWindow(windowId, window => window.win.maximize());
  }

  public getFocusedWindow(): ICodeWindow | undefined {
    return this.windowsMainService.getFocusedWindow();
  }

  public getLastActiveWindow(): ICodeWindow | undefined {
    return this.windowsMainService.getLastActiveWindow();
  }

  public async getWindowCount(): Promise<number> {
    return this.windowsMainService.getWindows().length;
  }

  public async quit(): Promise<void> {
    this.logService.trace('windowsService#quit');

    this.windowsMainService.quit();
  }

  public async showMessageBox(
    windowId: number,
    options: Electron.MessageBoxOptions
  ): Promise<IMessageBoxResult> {
    this.logService.trace('windowsService#showMessageBox', windowId);

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return this.withWindow(
      windowId,
      codeWindow => this.windowsMainService.showMessageBox(options, codeWindow),
      () => this.windowsMainService.showMessageBox(options)
    )!;
  }

  public async showSaveDialog(
    windowId: number,
    options: Electron.SaveDialogOptions
  ): Promise<Electron.SaveDialogReturnValue> {
    this.logService.trace('windowsService#showSaveDialog', windowId);

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return this.withWindow(
      windowId,
      codeWindow => this.windowsMainService.showSaveDialog(options, codeWindow),
      () => this.windowsMainService.showSaveDialog(options)
    )!;
  }

  public async showOpenDialog(
    windowId: number,
    options: Electron.OpenDialogOptions
  ): Promise<Electron.OpenDialogReturnValue> {
    this.logService.trace('windowsService#showOpenDialog', windowId);

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return this.withWindow(
      windowId,
      codeWindow => this.windowsMainService.showOpenDialog(options, codeWindow),
      () => this.windowsMainService.showOpenDialog(options)
    )!;
  }

  public async openDevTools(windowId: number, options?: IDevToolsOptions): Promise<void> {
    this.logService.trace('windowsService#openDevTools', windowId);

    return this.withWindow(windowId, codeWindow =>
      codeWindow.win.webContents.openDevTools(options)
    );
  }

  public async toggleDevTools(windowId: number): Promise<void> {
    this.logService.trace('windowsService#toggleDevTools', windowId);

    return this.withWindow(windowId, codeWindow => {
      const contents = codeWindow.win.webContents;
      if (
        isMacintosh &&
        codeWindow.hasHiddenTitleBarStyle() &&
        !codeWindow.isFullScreen &&
        !contents.isDevToolsOpened()
      ) {
        contents.openDevTools({ mode: 'right' });
      } else {
        contents.toggleDevTools();
      }
    });
  }

  public async enterWorkspace(path: string): Promise<void> {
    await this.windowsMainService.enterWorkspace(URI.file(path));

    return;
  }

  public async createWindowAndEnterWorkspace(identifier: IWorkspaceId): Promise<void> {
    await this.windowsMainService.createWindowAndEnterWorkspace(identifier);

    return;
  }

  public async createAndEnterWorkspace(path: URI): Promise<void> {
    await this.windowsMainService.createAndEnterWorkspace(path);

    return;
  }

  public async openAboutDialog(): Promise<void> {
    this.logService.trace('windowsService#openAboutDialog');

    let version = app.getVersion();

    if (isDev) {
      version = process.env.APP_VERSION as string;
    }

    if (product.target) {
      version = `${version} (${product.target} setup)`;
    }

    const detail = `
    Version: ${version},
    Commit: ${process.env.GIT_VERSION},
    Date: ${product.date},
    Electron: ${process.versions.electron},
    Chrome: ${process.versions.chrome},
    Node.js: ${process.versions.node},
    V8: ${process.versions.v8},
    OS: ${os.type()} ${os.arch()} ${os.release()},
    session_id: ${this.environmentService.sessionId}`;

    const ok = 'OK';
    const copy = 'Copy';
    let buttons: string[];

    if (isLinux) {
      buttons = [copy, ok];
    } else {
      buttons = [ok, copy];
    }

    const result = await this.windowsMainService.showMessageBox(
      {
        title: product.nameLong,
        type: 'info',
        message: product.nameLong,
        detail: `\n${detail}`,
        buttons,
        noLink: true,
        defaultId: buttons.indexOf(ok),
        cancelId: buttons.indexOf(ok),
      },
      this.windowsMainService.getFocusedWindow() || this.windowsMainService.getLastActiveWindow()
    );

    if (result.response === 1) {
      clipboard.writeText(detail);
    }
  }

  private withWindow<T>(
    windowId: number,
    fn: (window: ICodeWindow) => T,
    fallback?: () => T
  ): T | undefined {
    const codeWindow = this.windowsMainService.getWindowById(windowId);
    if (codeWindow) {
      return fn(codeWindow);
    }

    if (fallback) {
      return fallback();
    }

    return undefined;
  }
}
