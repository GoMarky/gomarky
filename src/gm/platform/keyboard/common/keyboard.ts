import { createDecorator } from '@/gm/platform/instantiation/common/instantiation';
import { FunctionLike } from '@/gm/base/common/types';
import { ICommand } from '@/gm/platform/commands/common/commands';

export const IKeyboardService = createDecorator<IKeyboardService>('keyboardService');

export interface IShortcuts {
  primary?: number;
  secondary?: number[];
  win?: {
    primary: number;
    secondary?: number[];
  };
  linux?: {
    primary: number;
    secondary?: number[];
  };
  mac?: {
    primary: number;
    secondary?: number[];
  };
}

export interface IKeyboardRendererService {
  registerKeyCode(keybinding: ISingleKeybindingItem): Promise<void>;

  registerShortcut(keybinding: IKeybindingItem): Promise<void>;

  registerShortcutCommandAlias(accelerator: string, commandAlias: string): Promise<void>;

  getDefaultKeybindings(): IKeybindingItem[];
}

export type IKeybindingRendererRule = Omit<ICommand, 'method' | 'description'>;
export type Accelerator = string;
export type EventTrigger = 'keyDown' | 'keyUp' | 'char';

export interface IKeyCodeItem {
  trigger: EventTrigger;
  autoRepeat?: boolean;
  accelerator: Accelerator;
  id: string;
}

export interface IKeybindingItem extends IKeybindingRendererRule {
  accelerator: Accelerator;
  autoRepeat?: boolean;
}

export interface ISingleKeybindingItem extends IKeybindingItem {
  trigger: EventTrigger;
}

export interface IKeyboardService {
  registerShortcut(
    options: IKeybindingItem,
    callback: FunctionLike,
    win?: Electron.BrowserWindow
  ): void;
  registerKeyCode(
    keyCode: IKeyCodeItem,
    callback: FunctionLike,
    win?: Electron.BrowserWindow
  ): void;
}
