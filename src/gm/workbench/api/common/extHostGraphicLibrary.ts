import { Disposable } from '@/gm/base/common/lifecycle';
import { IExtHostGraphicLibrary } from '@/gm/workbench/api/common/extHostProtocol';
import { IGlSceneService, ISceneInteractionService } from '@/gm/code/common/graphic/glScene';

export class ExtHostGraphicLibrary extends Disposable implements IExtHostGraphicLibrary {
  private _glInteraction: ISceneInteractionService;
  constructor(@IGlSceneService private readonly glSceneService: IGlSceneService) {
    super();
  }

  public zoomIn(): void {
    return this.glSceneService.interaction.zoomIn();
  }
  public zoomOut(): void {
    return this.glSceneService.interaction.zoomOut();
  }

  public serviceBrand = IExtHostGraphicLibrary;
}
