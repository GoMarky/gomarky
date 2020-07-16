import { createDecorator } from '@/gm/platform/instantiation/common/instantiation';
import { Event } from '@/gm/base/common/event';
import { LogLevel } from '@/gm/platform/log/common/abstractLog';

export function now(): string {
  return new Date().toISOString();
}

export const ILogService = createDecorator<ILogService>('logService');

export interface ILogService {
  onDidChangeLogLevel: Event<LogLevel>;

  getLevel(): LogLevel;

  setLevel(level: LogLevel): void;

  trace(message: string, ...args: any[]): void;

  debug(message: string, ...args: any[]): void;

  info(message: string, ...args: any[]): void;

  warn(message: string, ...args: any[]): void;

  error(message: string, ...args: any[]): void;

  critical(message: string, ...args: any[]): void;
}
