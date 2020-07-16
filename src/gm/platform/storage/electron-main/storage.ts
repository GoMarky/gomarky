import { ILogService } from '@/gm/platform/log/common/log';
import { StoreInstance } from '@/gm/platform/storage/electron-main/store';
import { ICreateStorageOptions, IStorageService } from '@/gm/platform/storage/common/storage';

import { URI } from '@/gm/base/common/uri';
import * as path from 'path';

export class SingleStorage<TAccessSchema> {
  private storage: StoreInstance<TAccessSchema>;
  private readonly _uri: URI;

  public constructor(options: ICreateStorageOptions<TAccessSchema>) {
    this._uri = URI.file(path.join(options.cwd, `${options.name}.json`));

    /**
     * Remove uri field, because we extend third-party interface storage options;
     */

    this.storage = new StoreInstance({
      ...options,
      configName: options.name,
    });
  }

  public get URI(): URI {
    return this._uri;
  }

  public get size(): number {
    return this.storage.size;
  }

  public set(key: keyof TAccessSchema, value: any): void {
    return this.storage.set(key, value);
  }

  public get(key: keyof TAccessSchema, defaultValue?: any): any {
    return this.storage.get(key, defaultValue);
  }

  public has(key: keyof TAccessSchema): boolean {
    return this.storage.has(key);
  }

  public remove(key: keyof TAccessSchema): void {
    return this.storage.delete(key);
  }

  public clear(): void {
    return this.storage.clear();
  }

  public getAllFields(): TAccessSchema {
    return this.storage.store;
  }
}

const defaultCreateStorageOptions = {
  serialize: JSON.stringify,
  deserialize: JSON.parse,
  accessPropertiesByDotNotation: false,
  name: 'config',
};

export class StorageService implements IStorageService {
  public constructor(@ILogService private readonly logService: ILogService) {}

  public createStorage<TAccessKey>(
    createOptions: ICreateStorageOptions<TAccessKey>
  ): SingleStorage<TAccessKey> {
    const options = {
      ...defaultCreateStorageOptions,
      ...createOptions,
    };

    return new SingleStorage(options);
  }
}
