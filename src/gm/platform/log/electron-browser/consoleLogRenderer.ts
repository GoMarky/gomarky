import { AbstractLogService, LogLevel } from '@/gm/platform/log/common/abstractLog';
import { ILogService } from '@/gm/platform/log/common/log';

export class ConsoleLogService extends AbstractLogService implements ILogService {
  public readonly serviceBrand = ILogService;

  constructor(logLevel: LogLevel) {
    super();
    this.setLevel(logLevel);
  }

  public trace(message: string, ...args: any[]): void {
    if (this.getLevel() <= LogLevel.Trace) {
      console.log(
        '%c[TRACE]:',
        'color: #888; background-color: transparent; font-weight: bold;',
        message,
        ...args
      );
    }
  }

  public debug(message: string, ...args: any[]): void {
    if (this.getLevel() <= LogLevel.Debug) {
      console.log(
        '%c[DEBUG]:',
        'color: #00BFFE; background-color: transparent; font-weight: bold;',
        message,
        ...args
      );
    }
  }

  public info(message: string, ...args: any[]): void {
    if (this.getLevel() <= LogLevel.Info) {
      console.log(
        '%c[INFO]:',
        'color: #00BFFE; background-color: transparent; font-weight: bold;',
        message,
        ...args
      );
    }
  }

  public warn(message: string, ...args: any[]): void {
    if (this.getLevel() <= LogLevel.Warning) {
      console.log(
        '%c[WARN]:',
        'color: #993; background-color: transparent; font-weight: bold;',
        message,
        ...args
      );
    }
  }

  public error(message: string, ...args: any[]): void {
    if (this.getLevel() <= LogLevel.Error) {
      console.log(
        '%cERR]:',
        'color: #f33; background-color: transparent; font-weight: bold;',
        message,
        ...args
      );
    }
  }

  public critical(message: string, ...args: any[]): void {
    if (this.getLevel() <= LogLevel.Critical) {
      console.log(
        '%c[CRITICAL]:',
        'background-color: transparent; font-weight: bold;',
        message,
        ...args
      );
    }
  }
}
