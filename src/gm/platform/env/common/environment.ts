import { Disposable } from '@/gm/base/common/lifecycle';
import { createDecorator } from '@/gm/platform/instantiation/common/instantiation';
import { IWindowConfiguration } from '@/gm/platform/windows/common/windows';

import product from '@/gm/platform/product/node';
import { IStaticExtension } from '@/gm/platform/extensions/electron-browser/staticExtensionService';

export interface IEnvironmentOptions {
  staticExtensions: IStaticExtension[];
}

export interface IEnvironmentService {
  readonly configuration: Required<IWindowConfiguration>;
  readonly vueVersion: string;
  readonly appName: string;
  readonly appVersion: string;

  readonly shouldActivateGlCore: boolean;
  readonly options: IEnvironmentOptions;
}

export const IEnvironmentService = createDecorator<IEnvironmentService>(
  'environmentServiceRendererService'
);

export class EnvironmentService extends Disposable implements IEnvironmentService {
  constructor(configuration: Required<IWindowConfiguration>) {
    super();

    this._configuration = configuration;
  }

  private _options:  IEnvironmentOptions;

  private readonly _configuration: Required<IWindowConfiguration>;
  private readonly _vueVersion: string = '2.6.11';

  public readonly serviceBrand = IEnvironmentService;

  public get options(): IEnvironmentOptions {
    return this._options;
  }

  public get appName(): string {
    return product.nameLong;
  }

  public get appVersion(): string {
    return `${process.env.APP_VERSION} (${process.env.GIT_VERSION})`;
  }

  public get configuration(): Required<IWindowConfiguration> {
    return this._configuration;
  }

  public get vueVersion(): string {
    return this._vueVersion;
  }

  public get shouldActivateGlCore(): boolean {
    return window.document.location.pathname === '/main.html';
  }
}
