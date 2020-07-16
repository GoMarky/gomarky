import { Disposable } from '@/gm/base/common/lifecycle';
import {
  IWorkspaceContextService,
  IWorkspaceRenderer,
} from '@/gm/platform/workspace/common/workspace';
import { IEnvironmentService } from '@/gm/platform/env/common/environment';

import { IMainProcessService } from '@/gm/platform/ipc/electron-browser/mainProcessService';
import { IChannel } from '@/gm/base/parts/ipc/common/ipc';
import { ILifecycleService, LifePhase } from '@/gm/platform/lifecycle/common/lifecycle';

import { isEqual, URI } from '@/gm/base/common/uri';
import { IWorkspaceDocument } from '@/gm/code/electron-browser/document/common/workspaceDocument';
import { IFileService } from '@/gm/platform/files/common/files';

import { IInstantiationService } from '@/gm/platform/instantiation/common/instantiation';
import { createWorkspaceDocument } from '@/gm/code/electron-browser/document/electron-browser/workspaceDocument';
import { IStoreService } from '@/gm/platform/store/common/storeService';

export class Workspace extends Disposable implements IWorkspaceRenderer {
  public id: string;
  public resource: URI;
  private channel: IChannel;

  private _documents: IWorkspaceDocument[] = [];

  public get documents(): IWorkspaceDocument[] {
    return this._documents;
  }

  public set documents(documents) {
    this._documents = documents;
  }

  constructor(
    private readonly workspaceService: IWorkspaceContextService,
    @IInstantiationService private readonly instantiationService: IInstantiationService,
    @IEnvironmentService private readonly environmentService: IEnvironmentService,
    @IStoreService private readonly storeService: IStoreService,
    @ILifecycleService private readonly lifecycleService: ILifecycleService,
    @IFileService private readonly fileService: IFileService,
    @IMainProcessService mainProcessService: IMainProcessService
  ) {
    super();

    void this.lifecycleService.when(LifePhase.Ready).then(() => {
      this.id = environmentService.configuration.openedWorkspace.id;
      this.resource = URI.file(environmentService.configuration.openedWorkspace.configPath.path);

      this.channel = mainProcessService.getChannel(`workspace:${this.id}`);

      return this.initialize();
    });
  }

  private _selectedDocument: IWorkspaceDocument;
  public get selectedDocument(): IWorkspaceDocument {
    return this._selectedDocument;
  }

  public async selectDocument(document: IWorkspaceDocument): Promise<void> {
    this._selectedDocument = document;
  }

  public setDescription(description: string): Promise<void> {
    return this.channel.call('setDescription', description);
  }

  public setName(name: string): Promise<void> {
    return this.channel.call('setName', name);
  }

  private async initialize(): Promise<void> {
    const { resource } = this;

    if (this.environmentService.shouldActivateGlCore) {
      return this.doInitialize(resource);
    }
  }

  private async doInitialize(resource: URI): Promise<void> {
    // allow it as non recursive
    const result = await this.fileService.resolve(resource, {
      resolveSingleChildDescendants: true,
    });

    if (!result.children) {
      // no children for workspace found
      return;
    }

    const children = result.children.filter(
      child => child.name !== '.DS_Store' && child.name !== '.gomarky'
    );

    const documents = [];

    for (const { resource } of children) {
      const workspaceDocument = await createWorkspaceDocument(resource, this.instantiationService);
      documents.push(workspaceDocument);
    }

    this.documents = documents;

    const lastEditedTextureResource = await this.workspaceService.getLastEditedTexture();

    if (lastEditedTextureResource) {
      const document = documents.find(document => document.contains(lastEditedTextureResource));

      if (document) {
        await this.selectDocument(document);

        const page = document.pages.find(page =>
          isEqual(page.resource, lastEditedTextureResource, false)
        );

        if (page) {
          await page.select();
          return;
        }
      }
    }

    return this.selectDocument(documents[0]);
  }
}
