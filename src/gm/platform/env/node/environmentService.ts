import { Disposable } from '@/gm/base/common/lifecycle';
import { app } from 'electron';
import { createDecorator } from '@/gm/platform/instantiation/common/instantiation';

export interface IEnvironmentService {
  isBuilt: boolean;
  userDataPath: string;

  sessionId: string;
}

export const IEnvironmentService = createDecorator<IEnvironmentService>('environmentMainService');

export class EnvironmentService extends Disposable implements IEnvironmentService {
  constructor() {
    super();
  }

  private _sessionId: string;
  public get sessionId(): string {
    return this._sessionId;
  }
  public set sessionId(id) {
    this._sessionId = id;
  }

  public get isBuilt(): boolean {
    return app.isPackaged;
  }

  public get userDataPath(): string {
    return app.getPath('userData');
  }
}
