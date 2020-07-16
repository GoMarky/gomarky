import { Disposable } from '@/gm/base/common/lifecycle';
import { createDecorator } from '@/gm/platform/instantiation/common/instantiation';
import { IWindowsMainService } from '@/gm/platform/windows/electron-main/windows';

import { ICodeWindow } from '@/gm/platform/window/electron-main/window';

export const ICommandMainService = createDecorator<ICommandMainService>('commandMainService');

export interface ICommandMainService {
  executeCommandInRenderer(commandId: string): void;
}

export interface IExecuteCommandInRendererOptions {
  id: string;
  staticArguments?: any[];
}

export class CommandService extends Disposable implements ICommandMainService {
  constructor(@IWindowsMainService private readonly windowsMainService: IWindowsMainService) {
    super();
  }

  public executeCommandInRenderer(commandId: string): void {
    const activeWindow =
      this.windowsMainService.getFocusedWindow() || this.windowsMainService.getLastActiveWindow();

    if (!activeWindow) {
      return; /* return? */
    }

    this.doExecuteCommand(activeWindow, { id: commandId });
  }

  private doExecuteCommand(
    window: ICodeWindow,
    descriptor: IExecuteCommandInRendererOptions
  ): void {
    window.send('gomarky:executeCommandInRenderer', descriptor);
  }
}
