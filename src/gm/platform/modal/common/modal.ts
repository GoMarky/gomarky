import { createDecorator } from '@/gm/platform/instantiation/common/instantiation';
import { ModalViewName } from '@/gm/platform/store/electron-browser/modal';

export const IModalService = createDecorator<IModalService>('modalService');

export interface IModalService {
  show(componentName: ModalViewName): void;
  hide(): void;
}
