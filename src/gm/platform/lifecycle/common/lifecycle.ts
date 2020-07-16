import { createDecorator } from '@/gm/platform/instantiation/common/instantiation';
import { Emitter, Event } from '@/gm/base/common/event';
import { Disposable } from '@/gm/base/common/lifecycle';

import { Barrier } from '@/gm/base/common/async';
import { ILogService } from '@/gm/platform/log/common/log';

export const ILifecycleService = createDecorator<ILifecycleService>('lifeCycleService');

export interface BeforeShutdownEvent {
  veto(value: boolean | Promise<boolean>): void;

  readonly reason: UnloadReason;
}

export interface WillShutdownEvent {
  join(promise: Promise<void>): void;

  readonly reason: UnloadReason;
}

export const enum StartupKind {
  NewWindow = 1,
  ReloadedWindow = 3,
  ReopenedWindow = 4,
}

export const enum UnloadReason {
  CLOSE = 1,
  QUIT = 2,
  RELOAD = 3,
  LOAD = 4,
}

export const enum LifePhase {
  Starting = 1,
  Ready = 2,
  Eventually = 3,
}

export interface ILifecycleService {
  readonly startupKind: StartupKind;
  phase: LifePhase;

  readonly onBeforeShutdown: Event<BeforeShutdownEvent>;
  readonly onWillShutdown: Event<WillShutdownEvent>;

  readonly onShutdown: Event<void>;

  when(phase: LifePhase): Promise<void>;
}

export abstract class AbstractLifecycleService extends Disposable implements ILifecycleService {
  private phaseWhen = new Map<LifePhase, Barrier>();

  protected _startupKind: StartupKind;

  public get startupKind(): StartupKind {
    return this._startupKind;
  }

  protected readonly _onBeforeShutdown = this._register(new Emitter<BeforeShutdownEvent>());
  readonly onBeforeShutdown: Event<BeforeShutdownEvent> = this._onBeforeShutdown.event;

  protected readonly _onWillShutdown = this._register(new Emitter<WillShutdownEvent>());
  readonly onWillShutdown: Event<WillShutdownEvent> = this._onWillShutdown.event;

  protected readonly _onShutdown = this._register(new Emitter<void>());
  readonly onShutdown: Event<void> = this._onShutdown.event;

  private _phase: LifePhase = LifePhase.Starting;

  protected constructor(@ILogService protected readonly logService: ILogService) {
    super();
  }

  public get phase(): LifePhase {
    return this._phase;
  }
  public set phase(value: LifePhase) {
    if (value < this.phase) {
      throw new Error('Lifecycle cannot go backwards');
    }

    if (this._phase === value) {
      return;
    }

    this.logService.trace(`lifecycle: phase changed (value: ${value})`);

    this._phase = value;

    const barrier = this.phaseWhen.get(this._phase);
    if (barrier) {
      barrier.open();
      this.phaseWhen.delete(this._phase);
    }
  }

  public async when(phase: LifePhase): Promise<void> {
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
}
