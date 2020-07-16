import { CodeWindow } from '@/gm/platform/window/electron-main/window';

export function getLastActiveWindow(windows: CodeWindow[]): CodeWindow | undefined {
  // eslint-disable-next-line prefer-spread
  const lastFocusedDate = Math.max.apply(
    Math,
    windows.map(window => window.lastFocusTime)
  );

  return windows.filter(window => window.lastFocusTime === lastFocusedDate)[0];
}
