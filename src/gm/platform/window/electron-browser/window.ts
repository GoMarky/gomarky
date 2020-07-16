import {
  IDevToolsOptions,
  IMessageBoxResult,
  IWindowService,
  IWindowsService,
  MessageBoxOptions,
} from '@/gm/platform/windows/common/windows';
import { Disposable } from '@/gm/base/common/lifecycle';
import { Event as CommonEvent } from '@/gm/base/common/event';

import { IEnvironmentService } from '@/gm/platform/env/common/environment';
import { IContextKey, IContextKeyService } from '@/gm/platform/contextkey/common/contextkey';
import { WindowHasFocusContext } from '@/gm/code/electron-browser/window/window';

const DEFAULT_WINDOW_RESIZE_DEBOUNCE = 500;

export class CodeWindowRenderer extends Disposable implements IWindowService {
  private readonly _windowId: number;

  private _windowsHasFocusContext: IContextKey<boolean>;
  public get windowId(): number {
    return this._windowId;
  }

  public readonly serviceBrand: IWindowService;

  public readonly onDidChangeFocus: CommonEvent<boolean> = CommonEvent.any(
    CommonEvent.fromDOMEventEmitter<boolean>(window, 'focus', () => document.hasFocus()),
    CommonEvent.fromDOMEventEmitter<boolean>(window, 'blur', () => document.hasFocus())
  );

  public readonly onDidChangeMaximize: CommonEvent<boolean>;

  public onResize: CommonEvent<Event> = CommonEvent.debounce(
    CommonEvent.fromDOMEventEmitter<Event>(window, 'resize'),
    (_, event: Event) => event,
    DEFAULT_WINDOW_RESIZE_DEBOUNCE,
    true
  );

  constructor(
    @IEnvironmentService environmentService: IEnvironmentService,
    @IWindowsService private readonly windowsService: IWindowsService,
    @IContextKeyService private readonly contextKeyService: IContextKeyService
  ) {
    super();

    this._windowId = environmentService.configuration.windowId;

    this._windowsHasFocusContext = WindowHasFocusContext.bindTo(contextKeyService);

    this.registerListeners();
  }

  public openDevTools(options?: IDevToolsOptions): Promise<void> {
    return this.windowsService.openDevTools(this.windowId, options);
  }

  public toggleDevTools(): Promise<void> {
    return this.windowsService.toggleDevTools(this.windowId);
  }

  public showMessageBox(options: MessageBoxOptions): Promise<IMessageBoxResult> {
    return this.windowsService.showMessageBox(this.windowId, options);
  }

  public toggleFullScreen(): Promise<void> {
    return this.windowsService.toggleFullScreen(this.windowId);
  }

  public maximize(): Promise<void> {
    return this.windowsService.maximize(this.windowId);
  }

  private registerListeners(): void {
    this.onDidChangeFocus((value: boolean) => this._windowsHasFocusContext.set(value));
  }
}
