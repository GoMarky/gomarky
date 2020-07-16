import 'normalize.css/normalize.css';
import { Disposable } from '@/gm/base/common/lifecycle';

import { ServiceCollection } from '@/gm/platform/instantiation/common/ServiceCollection';
import { ILogService } from '@/gm/platform/log/common/log';
import { Workbench } from '@/gm/code/electron-browser/workbench/workbench';

import {
  CommandImpl,
  CommandsRegistry,
  ICommandService,
} from '@/gm/platform/commands/electron-browser/commands';

import { domContentLoaded } from '@/gm/base/electron-browser/dom';
import { IKeyboardService } from '@/gm/platform/keyboard/electron-browser/keyboard';

import { IFileService } from '@/gm/platform/files/common/files';
import { DiskFileSystemProvider } from '@/gm/platform/files/node/diskFileSystemProvider';
import { Schemas } from '@/gm/base/common/network';

import { IWindowConfiguration } from '@/gm/platform/windows/common/windows';
import * as perf from '@/gm/base/common/perfomance';
import { IInstantiationService } from '@/gm/platform/instantiation/common/instantiation';
import { getSingletonServiceDescriptors } from '@/gm/platform/instantiation/common/singleton';

declare global {
  interface Window {
    GOMARKY_WIN_CONFIGURATION: Required<IWindowConfiguration>;
  }
}

export class CodeRenderer extends Disposable {
  private workbench: Workbench;

  public async open(serviceCollection: ServiceCollection): Promise<ServiceCollection> {
    const services = await this.initServices(serviceCollection);

    await domContentLoaded();

    perf.mark(`willStartWorkbench`);

    this.workbench = new Workbench(document.body, services, services.get(ILogService));

    this.workbench.startup();

    const commandService = services.get(ICommandService);
    const keyboardService = services.get(IKeyboardService);

    CommandsRegistry.registerCommand(
      'gomarky.command.redo',
      () => new CommandImpl(() => commandService.redoCommand())
    );
    CommandsRegistry.registerCommand(
      'gomarky.command.undo',
      () => new CommandImpl(() => commandService.undoCommand())
    );

    await keyboardService.registerShortcut({
      id: 'gomarky.command.undo',
      accelerator: 'CmdOrCtrl+Z',
      autoRepeat: true,
    });

    await keyboardService.registerShortcut({
      id: 'gomarky.command.redo',
      accelerator: 'CmdOrCtrl+Shift+Z',
      autoRepeat: true,
    });

    return services;
  }

  private async initServices(services: ServiceCollection): Promise<ServiceCollection> {
    const fileService = services.get(IFileService);
    const logService = services.get(ILogService);

    const diskFileSystemProvider = new DiskFileSystemProvider(logService);

    fileService.registerProvider(Schemas.file, diskFileSystemProvider);

    return services;
  }
}

export function createRenderer(): Promise<ServiceCollection> {
  const renderer = new CodeRenderer();
  const services = require('./descriptors').default;

  const instantiationService = services.get(IInstantiationService);

  // make sure to add all services that use `registerSingleton`
  for (const [id, descriptor] of getSingletonServiceDescriptors()) {
    instantiationService.createInstance2(descriptor, id);
  }

  return renderer.open(services);
}
