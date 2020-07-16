import { createDecorator } from '@/gm/platform/instantiation/common/instantiation';
import { Disposable } from '@/gm/base/common/lifecycle';
import { AutoSaveConfiguration } from '@/gm/platform/files/common/files';
import { registerSingleton } from '@/gm/platform/instantiation/common/singleton';

import {
  IContextKey,
  IContextKeyService,
  RawContextKey,
} from '@/gm/platform/contextkey/common/contextkey';

export const enum AutoSaveMode {
  OFF,
  AFTER_SHORT_DELAY,
  AFTER_LONG_DELAY,
  ON_FOCUS_CHANGE,
  ON_WINDOW_CHANGE,
}

export const enum SaveReason {
  EXPLICIT = 1,
  AUTO = 2,
  FOCUS_CHANGE = 3,
  WINDOW_CHANGE = 4,
}

export interface IFilesConfigurationService {
  getAutoSaveMode(): AutoSaveMode;
}

export const IFilesConfigurationService = createDecorator<IFilesConfigurationService>(
  'filesConfigurationService'
);

export const AutoSaveAfterShortDelayContext = new RawContextKey<boolean>(
  'autoSaveAfterShortDelayContext',
  false
);

export class FilesConfigurationService extends Disposable implements IFilesConfigurationService {
  private readonly configuredAutoSaveDelay?: number;
  private readonly configuredAutoSaveOnFocusChange: boolean | undefined;
  private readonly configuredAutoSaveOnWindowChange: boolean | undefined;

  private static readonly DEFAULT_AUTO_SAVE_MODE = AutoSaveConfiguration.OFF;

  private readonly autoSaveShortDelayContext: IContextKey<boolean>;

  constructor(@IContextKeyService contextKeyService: IContextKeyService) {
    super();

    this.autoSaveShortDelayContext = AutoSaveAfterShortDelayContext.bindTo(contextKeyService);
  }

  public getAutoSaveMode(): AutoSaveMode {
    if (this.configuredAutoSaveOnFocusChange) {
      return AutoSaveMode.ON_FOCUS_CHANGE;
    }

    if (this.configuredAutoSaveOnWindowChange) {
      return AutoSaveMode.ON_WINDOW_CHANGE;
    }

    return AutoSaveMode.OFF;
  }
}

registerSingleton(IFilesConfigurationService, FilesConfigurationService);
