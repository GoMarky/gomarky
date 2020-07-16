import { createDecorator } from '@/gm/platform/instantiation/common/instantiation';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface ITelemetryService {}

export const ITelemetryService = createDecorator<ITelemetryService>('telemetryService');
