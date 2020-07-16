import {
  createDecorator,
  IInstantiationService,
} from '@/gm/platform/instantiation/common/instantiation';
import { Disposable } from '@/gm/base/common/lifecycle';

import { CreateContext, IWindowsMainService } from '@/gm/platform/windows/electron-main/windows';
import { IStateService } from '@/gm/platform/state/common/state';

import { defaultWindowState, ICodeWindow } from '@/gm/platform/window/electron-main/window';
import { IWorkspaceIdentifier } from '@/gm/platform/workspaces/common/workspaces';
import product from '@/gm/platform/product/node';
import { basename } from '@/gm/base/common/uri';
import { isDev } from '@/gm/base/platform';

export interface IPreferencesService {
  openSettingsWindow(workspace: IWorkspaceIdentifier): ICodeWindow;
}

export const IPreferencesService = createDecorator<IPreferencesService>('preferencesService');

export class PreferencesService extends Disposable implements IPreferencesService {
  constructor(
    @IInstantiationService private readonly instantiationService: IInstantiationService,
    @IWindowsMainService private readonly windowsMainService: IWindowsMainService,
    @IStateService private readonly stateService: IStateService
  ) {
    super();
  }

  public openSettingsWindow(workspace: IWorkspaceIdentifier): ICodeWindow {
    const window = this.windowsMainService.openNewWindow(CreateContext.DESKTOP, {
      state: defaultWindowState(),
      forcedUrl: 'settings.html',
      workspace,
    });

    window.win.setTitle(`${product.nameLong} - Preferences - ${basename(workspace.configPath)}`);

    if (isDev) {
      window.win.webContents.openDevTools({ mode: 'right' });
    }

    return window;
  }
}
