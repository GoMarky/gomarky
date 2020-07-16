import { createDecorator } from '@/gm/platform/instantiation/common/instantiation';
import { SingleStorage } from '@/gm/platform/storage/electron-main/storage';
import { ICreateStoreInstanceOptions } from '@/gm/platform/storage/common/store';

export const IStorageService = createDecorator<IStorageService>('storageService');

export interface IStorageService {
  createStorage<TAccessKey>(
    createOptions: ICreateStorageOptions<TAccessKey>
  ): SingleStorage<TAccessKey>;
}

export type ICreateStorageOptions<T> = Omit<
  ICreateStoreInstanceOptions<T>,
  'configName' | 'projectName' | 'projectVersion' | 'projectSuffix'
> & {
  /**
   * Name of the storage file (without extension).
   * This is useful if you want multiple storage files for your app. Or if you're making a reusable Electron module that persists some data, in which case you should **not** use the name `config`.
   * @default 'config'
   */
  readonly name?: string;
};

export const enum StorageScope {
  GLOBAL,
  WORKSPACE,
}
