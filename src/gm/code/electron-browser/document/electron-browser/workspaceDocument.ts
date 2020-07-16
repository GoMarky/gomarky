import { Disposable } from '@/gm/base/common/lifecycle';
import {
  ISerializedWorkspaceDocument,
  IWorkspaceDocument,
} from '@/gm/code/electron-browser/document/common/workspaceDocument';

import { basename, isEqualOrParent, joinPath, URI } from '@/gm/base/common/uri';
import { generateUuid } from '@/gm/base/common/uuid';
import { IWorkspacePage } from '@/gm/code/electron-browser/page/common/page';

import { IFileService } from '@/gm/platform/files/common/files';
import { WorkspacePage } from '@/gm/code/electron-browser/page/electron-browser/page';
import { IInstantiationService } from '@/gm/platform/instantiation/common/instantiation';

import { CriticalError } from '@/gm/base/common/errors';
import { resolveAnnotationPath } from '@/gm/platform/workspace/common/workspace';
import { ITextureService } from '@/gm/code/common/texture/texture';

export class WorkspaceDocument extends Disposable implements IWorkspaceDocument {
  public readonly name: string;
  public readonly id: string = generateUuid();

  private _hasCreated = false;

  constructor(
    public readonly resource: URI,
    @IInstantiationService private readonly instantiationService: IInstantiationService,
    @IFileService private readonly fileService: IFileService,
    @ITextureService private readonly textureService: ITextureService
  ) {
    super();
    this.name = basename(resource);
  }

  private readonly _pages: IWorkspacePage[] = [];
  public get pages(): IWorkspacePage[] {
    return this._pages;
  }

  public get selectedPage(): IWorkspacePage | undefined {
    return this.pages.find(page => page.selected);
  }

  public contains(resource: URI): boolean {
    const { resource: parentResource } = this;

    return isEqualOrParent(resource, parentResource);
  }

  public toJSON(): ISerializedWorkspaceDocument {
    const { id, name, resource } = this;

    return {
      id,
      name,
      resource,
      pages: this._pages.map((page: IWorkspacePage) => page.toJSON()),
    };
  }

  public async initialize(): Promise<this> {
    if (this._hasCreated) {
      throw new CriticalError(
        `WorkspaceDocument#initialize - calling initialize second time is not allowed.`
      );
    }

    const { resource } = this;

    let children;

    try {
      // allow it as non recursive
      const data = await this.fileService.resolve(joinPath(resource, 'media'), {
        resolveSingleChildDescendants: true,
      });

      children = data.children;
    } catch (error) {
      console.log(error);
      return this;
    }

    if (!children) {
      // no children for workspace found
      return this;
    }

    const folders = children.filter(child => child.name !== '.DS_Store' && child.name !== '.gomarky');

    for (const { resource } of folders) {
      const name = basename(resource);
      const resourceData = joinPath(resolveAnnotationPath(resource), `${name}.json`);

      const workspacePage = this.instantiationService.createInstance<IWorkspacePage>(
        WorkspacePage,
        resource,
        resourceData,
        name,
        this
      );

      this._pages.push(workspacePage);
    }

    this._hasCreated = true;
    return this;
  }
}

export function createWorkspaceDocument(
  resource: URI,
  instantiationService: IInstantiationService
): Promise<IWorkspaceDocument> {
  const workspaceDocument = instantiationService.createInstance<IWorkspaceDocument>(
    WorkspaceDocument,
    resource
  );

  return workspaceDocument.initialize();
}
