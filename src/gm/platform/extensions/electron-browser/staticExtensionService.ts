import { createDecorator } from '@/gm/platform/instantiation/common/instantiation';
import {
  ExtensionIdentifier,
  IExtensionDescription,
  IExtensionManifest,
} from '@/gm/platform/extensions/common/extensions';
import { URI } from '@/gm/base/common/uri';

import { ILifecycleService, LifePhase } from '@/gm/platform/lifecycle/common/lifecycle';
import { IFileService } from '@/gm/platform/files/common/files';
import * as path from 'path';

import { createFolderTree, IFolderTreeItem } from '@/gm/platform/workspaces/common/workspaces';
import { readJSON } from 'fs-extra';

export const IStaticExtensionsService = createDecorator<IStaticExtensionsService>(
  'IStaticExtensionsService'
);

export interface IStaticExtensionsService {
  getExtensions(): Promise<IExtensionDescription[]>;
}

export interface IStaticExtension {
  packageJSON: IExtensionManifest;
  extensionLocation: URI;
}

export class StaticExtensionsService implements IStaticExtensionsService {
  private _descriptions: IExtensionDescription[] = [];

  constructor(
    @ILifecycleService private readonly lifecycleService: ILifecycleService,
    @IFileService private readonly fileService: IFileService
  ) {
    this.lifecycleService.when(LifePhase.Ready).then(async () => {
      const staticExtensions = await this.scanStaticExtensions();

      this._descriptions = staticExtensions.map(
        (data: IStaticExtension) =>
          <IExtensionDescription>{
            identifier: new ExtensionIdentifier(
              `${data.packageJSON.publisher}.${data.packageJSON.name}`
            ),
            extensionLocation: data.extensionLocation,
            ...data.packageJSON,
          }
      );
    });
  }

  public async getExtensions(): Promise<IExtensionDescription[]> {
    return this._descriptions;
  }

  private async scanStaticExtensions(): Promise<IStaticExtension[]> {
    const resource = URI.file(path.join('/Users/teodordre/Documents/reps/gomarky/gomarky-m/extensions'));

    const dirs = (await createFolderTree(resource)).map(async (resource: IFolderTreeItem) => {
      const packageJSON = resource.children?.find((resource: IFolderTreeItem) =>
        resource.uri.fsPath.endsWith('package.json')
      );

      return {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        packageJSON: await readJSON(packageJSON!.uri.path),
        extensionLocation: resource.uri,
      };
    });

    return Promise.all(dirs);
  }
}
