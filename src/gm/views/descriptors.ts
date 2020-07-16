import { IMenubarService } from '@/gm/platform/menubar/common/menubar';
import { MenubarService } from '@/gm/platform/menubar/electron-browser/menubar';
import {
  IMainProcessService,
  MainProcessService,
} from '@/gm/platform/ipc/electron-browser/mainProcessService';

import { ConsoleLogService } from '@/gm/platform/log/electron-browser/consoleLogRenderer';
import { LogLevel } from '@/gm/platform/log/common/abstractLog';
import { ILogService } from '@/gm/platform/log/common/log';

import {
  IWindowConfiguration,
  IWindowService,
  IWindowsService,
} from '@/gm/platform/windows/common/windows';

import { EnvironmentService, IEnvironmentService } from '@/gm/platform/env/common/environment';
import { CodeWindowRenderer } from '@/gm/platform/window/electron-browser/window';
import { CommandService, ICommandService } from '@/gm/platform/commands/electron-browser/commands';

import { StateService } from '@/gm/platform/state/electron-browser/state';
import { IStateService } from '@/gm/platform/state/common/state';
import { ILifecycleService } from '@/gm/platform/lifecycle/common/lifecycle';
import { LifecycleService } from '@/gm/platform/lifecycle/electron-browser/lifecycle';
import { IKeyboardService, KeyboardService } from '@/gm/platform/keyboard/electron-browser/keyboard';

import { InstantiationService } from '@/gm/platform/instantiation/common/instantiation';
import { ContextKeyService } from '@/gm/platform/contextkey/common/contextKeyService';
import { IContextKeyService } from '@/gm/platform/contextkey/common/contextkey';

import { FileService } from '@/gm/platform/files/common/fileService';

import { IFileService } from '@/gm/platform/files/common/files';
import { ServiceCollection } from '@/gm/platform/instantiation/common/ServiceCollection';
import { WindowsService } from '@/gm/platform/windows/electron-browser/windowsService';

import { TelemetryService } from '@/gm/platform/telemetry/electron-browser/telemetry';

import { ITelemetryService } from '@/gm/platform/telemetry/common/telemetry';
import { SessionService } from '@/gm/platform/session/electron-browser/sessionService';
import { ISessionService } from '@/gm/platform/session/common/session';

import store from '@/gm/platform/store/electron-browser';
import { WorkspacesService } from '@/gm/platform/workspaces/electron-browser/workspacesService';
import { IWorkspacesService } from '@/gm/platform/workspaces/common/workspaces';

const windowConfiguration: Required<IWindowConfiguration> = window.GoMarky_WIN_CONFIGURATION;

const services = new ServiceCollection();

// instantiation service
const instantiationService = new InstantiationService(services, true);
store.instantiationService = instantiationService;

// log renderer process
const logService = new ConsoleLogService(LogLevel.Info);
services.set(ILogService, logService);

// context key service
const contextKeyService = new ContextKeyService();
services.set(IContextKeyService, contextKeyService);

// environment (window configuration, cli args)
const environmentService = new EnvironmentService(windowConfiguration);
services.set(IEnvironmentService, environmentService);

// IPC connection to main process
const mainProcessService = new MainProcessService();
services.set(IMainProcessService, mainProcessService);

// workspaces service
const workspacesService = new WorkspacesService(mainProcessService);
services.set(IWorkspacesService, workspacesService);

// keyboard service
const keyboardService = new KeyboardService(mainProcessService);
services.set(IKeyboardService, keyboardService);

// file service
const fileService = new FileService(logService);
services.set(IFileService, fileService);

// state ipc implementation
const stateService = new StateService(mainProcessService);
services.set(IStateService, stateService);

// telemetry service
const telemetryService = new TelemetryService();
services.set(ITelemetryService, telemetryService);

// session service
const sessionService = new SessionService(mainProcessService);
services.set(ISessionService, sessionService);

// windows ipc implementation
const windowsService = new WindowsService(mainProcessService);
services.set(IWindowsService, windowsService);

// window ipc implementation
const windowService = new CodeWindowRenderer(environmentService, windowsService, contextKeyService);
services.set(IWindowService, windowService);

// lifecycle service
const lifecycleService = new LifecycleService(windowService, stateService, logService);
services.set(ILifecycleService, lifecycleService);

// menubar ipc implementation
const menubarService = new MenubarService(mainProcessService);
services.set(IMenubarService, menubarService);

// command service
const commandService = new CommandService(instantiationService, lifecycleService, logService);
services.set(ICommandService, commandService);

export default services;
