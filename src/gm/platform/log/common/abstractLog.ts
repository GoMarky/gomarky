import { Disposable } from '@/gm/base/common/lifecycle';
import { Emitter, Event } from '@/gm/base/common/event';

export enum LogLevel {
  Trace,
  Debug,
  Info,
  Warning,
  Error,
  Critical,
  Off,
}

export abstract class AbstractLogService extends Disposable {
  private level: LogLevel = LogLevel.Info;

  private readonly _onDidChangeLogLevel: Emitter<LogLevel> = this._register(
    new Emitter<LogLevel>()
  );
  readonly onDidChangeLogLevel: Event<LogLevel> = this._onDidChangeLogLevel.event;

  public setLevel(level: LogLevel): void {
    if (this.level !== level) {
      this.level = level;

      this._onDidChangeLogLevel.fire(this.level);
    }
  }

  public getLevel(): LogLevel {
    return this.level;
  }
}
