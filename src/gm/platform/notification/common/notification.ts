import { createDecorator } from '@/gm/platform/instantiation/common/instantiation';

export type NotificationMessage = string | Error;

export interface INotificationActions {
  primary?: ReadonlyArray<any>;
  secondary?: ReadonlyArray<any>;
}

export interface INotificationService {
  // Simple text warnings
  info(message: NotificationMessage): void;
  warn(message: NotificationMessage): void;
  error(message: NotificationMessage): void;
  success(message: NotificationMessage): void;

  // status messages
  status(message: NotificationMessage, options?: IStatusMessageOptions): void;

  // notify message with actions
  notify(notification: INotification): void;
}

export interface IStatusMessageOptions {
  showAfter?: number;
  hideAfter?: number;
}

export enum Severity {
  Ignore = 0,
  Info = 1,
  Warning = 2,
  Error = 3,
  Success,
}

export function severityToString(severity: Severity): string {
  switch (severity) {
    case Severity.Error:
      return 'Error';
    case Severity.Ignore:
      return 'Ignore';
    case Severity.Warning:
      return 'Warning';
    case Severity.Info:
      return 'Info';
    case Severity.Success:
      return 'Success';
  }
}

export function getSeverityCssClass(severity: Severity): string {
  switch (severity) {
    case Severity.Success:
      return 'notification_success';
    case Severity.Info:
      return 'notification_info';
    case Severity.Warning:
      return 'notification_warning';
    case Severity.Error:
      return 'notification_error';
    default:
      return 'notification_info';
  }
}

export interface INotification {
  level: Severity;
  message: NotificationMessage;
  actions?: INotificationActions;
}

export interface INotificationStatus extends INotification {
  statusOptions?: IStatusMessageOptions;
}

export const INotificationService = createDecorator<INotificationService>('notificationService');
