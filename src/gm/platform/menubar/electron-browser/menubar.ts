import { IMainProcessService } from '@/gm/platform/ipc/electron-browser/mainProcessService';
import { IChannel } from '@/gm/base/parts/ipc/common/ipc';
import { IMenubarData, IMenubarService } from '@/gm/platform/menubar/common/menubar';

export class MenubarService implements IMenubarService {
  public readonly serviceBrand = IMenubarService;

  private channel: IChannel;

  constructor(@IMainProcessService mainProcessService: IMainProcessService) {
    this.channel = mainProcessService.getChannel('menubar');
  }

  public updateMenubar(windowId: number, menuData: IMenubarData): Promise<void> {
    return this.channel.call('updateMenubar', [windowId, menuData]);
  }
}
