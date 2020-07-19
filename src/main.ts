/*---------------------------------------------------------------------------------------------
 * main.ts
 * Входная точка приложения, первый модуль, которая начинается исполняться при запуске.
 * Запускает работу всей программы.
 *--------------------------------------------------------------------------------------------*/

import { CodeApplication } from '@/gm/code/electron-main/app';
import { ServiceCollection } from '@/gm/platform/instantiation/common/ServiceCollection';
import {
  ILifecycleService,
  LifecycleService,
} from '@/gm/platform/lifecycle/electron-main/lifecycle';

import { ConsoleLogMainService } from '@/gm/platform/log/electron-main/consoleLogMain';
import { StateService } from '@/gm/platform/state/electron-main/stateService';
import { LogLevel } from '@/gm/platform/log/common/abstractLog';

import { ILogService } from '@/gm/platform/log/common/log';
import { IStateService } from '@/gm/platform/state/common/state';
import { StorageService } from '@/gm/platform/storage/electron-main/storage';

import { IStorageService } from '@/gm/platform/storage/common/storage';
import { EnvironmentService, IEnvironmentService } from '@/gm/platform/env/node/environmentService';
import {
  IInstantiationService,
  InstantiationService,
} from '@/gm/platform/instantiation/common/instantiation';
import { RequestService } from '@/gm/platform/request/electron-main/requestService';
import { IRequestService } from '@/gm/platform/request/common/requestService';

async function createServices(): Promise<ServiceCollection> {
  const services = new ServiceCollection();

  const consoleLogService = new ConsoleLogMainService(LogLevel.Info);
  services.set(ILogService, consoleLogService);
  consoleLogService.setLevel(LogLevel.Trace);

  const instantiationService = new InstantiationService(services, true);

  const requestService = new RequestService(consoleLogService, instantiationService);
  services.set(IRequestService, requestService);

  const environmentService = new EnvironmentService();
  services.set(IEnvironmentService, environmentService);

  const lifecycleService = new LifecycleService(consoleLogService);
  services.set(ILifecycleService, lifecycleService);

  const stateService = new StateService(environmentService);
  services.set(IStateService, stateService);

  const storageService = new StorageService(consoleLogService);
  services.set(IStorageService, storageService);

  return services;
}

function startup(): void {
  void createServices().then((services: ServiceCollection) => {
    const logService = services.get(ILogService);
    const lifecycleService = services.get(ILifecycleService);
    const stateService = services.get(IStateService);

    const instantiationService = services.get(IInstantiationService);

    const application = new CodeApplication(
      instantiationService,
      lifecycleService,
      logService,
      stateService
    );

    application.startup(services);
  });
}

function main(): void {
  startup();
}

main();
