import { Disposable } from '@/gm/base/common/lifecycle';
import {
  AutoSaveMode,
  IFilesConfigurationService,
  SaveReason,
} from '@/gm/workbench/services/files/common/filesConfiguration';
import { ILogService } from '@/gm/platform/log/common/log';
import { IWorkbenchContribution } from '@/gm/workbench/common/contributions';

export interface IAutoSaveConfiguration {
  autoSaveDelay?: number;
  autoSaveFocusChange: boolean;
  autoSaveApplicationChange: boolean;
}

export class SceneAutoSave extends Disposable implements IWorkbenchContribution {
  private autoSaveAfterDelay: number | undefined;

  constructor(
    @IFilesConfigurationService
    private readonly filesConfigurationService: IFilesConfigurationService,
    @ILogService private readonly logService: ILogService
  ) {
    super();
  }

  private onAutoSaveConfigurationChange(config: IAutoSaveConfiguration, fromEvent: boolean): void {
    this.autoSaveAfterDelay =
      typeof config.autoSaveDelay === 'number' && config.autoSaveDelay > 0
        ? config.autoSaveDelay
        : undefined;

    if (fromEvent) {
      let reason: SaveReason | undefined;

      switch (this.filesConfigurationService.getAutoSaveMode()) {
        case AutoSaveMode.ON_FOCUS_CHANGE:
          reason = SaveReason.FOCUS_CHANGE;
          break;
        case AutoSaveMode.ON_WINDOW_CHANGE:
          reason = SaveReason.WINDOW_CHANGE;
          break;
        case AutoSaveMode.AFTER_SHORT_DELAY:
        case AutoSaveMode.AFTER_LONG_DELAY:
          reason = SaveReason.AUTO;
          break;
      }

      if (reason) {
        //
      }
    }
  }
}
