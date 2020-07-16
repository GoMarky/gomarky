import {
  AbstractLifecycleService,
  ILifecycleService,
  StartupKind,
  UnloadReason,
} from '@/gm/platform/lifecycle/common/lifecycle';
import { ILogService } from '@/gm/platform/log/common/log';
import { IWindowService } from '@/gm/platform/windows/common/windows';

import {
  IStateService,
  IWillSaveStateEvent,
  WillSaveStateReason,
} from '@/gm/platform/state/common/state';
import { ipcRenderer as ipc } from 'electron';
import { onUnexpectedError } from '@/gm/base/common/errors';

export class LifecycleService extends AbstractLifecycleService implements ILifecycleService {
  private static readonly LAST_SHUTDOWN_REASON_KEY = 'lastShutdownReason';
  private shutdownReason: UnloadReason;

  public readonly serviceBrand = ILifecycleService;

  constructor(
    @IWindowService private readonly windowService: IWindowService,
    @IStateService private readonly stateService: IStateService,
    @ILogService readonly logService: ILogService
  ) {
    super(logService);

    this._startupKind = this.resolveStartupKind();
    this.registerListeners();
  }

  private resolveStartupKind(): StartupKind {
    const lastShutdownReason = this.stateService.getItem(LifecycleService.LAST_SHUTDOWN_REASON_KEY);
    this.stateService.removeItem(LifecycleService.LAST_SHUTDOWN_REASON_KEY);

    let startupKind: StartupKind;

    switch (lastShutdownReason) {
      case UnloadReason.RELOAD:
        startupKind = StartupKind.ReloadedWindow;
        break;
      case UnloadReason.LOAD:
        startupKind = StartupKind.ReopenedWindow;
        break;
      default:
        startupKind = StartupKind.NewWindow;
        break;
    }

    this.logService.trace(`lifecycle: starting up (startup kind: ${this._startupKind})`);

    return startupKind;
  }

  private registerListeners(): void {
    const windowId = this.windowService.windowId;

    ipc.on(
      'gomarky:onBeforeUnload',
      (
        _event: unknown,
        reply: { okChannel: string; cancelChannel: string; reason: UnloadReason }
      ) => {
        this.logService.trace(`lifecycle: onBeforeUnload (reason: ${reply.reason})`);

        this.handleBeforeShutdown(reply.reason).then(veto => {
          if (veto) {
            this.logService.trace('lifecycle: onBeforeUnload prevented via veto');

            ipc.send(reply.cancelChannel, windowId);
          } else {
            this.logService.trace('lifecycle: onBeforeUnload continues without veto');

            this.shutdownReason = reply.reason;
            ipc.send(reply.okChannel, windowId);
          }
        });
      }
    );

    ipc.on(
      'gomarky:onWillUnload',
      async (_event: unknown, reply: { replyChannel: string; reason: UnloadReason }) => {
        this.logService.trace(`lifecycle: onWillUnload (reason: ${reply.reason})`);

        await this.handleWillShutdown(reply.reason);

        this._onShutdown.fire();

        ipc.send(reply.replyChannel, windowId);
      }
    );

    this.stateService.onWillSaveState((event: IWillSaveStateEvent) => {
      if (event.reason === WillSaveStateReason.SHUTDOWN) {
        this.stateService.setItem(LifecycleService.LAST_SHUTDOWN_REASON_KEY, this.shutdownReason);
      }
    });
  }

  private async handleBeforeShutdown(reason: UnloadReason): Promise<boolean> {
    const vetos: (boolean | Promise<boolean>)[] = [];

    this._onBeforeShutdown.fire({
      veto(value) {
        vetos.push(value);
      },
      reason,
    });

    return false;
  }

  private async handleWillShutdown(reason: UnloadReason): Promise<void> {
    const joiners: Promise<void>[] = [];

    this._onWillShutdown.fire({
      join(promise) {
        if (promise) {
          joiners.push(promise);
        }
      },
      reason,
    });

    try {
      await Promise.all(joiners);
    } catch (error) {
      onUnexpectedError(error);
    }
  }
}
