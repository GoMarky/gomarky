import { isWindows } from '@/gm/base/platform';
import { ILogService, now } from '@/gm/platform/log/common/log';
import { AbstractLogService, LogLevel } from '@/gm/platform/log/common/abstractLog';

export class ConsoleLogMainService extends AbstractLogService implements ILogService {
  private readonly useColors: boolean;

  constructor(logLevel: LogLevel) {
    super();
    this.setLevel(logLevel);
    this.useColors = !isWindows;
  }

  public trace(message: string, ...args: any[]): void {
    if (this.getLevel() <= LogLevel.Trace) {
      if (this.useColors) {
        console.log(`\x1b[90m[main ${now()}]\x1b[0m`, message, ...args);
      } else {
        console.log(`[main ${now()}]`, message, ...args);
      }
    }
  }

  public debug(message: string, ...args: any[]): void {
    if (this.getLevel() <= LogLevel.Debug) {
      if (this.useColors) {
        console.log(`\x1b[90m[main ${now()}]\x1b[0m`, message, ...args);
      } else {
        console.log(`[main ${now()}]`, message, ...args);
      }
    }
  }

  public info(message: string, ...args: any[]): void {
    if (this.getLevel() <= LogLevel.Info) {
      if (this.useColors) {
        console.log(`\x1b[90m[main ${now()}]\x1b[0m`, message, ...args);
      } else {
        console.log(`[main ${now()}]`, message, ...args);
      }
    }
  }

  public warn(message: string, ...args: any[]): void {
    if (this.getLevel() <= LogLevel.Warning) {
      if (this.useColors) {
        console.warn(`\x1b[93m[main ${now()}]\x1b[0m`, message, ...args);
      } else {
        console.warn(`[main ${now()}]`, message, ...args);
      }
    }
  }

  public error(message: string, ...args: any[]): void {
    if (this.getLevel() <= LogLevel.Error) {
      if (this.useColors) {
        console.error(`\x1b[91m[main ${now()}]\x1b[0m`, message, ...args);
      } else {
        console.error(`[main ${now()}]`, message, ...args);
      }
    }
  }

  public critical(message: string, ...args: any[]): void {
    if (this.getLevel() <= LogLevel.Critical) {
      if (this.useColors) {
        console.error(`\x1b[90m[main ${now()}]\x1b[0m`, message, ...args);
      } else {
        console.error(`[main ${now()}]`, message, ...args);
      }
    }
  }

  public dispose(): void {
    // do nothing here
  }
}
