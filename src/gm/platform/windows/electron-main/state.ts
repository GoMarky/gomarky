import { IWindowsState } from '@/gm/platform/windows/electron-main/windows';
import { IWindowState } from '@/gm/platform/window/electron-main/window';

export interface ISerializedWindowsState {
  lastActiveWindow?: ISerializedWindowState;
  lastPluginDevelopmentHostWindow?: ISerializedWindowState;
  openedWindows: ISerializedWindowState[];
}

interface ISerializedWindowState {
  workspace?: { id: string; configPath: string };
  folder?: string;
  uiState: IWindowState;
}

export function restoreWindowsState(data: object): IWindowsState {
  const result: IWindowsState = { openedWindows: [] };
  const windowsState = (data as ISerializedWindowsState) || { openedWindows: [] };

  if (windowsState.lastActiveWindow) {
    result.lastActiveWindow = restoreWindowState(windowsState.lastActiveWindow);
  }

  if (Array.isArray(windowsState.openedWindows)) {
    result.openedWindows = windowsState.openedWindows.map(windowState =>
      restoreWindowState(windowState)
    );
  }

  return result;
}

export function restoreWindowState(windowState: ISerializedWindowState): any {
  const result: any = {};

  return windowState;
}
