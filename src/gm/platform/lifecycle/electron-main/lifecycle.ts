import { Emitter, Event } from '@/gm/base/common/event';
import { ILogService } from '@/gm/platform/log/common/log';
import { app, ipcMain as ipc } from 'electron';

import { ICodeWindow } from '@/gm/platform/window/electron-main/window';
import { isMacintosh } from '@/gm/base/platform';
import { UnloadReason } from '@/gm/platform/lifecycle/common/lifecycle';

import { Disposable } from '@/gm/base/common/lifecycle';
import { createDecorator } from '@/gm/platform/instantiation/common/instantiation';
import { Barrier } from '@/gm/base/common/async';

export const enum LifecycleMainPhase {
  Starting = 1,
  Ready = 2,
  AfterWindowOpen = 3,
}

export interface IWindowUnloadEvent {
  window: ICodeWindow;
  reason: UnloadReason;

  veto(value: boolean | Promise<boolean>): void;
}

export interface ShutdownEvent {
  join(promise: Promise<void>): void;
}

export class LifecycleErrorMain extends Error {
  public readonly name = 'LifecycleErrorMain';
}

export interface ILifecycleService {
  readonly wasRestarted: boolean;
  readonly quitRequested: boolean;

  phase: LifecycleMainPhase;

  readonly onBeforeShutdown: Event<void>;
  readonly onWillOpenWelcomeWindow: Event<void>;

  readonly onWillShutdown: Event<ShutdownEvent>;
  readonly onBeforeWindowClose: Event<ICodeWindow>;
  readonly onBeforeWindowUnload: Event<IWindowUnloadEvent>;

  unload(window: ICodeWindow, reason: UnloadReason): Promise<boolean>;
  relaunch(options?: { addArgs?: string[]; removeArgs?: string[] }): void;

  quit(fromUpdate?: boolean): Promise<boolean>;
  kill(code?: number): void;

  when(phase: LifecycleMainPhase): Promise<void>;
  registerWindow(window: ICodeWindow): void;
}

export const ILifecycleService = createDecorator<ILifecycleService>('lifecycleMainService');

export class LifecycleService extends Disposable implements ILifecycleService {
  private readonly windowToCloseRequest: Set<number> = new Set();

  private readonly _onBeforeShutdown = this._register(new Emitter<void>());
  readonly onBeforeShutdown: Event<void> = this._onBeforeShutdown.event;

  private readonly _onWillOpenWelcomeWindow = this._register(new Emitter<void>());
  readonly onWillOpenWelcomeWindow: Event<void> = this._onWillOpenWelcomeWindow.event;

  private readonly _onWillShutdown = this._register(new Emitter<ShutdownEvent>());
  readonly onWillShutdown: Event<ShutdownEvent> = this._onWillShutdown.event;

  private readonly _onBeforeWindowClose = this._register(new Emitter<ICodeWindow>());
  readonly onBeforeWindowClose: Event<ICodeWindow> = this._onBeforeWindowClose.event;

  private readonly _onBeforeWindowUnload = this._register(new Emitter<IWindowUnloadEvent>());
  readonly onBeforeWindowUnload: Event<IWindowUnloadEvent> = this._onBeforeWindowUnload.event;

  private pendingWillShutdownPromise: Promise<void> | null = null;

  private _quitRequested = false;
  private _wasRestarted = false;

  private _phase: LifecycleMainPhase = LifecycleMainPhase.Starting;
  private phaseWhen = new Map<LifecycleMainPhase, Barrier>();
  private oneTimeListenerTokenGenerator = 0;
  private windowCounter = 0;

  constructor(@ILogService private readonly logService: ILogService) {
    super();

    this.when(LifecycleMainPhase.Ready).then(() => this.registerListeners());
  }

  public get phase() {
    return this._phase;
  }
  public set phase(value: LifecycleMainPhase) {
    if (value < this.phase) {
      throw new LifecycleErrorMain('Lifecycle cannot go backwards');
    }

    if (this._phase === value) {
      return;
    }

    this.logService.trace(`lifecycle (main): phase changed (value: ${value})`);

    this._phase = value;

    const barrier = this.phaseWhen.get(this._phase);
    if (barrier) {
      barrier.open();
      this.phaseWhen.delete(this._phase);
    }
  }

  public async unload(window: ICodeWindow, reason: UnloadReason): Promise<boolean> {
    if (!window.isReady) {
      return Promise.resolve(false);
    }

    this.logService.trace(`Lifecycle#unload() - window ID ${window.id}`);

    const windowUnloadReason = this._quitRequested ? UnloadReason.QUIT : reason;
    await this.onBeforeUnloadWindowInRenderer(window, windowUnloadReason);
    this.logService.trace(`Lifecycle#unload() - no veto (window ID ${window.id})`);
    await this.onWillUnloadWindowInRenderer(window, windowUnloadReason);

    return false;
  }

  private onBeforeUnloadWindowInRenderer(
    window: ICodeWindow,
    reason: UnloadReason
  ): Promise<boolean> {
    return new Promise<boolean>(resolve => {
      const oneTimeEventToken = this.oneTimeListenerTokenGenerator++;
      const okChannel = `gomarky:ok${oneTimeEventToken}`;
      const cancelChannel = `gomarky:cancel${oneTimeEventToken}`;

      ipc.once(okChannel, () => {
        resolve(false);
      });

      ipc.once(cancelChannel, () => {
        resolve(true);
      });

      window.send('gomarky:onBeforeUnload', { okChannel, cancelChannel, reason });
    });
  }

  private onWillUnloadWindowInRenderer(window: ICodeWindow, reason: UnloadReason): Promise<void> {
    return new Promise<void>(resolve => {
      const oneTimeEventToken = this.oneTimeListenerTokenGenerator++;
      const replyChannel = `gomarky:reply${oneTimeEventToken}`;

      ipc.once(replyChannel, () => resolve());

      window.send('gomarky:onWillUnload', { replyChannel, reason });
    });
  }

  public get wasRestarted(): boolean {
    return this._wasRestarted;
  }

  public get quitRequested(): boolean {
    return this._quitRequested;
  }

  public async when(phase: LifecycleMainPhase): Promise<void> {
    if (phase <= this._phase) {
      return;
    }

    let barrier = this.phaseWhen.get(phase);

    if (!barrier) {
      barrier = new Barrier();
      this.phaseWhen.set(phase, barrier);
    }

    await barrier.wait();
  }

  public quit(): Promise<boolean> {
    return new Promise(() => {
      this.logService.trace('Lifecycle#quit() - calling app.quit()');

      app.quit();
    });
  }

  public relaunch(options: { addArgs?: string[]; removeArgs?: string[] }): void {
    app.relaunch({ args: options.addArgs || [] });
  }

  public registerWindow(window: ICodeWindow): void {
    this.windowCounter++;

    window.win.on('close', event => {
      this.logService.trace(`Lifecycle#window.on('close') - window ID ${window.id}`);

      const windowId = window.id;
      if (this.windowToCloseRequest.has(windowId)) {
        this.windowToCloseRequest.delete(windowId);

        return;
      }

      event.preventDefault();
      this.unload(window, UnloadReason.CLOSE).then(veto => {
        if (veto) {
          this.windowToCloseRequest.delete(windowId);
          return;
        }

        this.windowToCloseRequest.add(windowId);

        this.logService.trace(`Lifecycle#onBeforeWindowClose.fire() - window ID ${window.id}`);
        this._onBeforeWindowClose.fire(window);
        window.close();
      });
    });

    window.win.on('closed', () => {
      this.logService.trace(`Lifecycle#window.on('closed') - window ID ${window.id}`);

      this.windowCounter--;

      // we should open welcome window only after when last window with workspace (scene or settings is closed)
      if (this.windowCounter === 0 && window.config.openedWorkspace) {
        this.logService.trace(`Lifecycle#onWillOpenWelcomeWindow.fire`);
        this._onWillOpenWelcomeWindow.fire();
      }

      if (this.windowCounter === 0 && (!isMacintosh || this._quitRequested)) {
        this.beginOnWillShutdown();
      }
    });
  }

  public kill(code?: number): void {
    this.logService.trace(`LifecycleMainService#Kill`);

    app.exit(code);
  }

  private async beginOnWillShutdown(): Promise<void> {
    if (this.pendingWillShutdownPromise) {
      return this.pendingWillShutdownPromise; // shutdown is already running
    }

    this.logService.trace('Lifecycle#onWillShutdown.fire()');

    const joiners: Promise<void>[] = [];

    this._onWillShutdown.fire({
      join(promise: Promise<void>) {
        if (promise) {
          joiners.push(promise);
        }
      },
    });

    this.pendingWillShutdownPromise = Promise.all(joiners).then(
      () => undefined,
      err => this.logService.error(err)
    );

    return this.pendingWillShutdownPromise;
  }

  private registerListeners(): void {
    app.on('before-quit', () => {
      if (this._quitRequested) {
        return;
      }

      this.logService.trace('Lifecycle#app.on(before-quit)');
      this._quitRequested = true;

      this.logService.trace('Lifecycle#onBeforeShutdown.fire()');
      this._onBeforeShutdown.fire();

      if (isMacintosh && this.windowCounter === 0) {
        this.beginOnWillShutdown();
      }
    });

    app.on('window-all-closed', () => {
      this.logService.trace('Lifecycle#app.on(window-all-closed)');

      // Windows/Linux: we quit when all windows have closed
      // Mac: we only quit when quit was requested
      if (this._quitRequested || !isMacintosh) {
        app.quit();
      }
    });

    app.once('will-quit', event => {
      this.logService.trace('Lifecycle#app.on(will-quit)');

      // Prevent the quit until the shutdown promise was resolved
      event.preventDefault();

      // Start shutdown sequence
      const shutdownPromise = this.beginOnWillShutdown();

      // Wait until shutdown is signaled to be complete
      shutdownPromise.finally(() => {
        // Quit again, this time do not prevent this, since our
        // will-quit listener is only installed "once". Also
        // remove any listener we have that is no longer needed
        app.quit();
      });
    });
  }
}
