import { Emitter, Event, GlobalEvent } from '@/gm/base/common/event';
import { Disposable, IDisposable, toDisposable } from '@/gm/base/common/lifecycle';
import { ILogService } from '@/gm/platform/log/common/log';

import { ipcRenderer as ipc } from 'electron';
import {
  CommandError,
  ICommand,
  ICommandEvent,
  ICommandExecuteBody,
  ICommandFuncBody,
  ICommandRegistry,
  ICommandUndoEvent,
  IExecuteCommandInRenderer,
} from '@/gm/platform/commands/common/commands';

import {
  createDecorator,
  IInstantiationService,
  IServicesAccessor,
} from '@/gm/platform/instantiation/common/instantiation';
import { IKeyboardService } from '@/gm/platform/keyboard/electron-browser/keyboard';
import { IKeybindingItem } from '@/gm/platform/keyboard/common/keyboard';

import { IContextKeyService, RawContextKey } from '@/gm/platform/contextkey/common/contextkey';
import { ILifecycleService } from '@/gm/platform/lifecycle/common/lifecycle';
import { ContextCommandService } from '@/gm/platform/commands/electron-browser/contextCommandService';

import {
  IContextCommandService,
  IRegisterCommandContext,
} from '@/gm/platform/commands/electron-main/contextCommand';

export const ICommandService = createDecorator<ICommandService>('commandService');

export interface ICommandService {
  onWillExecuteCommand: Event<CommandEvent>;
  onDidExecuteCommand: Event<ICommandEvent>;
  onDidUndoCommand: Event<ICommandUndoEvent>;

  executeCommand<T>(id: string, ...args: any[]): Promise<T | void>;

  redoCommand(): Promise<void>;

  undoCommand(): Promise<void>;

  registerContext(options: IRegisterCommandContext): void;
}

export class CommandEvent extends GlobalEvent {
  constructor(public readonly commandId: string, public readonly args: any[]) {
    super();
  }
}

export class CommandImpl<T = any> extends Disposable implements ICommandExecuteBody {
  constructor(
    public readonly execute: (...args: any[]) => T,
    public readonly undo?: (...args: any[]) => T,
    public readonly value?: any
  ) {
    super();
  }
}

export const CommandsRegistry: ICommandRegistry = new (class implements ICommandRegistry {
  private readonly _onDidRegisterCommand = new Emitter<string>();
  public readonly onDidRegisterCommand: Event<string> = this._onDidRegisterCommand.event;
  private _commands: Map<string, ICommand> = new Map();

  public getCommand(id: string): ICommand | undefined {
    return this._commands.get(id);
  }

  public hasCommand(id: string): boolean {
    return this._commands.has(id);
  }

  public getCommands(): Map<string, ICommand> {
    return this._commands;
  }

  public registerCommand(idOrCommand: ICommand | string, method?: ICommandFuncBody): IDisposable {
    if (!idOrCommand) {
      throw new CommandError('No command id');
    }

    if (typeof idOrCommand === 'string') {
      return this.registerCommand({
        id: idOrCommand,
        method: method as ICommandFuncBody,
        description: { description: '', args: [] },
      });
    }

    const { id, method: command } = idOrCommand;

    this._commands.set(id, {
      method: command,
      id,
      description: idOrCommand.description || { args: [], description: '' },
    });

    this._onDidRegisterCommand.fire(id);

    // unregister command here
    return toDisposable(() => {
      this._commands.delete(id);
    });
  }
})();

export interface ICommandHistoryRecord {
  command: ICommand;
  args: any[];
}

export class CommandService extends Disposable implements ICommandService {
  private readonly _onWillExecuteCommand: Emitter<CommandEvent> = this._register(
    new Emitter<CommandEvent>()
  );
  public readonly onWillExecuteCommand: Event<CommandEvent> = this._onWillExecuteCommand.event;

  private readonly _onDidExecuteCommand: Emitter<ICommandEvent> = new Emitter<ICommandEvent>();
  public readonly onDidExecuteCommand: Event<ICommandEvent> = this._onDidExecuteCommand.event;

  private readonly _onDidUndoCommand: Emitter<ICommandUndoEvent> = new Emitter<ICommandEvent>();
  public readonly onDidUndoCommand: Event<ICommandUndoEvent> = this._onDidUndoCommand.event;

  private readonly executeCommandHistory: ICommandHistoryRecord[] = [];
  private readonly undoCommandHistory: ICommandHistoryRecord[] = [];

  public readonly serviceBrand = ICommandService;
  private readonly _contextService: IContextCommandService;

  constructor(
    @IInstantiationService readonly instantiationService: IInstantiationService,
    @ILifecycleService private readonly lifecycleService: ILifecycleService,
    @ILogService private readonly logService: ILogService
  ) {
    super();

    this._contextService = new ContextCommandService(logService);

    this.registerListeners();
  }

  public async executeCommand<T>(id: string, ...args: any[]): Promise<T | void> {
    const commandIsRegistered = CommandsRegistry.hasCommand(id);

    if (commandIsRegistered) {
      return this.tryExecuteCommand<T>(id, args);
    }

    this.logService.error(
      `CommandService#executeCommand - Command ${id} is not registered, but was requesting for execute`
    );
  }

  public async undoCommand(): Promise<void> {
    const record: ICommandHistoryRecord | undefined = this.executeCommandHistory.pop();

    if (record === undefined) {
      return; /* Calling .pop() method on empty array return undefined; */
    }

    const { command, args } = record;

    const commandImpl = this.instantiationService.invokeFunction((accessor: IServicesAccessor) =>
      command.method.call(undefined, accessor)
    );

    if (!commandImpl.undo) {
      return; /* do nothing, because command doesnt have an undo action; */
    }

    const result = await commandImpl.undo.call(undefined, ...args);
    this.undoCommandHistory.push({ command, args });

    return result;
  }

  public async redoCommand(): Promise<void> {
    const record: ICommandHistoryRecord | undefined = this.undoCommandHistory.pop();

    if (record === undefined) {
      return; // Calling .pop() method on empty array return undefined;
    }

    const { command, args } = record;

    const commandImpl = this.instantiationService.invokeFunction((accessor: IServicesAccessor) =>
      command.method.call(undefined, accessor)
    );

    const result = await commandImpl.execute.call(undefined, ...args);
    this.executeCommandHistory.push({ command, args });

    return result;
  }

  public registerContext(options: IRegisterCommandContext): void {
    return this._contextService.registerContext(options);
  }

  private async tryExecuteCommand<T = any>(id: string, args: any[]): Promise<T | void> {
    const command = CommandsRegistry.getCommand(id);

    if (!command) {
      return Promise.reject(new CommandError(`command ${id} not found`));
    }

    const event = new CommandEvent(id, args);

    this._onWillExecuteCommand.fire(event);

    if (event.defaultPrevented) {
      return this.logService.trace(
        'CommandService#tryExecuteCommand',
        `Command with id ${event.commandId} was prevented for execute`
      );
    }

    this.logService.info('CommandService#executeCommand', id);

    const commandImpl = this.instantiationService.invokeFunction((accessor: IServicesAccessor) =>
      command.method.call(undefined, accessor)
    );

    const result = await commandImpl.execute.call(undefined, ...args);

    if (result) {
      args.push(result);
    }

    if (!isUndoOrRedoCommand(id)) {
      this.executeCommandHistory.push({ command, args });
    }

    this._onDidExecuteCommand.fire({ commandId: id, args });

    return result;
  }

  private log(...args: any[]): void {
    return this.logService.info('CommandService', ...args);
  }

  private registerListeners(): void {
    this.instantiationService.invokeFunction((accessor: IServicesAccessor) => {
      const KeyboardRegistry = accessor.get(IKeyboardService);
      const contextService = accessor.get(IContextKeyService);

      ipc.on(
        'gomarky:executeCommandInRenderer',
        (_: unknown, descriptor: IExecuteCommandInRenderer) => {
          const keybindings = KeyboardRegistry.getDefaultKeybindings();
          const command = keybindings.find(
            (keybinding: IKeybindingItem) => keybinding.id === descriptor.id
          );

          if (!command) {
            return this.logService.warn(`Command ${descriptor.id} was not found`);
          }

          const context = this._contextService.getContext(descriptor.id);

          if (context && Array.isArray(context)) {
            for (const key of context) {
              if (key instanceof RawContextKey) {
                const value = key.getValue(contextService);
                const type = typeof value;

                switch (type) {
                  case 'boolean':
                    if (value === false) {
                      return;
                    }
                    break;
                  case 'function':
                    if (value() === false) {
                      return;
                    }
                    break;
                }
              }
            }

            return this.executeCommand(descriptor.id);
          } else if (context) {
            if (context instanceof RawContextKey) {
              if (context.getValue(contextService) === false) {
                return;
              }
            }
          }

          return this.executeCommand(descriptor.id);
        }
      );
    });
  }
}

function isUndoOrRedoCommand(id: string): boolean {
  return id === 'gomarky.command.undo' || id === 'gomarky.command.redo';
}
