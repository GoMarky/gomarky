import {
  IExtensionAPI,
  IExtensionContext,
  IExtensionDescription,
  IExtensionModule,
} from '@/gm/platform/extensions/common/extensions';
import { URI } from '@/gm/base/common/uri';
import { Schemas } from '@/gm/base/common/network';

import { IInstantiationService } from '@/gm/platform/instantiation/common/instantiation';
import { ILogService } from '@/gm/platform/log/common/log';
import { createApiFactoryAndRegisterActors } from '@/gm/workbench/api/common/extHostImpl';

import mock from 'mock-require';
import { requireDynamically } from '@/gm/base/common/module';

export class ExtHostExtensionError extends Error {
  public readonly name = 'ExtHostExtensionError';
}

export class ActivatedExtension {
  public readonly activationFailed: boolean;
  public readonly activationFailedError: Error | null;
  public readonly module: IExtensionModule;

  constructor(
    activationFailed: boolean,
    activationFailedError: Error | null,
    module: IExtensionModule
  ) {
    this.activationFailed = activationFailed;
    this.activationFailedError = activationFailedError;
    this.module = module;
  }
}

export class ExtHostExtensionService {
  constructor(
    @IInstantiationService private readonly instantiationService: IInstantiationService,
    @ILogService private readonly logService: ILogService
  ) {
    this.beforeReadyToRunExtensions();
  }

  private beforeReadyToRunExtensions(): void {
    const extensionApiFactory = this.instantiationService.invokeFunction(
      createApiFactoryAndRegisterActors
    );

    mock('gomarky', extensionApiFactory());
  }

  public async activateExtension(
    extensionDescription: IExtensionDescription
  ): Promise<ActivatedExtension> {
    return this.doActivateExtension(extensionDescription);
  }

  private async doActivateExtension(
    extensionDescription: IExtensionDescription
  ): Promise<ActivatedExtension> {
    if (!extensionDescription.main) {
      throw new ExtHostExtensionError(
        `ExtHostExtensionService#doActivateExtension - entry point wasn't found for ${extensionDescription.identifier}`
      );
    }

    return Promise.all<IExtensionModule, IExtensionContext>([
      this.loadCommonJSModule(
        extensionDescription.extensionLocation,
        extensionDescription.name,
        extensionDescription.main
      ),
      this.loadExtensionContext(extensionDescription),
    ]).then((values: [IExtensionModule, IExtensionContext]) => {
      return this.callActivate(values[0], values[1]);
    });
  }

  private async loadCommonJSModule(
    module: URI,
    extensionName: string,
    moduleName: string
  ): Promise<IExtensionModule> {
    if (module.scheme !== Schemas.file) {
      throw new ExtHostExtensionError(`Cannot load URI: '${module}' must be of file-scheme`);
    }

    this.logService.info(
      `ExtensionService#loadCommonJSModule - ${extensionName} ${moduleName} ${module.toString2(
        true
      )}`
    );

    return requireDynamically(module.fsPath);
  }

  private async loadExtensionContext(
    _extensionDescription: IExtensionDescription
  ): Promise<IExtensionContext> {
    return {};
  }

  private callActivate(
    extensionModule: IExtensionModule,
    context: IExtensionContext
  ): Promise<ActivatedExtension> {
    return this.callActivateOptional(extensionModule, context).then(() => {
      return new ActivatedExtension(false, null, extensionModule);
    });
  }

  private async callActivateOptional(
    extensionModule: IExtensionModule,
    context: IExtensionContext
  ): Promise<IExtensionAPI> {
    const scope = global;

    const activateResult: Promise<IExtensionAPI> = extensionModule.activate.apply(scope, [context]);

    return activateResult;
  }
}
