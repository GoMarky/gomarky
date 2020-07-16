import { Disposable } from '@/gm/base/common/lifecycle';
import {
  CommandContext,
  GlobalContext,
  IContextCommandService,
  IRegisterCommandContext,
} from '@/gm/platform/commands/electron-main/contextCommand';
import { ILogService } from '@/gm/platform/log/common/log';

import { CommandError } from '@/gm/platform/commands/common/commands';

export class ContextCommandService extends Disposable implements IContextCommandService {
  private _contexts: Map<string, CommandContext | GlobalContext> = new Map();

  constructor(@ILogService private readonly logService: ILogService) {
    super();
  }

  public getContext(commandId: string): CommandContext | GlobalContext | undefined {
    return this._contexts.get(commandId);
  }

  public registerContext(options: IRegisterCommandContext): void {
    const { commandId, context } = options;

    if (this._contexts.has(commandId)) {
      throw new CommandError(
        `ContextCommandService#registerCommandContext - Context for command ${commandId} already registered`
      );
    }

    this._contexts.set(commandId, context);
  }
}
