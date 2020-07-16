import { createDecorator } from '@/gm/platform/instantiation/common/instantiation';
import { IPCChannelError } from '@/gm/platform/ipc/common/ipc';

export class IPCMenubarChannelError extends IPCChannelError {
  public readonly name = 'IPCMenubarChannelError';
}

export const IMenubarService = createDecorator<IMenubarService>('menubarService');

export interface IMenubarData {
  menus: { [id: string]: IMenubarMenu };
  keybindings: { [id: string]: IMenubarKeybinding };
}

export interface IMenubarMenu {
  items: any[];
}

export interface IMenubarKeybinding {
  label: string;
  userSettingsLabel?: string;
  isNative?: boolean; // Assumed true if missing
}

export interface IMenubarService {
  updateMenubar(windowId: number, menuData: IMenubarData): Promise<void>;
}
