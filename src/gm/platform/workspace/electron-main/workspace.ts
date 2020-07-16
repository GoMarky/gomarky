/*---------------------------------------------------------------------------------------------
 * Рабочее пространство gomarky
 *--------------------------------------------------------------------------------------------*/

import { ILogService } from '@/gm/platform/log/common/log';
import { SingleStorage } from '@/gm/platform/storage/electron-main/storage';
import { ILocalWorkspaceStorageSchema } from '@/gm/platform/storage/common/schema';

import { Disposable } from '@/gm/base/common/lifecycle';
import { IWorkspace, IWorkspaceData } from '@/gm/platform/workspace/common/workspace';
import { URI } from '@/gm/base/common/uri';

import { IStateService } from '@/gm/platform/state/common/state';

import { ILifecycleService } from '@/gm/platform/lifecycle/electron-main/lifecycle';

export class Workspace extends Disposable implements IWorkspace {
  constructor(
    @ILogService private readonly logService: ILogService,
    @ILifecycleService private readonly lifecycleService: ILifecycleService,
    @IStateService private readonly stateService: IStateService,
    private readonly _storage: SingleStorage<ILocalWorkspaceStorageSchema>,
    public readonly uri: URI,
    private readonly _id: string
  ) {
    super();
  }

  public get storage(): SingleStorage<ILocalWorkspaceStorageSchema> {
    return this._storage;
  }

  public get id(): string {
    return this._id;
  }

  public setName(name: string): void {
    return this._storage.set('name', name);
  }

  public setDescription(description: string): void {
    return this._storage.set('description', description);
  }

  public toJSON(): IWorkspaceData {
    const description = this._storage.get('description');
    const name = this._storage.get('name');

    return {
      id: this.id,
      description,
      configuration: {},
      name,
      uri: this.uri,
    };
  }

  public [Symbol.toPrimitive](hint: string): string | void {
    if (hint !== 'string') {
      return;
    }

    return JSON.stringify(this.toJSON());
  }
}
