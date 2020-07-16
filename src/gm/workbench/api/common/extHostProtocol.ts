import { createDecorator } from '@/gm/platform/instantiation/common/instantiation';

export interface IExtHostGraphicLibrary {
  zoomIn(): void;
  zoomOut(): void;
}

export const IExtHostGraphicLibrary = createDecorator<IExtHostGraphicLibrary>(
  'extHostGraphicLibrary'
);
