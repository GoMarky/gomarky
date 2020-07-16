import { IServicesAccessor } from '@/gm/platform/instantiation/common/instantiation';
import { IWindowService, IWindowsService } from '@/gm/platform/windows/common/windows';
import * as gomarky from 'gomarky';

import { CommandsRegistry, ICommandService } from '@/gm/platform/commands/electron-browser/commands';
import { ICommandFuncBody } from '@/gm/platform/commands/common/commands';
import { Disposable, IDisposable } from '@/gm/base/common/lifecycle';

import { IExtHostGraphicLibrary } from '@/gm/workbench/api/common/extHostProtocol';

export interface IExtensionApiFactory {
  (): typeof gomarky;
}

export class ExtensionHostError extends Error {
  public readonly name = 'ExtensionHostError';
}

export function createApiFactoryAndRegisterActors(
  accessor: IServicesAccessor
): IExtensionApiFactory {
  const windowsService = accessor.get(IWindowsService);
  const commandService = accessor.get(ICommandService);
  const windowService = accessor.get(IWindowService);

  const extHostGlLibrary = accessor.get(IExtHostGraphicLibrary);

  return function(): typeof gomarky {
    const window: typeof gomarky.window = {
      get state() {
        return {
          focused: false,
        };
      },

      get onDidWindowFocus() {
        return windowsService.onWindowFocus;
      },

      async toggleFullScreen() {
        return windowService.toggleFullScreen();
      },
      async maximize() {
        return windowService.maximize();
      },
    };

    const scene: typeof gomarky.scene = {
      zoomIn() {
        return extHostGlLibrary.zoomIn();
      },
      zoomOut() {
        return extHostGlLibrary.zoomOut();
      },
    };

    const commands: typeof gomarky.commands = {
      executeCommand<T>(command: string, ...args: any[]): Promise<T | void> {
        return commandService.executeCommand(command, args);
      },
      registerCommand(command: string, method?: ICommandFuncBody): IDisposable {
        return CommandsRegistry.registerCommand(command, method);
      },
    };

    return ({
      window,
      commands,
      scene,
      Disposable: Disposable,
    } as unknown) as typeof gomarky;
  };
}
