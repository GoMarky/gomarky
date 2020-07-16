import { IServerChannel } from '@/gm/base/parts/ipc/common/ipc';
import { Event } from '@/gm/base/common/event';
import { IKeyboardService } from '@/gm/platform/keyboard/common/keyboard';
import {
  IInstantiationService,
  IServicesAccessor,
} from '@/gm/platform/instantiation/common/instantiation';
import { ICommandMainService } from '@/gm/platform/commands/electron-main/commands';
import { IWindowsMainService } from '@/gm/platform/windows/electron-main/windows';

export class IPCKeyboardChannelError extends Error {
  public readonly name = 'IPCKeyboardChannelError';
}

type KeyboardCall = {
  [key in keyof IKeyboardService]: keyof IKeyboardService;
};

const calls: KeyboardCall = {
  registerShortcut: 'registerShortcut',
  registerKeyCode: 'registerKeyCode',
};

export class KeyboardChannel implements IServerChannel {
  public readonly calls = calls;

  constructor(
    @IInstantiationService private readonly instantiationService: IInstantiationService,
    private service: IKeyboardService
  ) {}

  public listen<T>(_: unknown, event: string): Event<T> {
    throw new IPCKeyboardChannelError(`Event not found: ${event}`);
  }

  public async call(command: string, arg?: any): Promise<any> {
    switch (command) {
      case calls.registerShortcut:
        return this.instantiationService.invokeFunction((accessor: IServicesAccessor) => {
          const commandService = accessor.get(ICommandMainService);
          const windowsMainService = accessor.get(IWindowsMainService);

          const commandServiceId = arg[0].id;

          const window =
            windowsMainService.getLastActiveWindow() || windowsMainService.getFocusedWindow();

          return this.service.registerShortcut(
            arg[0],
            () => commandService.executeCommandInRenderer(commandServiceId),
            window ? window.win : undefined
          );
        });
      case calls.registerKeyCode:
        return this.instantiationService.invokeFunction((accessor: IServicesAccessor) => {
          const commandService = accessor.get(ICommandMainService);
          const windowsMainService = accessor.get(IWindowsMainService);

          const commandServiceId = arg[0].id;

          const window =
            windowsMainService.getLastActiveWindow() || windowsMainService.getFocusedWindow();

          return this.service.registerKeyCode(
            arg[0],
            () => commandService.executeCommandInRenderer(commandServiceId),
            window ? window.win : undefined
          );
        });
    }

    throw new IPCKeyboardChannelError(`Call not found: ${command}`);
  }
}
