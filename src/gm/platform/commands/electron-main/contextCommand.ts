import { ContextKeyDefinedExpr } from '@/gm/platform/contextkey/common/contextkey';

export type CommandContext = ContextKeyDefinedExpr | ContextKeyDefinedExpr[];

export type GlobalContext = null;

export interface IRegisterCommandContext {
  commandId: string;
  context: CommandContext | GlobalContext;
}

export interface IContextCommandService {
  getContext(commandId: string): CommandContext | GlobalContext | undefined;

  registerContext(options: IRegisterCommandContext): void;
}
