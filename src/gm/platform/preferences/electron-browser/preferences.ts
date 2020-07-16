import { Disposable } from '@/gm/base/common/lifecycle';
import { IPreferencesService } from '@/gm/platform/preferences/common/preferences';

export class PreferencesService extends Disposable implements IPreferencesService {
  constructor() {
    super();
  }

  private static commonUsedSettings: string[] = ['files.autoSave'];

  public getCommonlyUsedSettings(): string[] {
    return PreferencesService.commonUsedSettings;
  }
}
