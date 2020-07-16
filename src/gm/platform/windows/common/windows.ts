import { createDecorator } from '@/gm/platform/instantiation/common/instantiation';
import { Event as CommonEvent } from '@/gm/base/common/event';
import { IPCChannelError } from '@/gm/platform/ipc/common/ipc';

import { IWorkspaceIdentifier } from '@/gm/platform/workspaces/common/workspaces';
import { URI } from '@/gm/base/common/uri';
import { IWorkspaceId } from '@/gm/platform/workspace/common/workspace';
import { LogLevel } from '@/gm/platform/log/common/abstractLog';
import { ISessionInfo } from '@/gm/platform/session/common/session';

export class IPCWindowsChannelError extends IPCChannelError {
  public readonly name = 'IPCWindowsChannelError';
}

export interface FileFilter {
  extensions: string[];
  name: string;
}

export interface INativeOpenDialogOptions {
  windowId?: number;
  forceNewWindow?: boolean;
  defaultPath?: string;
}

export interface IWindowConfiguration {
  windowId?: number;
  openedWorkspace?: IWorkspaceIdentifier;
  folderUri?: URI;

  session?: ISessionInfo;

  fullscreen?: boolean;
  accessibilitySupport?: boolean;
  logLevel: LogLevel;
  isInitialStartup?: boolean;
  maximized?: boolean;
  forcedUrl?: string;
}

export interface IInternalNativeOpenDialogOptions extends INativeOpenDialogOptions {
  pickFolders?: boolean;
  pickFiles?: boolean;

  title: string;
  buttonLabel?: string;
  filters?: FileFilter[];
}

export interface IDevToolsOptions {
  mode: 'right' | 'bottom' | 'undocked' | 'detach';
}

export interface MessageBoxOptions {
  type?: string;
  buttons?: string[];
  defaultId?: number;
  title?: string;
  message: string;
  detail?: string;
  checkboxLabel?: string;
  checkboxChecked?: boolean;
  cancelId?: number;
  noLink?: boolean;
  normalizeAccessKeys?: boolean;
}

export interface SaveDialogOptions {
  title?: string;
  defaultPath?: string;
  buttonLabel?: string;
  filters?: FileFilter[];
  message?: string;
  nameFieldLabel?: string;
  showsTagField?: boolean;
}

export interface OpenDialogOptions {
  title?: string;
  defaultPath?: string;
  buttonLabel?: string;
  filters?: FileFilter[];
  properties?: (
    | 'openFile'
    | 'openDirectory'
    | 'multiSelections'
    | 'showHiddenFiles'
    | 'createDirectory'
    | 'promptToCreate'
    | 'noResolveAliases'
    | 'treatPackageAsDirectory'
  )[];
  message?: string;
}

export interface IWindowsService {
  readonly onWindowFocus: CommonEvent<number>;
  readonly onRecentlyOpenedChange: CommonEvent<void>;
  readonly onWindowOpen: CommonEvent<number>;

  pick(options: IInternalNativeOpenDialogOptions): Promise<string[] | undefined>;
  showMessageBox(windowId: number, options: MessageBoxOptions): Promise<IMessageBoxResult>;

  showSaveDialog(
    windowId: number,
    options: SaveDialogOptions
  ): Promise<Electron.SaveDialogReturnValue>;

  showOpenDialog(
    windowId: number,
    options: OpenDialogOptions
  ): Promise<Electron.OpenDialogReturnValue>;

  openAboutDialog(): Promise<void>;

  openDevTools(windowId: number, options?: IDevToolsOptions): Promise<void>;
  toggleDevTools(windowId: number): Promise<void>;

  toggleFullScreen(windowId: number): Promise<void>;
  maximize(windowId: number): Promise<void>;

  enterWorkspace(path: string): Promise<void>;
  createWindowAndEnterWorkspace(identifier: IWorkspaceId): Promise<void>;
  createAndEnterWorkspace(path: URI): Promise<void>;

  quit(): Promise<void>;
}

export interface IMessageBoxResult {
  response: number;
  checkboxChecked?: boolean;
}

export const IWindowsService = createDecorator<IWindowsService>('windowsService');

export interface IWindowService {
  windowId: number;
  onDidChangeFocus: CommonEvent<boolean>;
  onResize: CommonEvent<Event>;

  openDevTools(options?: IDevToolsOptions): Promise<void>;
  showMessageBox(options: MessageBoxOptions): Promise<IMessageBoxResult>;
  toggleDevTools(): Promise<void>;

  toggleFullScreen(): Promise<void>;
  maximize(): Promise<void>;
}

export const IWindowService = createDecorator<IWindowService>('windowService');
