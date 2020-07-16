import { IMainProcessService } from '@/gm/platform/ipc/electron-browser/mainProcessService';
import {
  IDevToolsOptions,
  IInternalNativeOpenDialogOptions,
  IMessageBoxResult,
  IWindowsService,
  MessageBoxOptions,
  OpenDialogOptions,
  SaveDialogOptions,
} from '@/gm/platform/windows/common/windows';

import { IChannel } from '@/gm/base/parts/ipc/common/ipc';
import { Emitter, Event } from '@/gm/base/common/event';
import { URI } from '@/gm/base/common/uri';

import { IWorkspaceId } from '@/gm/platform/workspace/common/workspace';
import { Disposable } from '@/gm/base/common/lifecycle';

export class WindowsService extends Disposable implements IWindowsService {
  private channel: IChannel;

  public readonly serviceBrand = IWindowsService;

  private _onWindowFocus = new Emitter<number>();
  private _onWindowOpen = new Emitter<number>();
  private _onRecentlyOpenedChange = new Emitter<void>();

  constructor(@IMainProcessService mainProcessService: IMainProcessService) {
    super();

    this.channel = mainProcessService.getChannel('windows');

    this.channel.listen('onWindowFocus', this._onWindowFocus);
    this.channel.listen('onRecentlyOpenedChange', this._onRecentlyOpenedChange);
  }

  public pick(options: IInternalNativeOpenDialogOptions): Promise<string[] | undefined> {
    return this.channel.call('pick', [options]);
  }

  public get onWindowOpen(): Event<number> {
    return this._onWindowOpen.event;
  }

  public get onWindowFocus(): Event<number> {
    return this._onWindowFocus.event;
  }

  public get onRecentlyOpenedChange(): Event<void> {
    return this._onRecentlyOpenedChange.event;
  }

  public showMessageBox(windowId: number, options: MessageBoxOptions): Promise<IMessageBoxResult> {
    return this.channel.call('showMessageBox', [windowId, options]);
  }

  public showSaveDialog(
    windowId: number,
    options: SaveDialogOptions
  ): Promise<Electron.SaveDialogReturnValue> {
    return this.channel.call('showSaveDialog', [windowId, options]);
  }

  public showOpenDialog(
    windowId: number,
    options: OpenDialogOptions
  ): Promise<Electron.OpenDialogReturnValue> {
    return this.channel.call('showOpenDialog', [windowId, options]);
  }

  public openDevTools(windowId: number, options?: IDevToolsOptions): Promise<void> {
    return this.channel.call('openDevTools', [windowId, options]);
  }

  public toggleDevTools(windowId: number): Promise<void> {
    return this.channel.call('toggleDevTools', windowId);
  }

  public async maximize(windowId: number): Promise<void> {
    return this.channel.call('maximize', windowId);
  }
  public async toggleFullScreen(windowId: number): Promise<void> {
    return this.channel.call('toggleFullScreen', windowId);
  }

  public quit(): Promise<void> {
    return this.channel.call('quit');
  }

  public openAboutDialog(): Promise<void> {
    return this.channel.call('openAboutDialog');
  }

  public enterWorkspace(path: string): Promise<void> {
    return this.channel.call('enterWorkspace', [path]);
  }

  public createWindowAndEnterWorkspace(identifier: IWorkspaceId): Promise<void> {
    return this.channel.call('createWindowAndEnterWorkspace', identifier);
  }

  public createAndEnterWorkspace(path: URI): Promise<void> {
    return this.channel.call('createAndEnterWorkspace', path);
  }
}
