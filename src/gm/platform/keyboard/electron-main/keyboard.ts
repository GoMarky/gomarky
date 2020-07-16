import { Disposable } from '@/gm/base/common/lifecycle';
import { app, BrowserWindow } from 'electron';

import {
  EventTrigger,
  IKeybindingItem,
  IKeyboardService,
  IKeyCodeItem,
} from '@/gm/platform/keyboard/common/keyboard';

import isAccelerator from 'electron-is-accelerator';
import equals from 'keyboardevents-areequal';

import { toKeyEvent } from 'keyboardevent-from-electron-accelerator';
import { FunctionLike } from '@/gm/base/common/types';
import { capitalize } from '@/gm/base/common/string';

export class KeyboardServiceError extends Error {
  public readonly name = 'KeyboardServiceError';
}

interface IKeyboardStamp {
  metaKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  code: string;
  key: string;

  trigger?: EventTrigger;
}

interface IKeyboardShortcut {
  eventStamp: IKeyboardStamp;
  callback: FunctionLike;
  autoRepeat?: boolean;
  enabled: boolean;
  accelerator: string;
}

export class KeyboardService extends Disposable implements IKeyboardService {
  private readonly _windowsWithShortcuts: WeakMap<
    Electron.WebContents,
    IKeyboardShortcut[]
  > = new WeakMap();

  private readonly _windowsWithKeycodes: WeakMap<
    Electron.WebContents,
    IKeyboardShortcut[]
  > = new WeakMap();

  private static ANY_WINDOW: any = {};
  private static ANY_KEY_WINDOW: any = {};
  private static MetaKeys: string[] = ['alt', 'shift', 'meta'];

  constructor() {
    super();
  }

  public registerKeyCode(
    keyCode: IKeyCodeItem,
    callback: FunctionLike,
    win?: Electron.BrowserWindow
  ): void {
    let webContents: Electron.WebContents = KeyboardService.ANY_KEY_WINDOW as any;

    if (typeof callback === 'undefined') {
      throw new KeyboardServiceError(`Callback for ${keyCode.accelerator} is not provided`);
    }

    if (win) {
      webContents = win.webContents;
    }

    let keycodesOfWindow: IKeyboardShortcut[] | undefined = [];

    if (this._windowsWithKeycodes.has(webContents)) {
      keycodesOfWindow = this._windowsWithKeycodes.get(webContents);
    } else {
      keycodesOfWindow = [];
      this._windowsWithKeycodes.set(webContents, keycodesOfWindow);

      if (webContents === KeyboardService.ANY_KEY_WINDOW) {
        const keyHandler = this.onBeforeInputKeyCode(keycodesOfWindow);
        const enableAppShortcuts = (_: unknown, win: Electron.BrowserWindow) => {
          const wc = win.webContents;
          wc.on('before-input-event' as any, keyHandler);
          wc.once('closed' as any, () =>
            wc.removeListener('before-input-event' as any, keyHandler)
          );
        };

        const windows = BrowserWindow.getAllWindows();
        windows.forEach(win => enableAppShortcuts(null, win));
        app.on('browser-window-created', enableAppShortcuts);

        (keycodesOfWindow as any).removeListener = () => {
          const windows = BrowserWindow.getAllWindows();
          windows.forEach(win =>
            win.webContents.removeListener('before-input-event' as any, keyHandler)
          );
          app.removeListener('browser-window-created', enableAppShortcuts);
        };
      } else {
        const keyHandler = this.onBeforeInputKeyCode(keycodesOfWindow as any);
        webContents.on('before-input-event' as any, keyHandler);

        (keycodesOfWindow as any).removeListener = () => {
          webContents.removeListener('before-input-event' as any, keyHandler);
          webContents.once('closed' as any, (keycodesOfWindow as any).removeListener);
        };
      }
    }

    keycodesOfWindow?.push({
      eventStamp: {
        key: keyCode.accelerator.toLowerCase(),
        code: capitalize(keyCode.accelerator),
        trigger: keyCode.trigger,
      },
      callback,
      enabled: true,
      accelerator: keyCode.accelerator,
      autoRepeat: keyCode.autoRepeat,
    });
  }

  public registerShortcut(
    shortcutItem: IKeybindingItem,
    callback: FunctionLike,
    win?: Electron.BrowserWindow
  ): void {
    let webContents: Electron.WebContents = KeyboardService.ANY_WINDOW as any;

    if (typeof callback === 'undefined') {
      throw new KeyboardServiceError(`Callback for ${shortcutItem.accelerator} is not provided`);
    }

    if (win) {
      webContents = win.webContents;
    }

    this.checkAccelerator(shortcutItem.accelerator);

    let shortcutsOfWindow: any;

    if (this._windowsWithShortcuts.has(webContents)) {
      shortcutsOfWindow = this._windowsWithShortcuts.get(webContents);
    } else {
      shortcutsOfWindow = [];
      this._windowsWithShortcuts.set(webContents, shortcutsOfWindow);

      if (webContents === KeyboardService.ANY_WINDOW) {
        const keyHandler = this.onBeforeInputShortcut(shortcutsOfWindow);
        const enableAppShortcuts = (_: unknown, win: Electron.BrowserWindow) => {
          const wc = win.webContents;
          wc.on('before-input-event' as any, keyHandler);
          wc.once('closed' as any, () =>
            wc.removeListener('before-input-event' as any, keyHandler)
          );
        };

        const windows = BrowserWindow.getAllWindows();
        windows.forEach(win => enableAppShortcuts(null, win));
        app.on('browser-window-created', enableAppShortcuts);

        shortcutsOfWindow.removeListener = () => {
          const windows = BrowserWindow.getAllWindows();
          windows.forEach(win =>
            win.webContents.removeListener('before-input-event' as any, keyHandler)
          );
          app.removeListener('browser-window-created', enableAppShortcuts);
        };
      } else {
        const keyHandler = this.onBeforeInputShortcut(shortcutsOfWindow);
        webContents.on('before-input-event' as any, keyHandler);

        shortcutsOfWindow.removeListener = () => {
          webContents.removeListener('before-input-event' as any, keyHandler);
          webContents.once('closed' as any, shortcutsOfWindow.removeListener);
        };
      }
    }

    const eventStamp = toKeyEvent(shortcutItem.accelerator);

    shortcutsOfWindow.push({
      eventStamp,
      callback,
      enabled: true,
      accelerator: shortcutItem.accelerator,
      autoRepeat: shortcutItem.autoRepeat,
    });
  }

  public unregisterShortcut(win: Electron.BrowserWindow, accelerator: string): void {
    let webContents;

    if (typeof accelerator === 'undefined') {
      webContents = KeyboardService.ANY_WINDOW;
    } else {
      if (win.isDestroyed()) {
        return;
      }

      webContents = win.webContents;
    }

    this.checkAccelerator(accelerator);

    if (!this._windowsWithShortcuts.has(webContents)) {
      return;
    }

    const shortcutsOfWindow = this._windowsWithShortcuts.get(webContents);

    const eventStamp = toKeyEvent(accelerator);
    const shortcutIdx = this.findShortcut(eventStamp, shortcutsOfWindow);

    if (shortcutIdx === -1) {
      return;
    }

    if (shortcutsOfWindow) {
      shortcutsOfWindow.splice(shortcutIdx, 1);
    }

    if (shortcutsOfWindow?.length === 0) {
      (shortcutsOfWindow as any).removeListener();
      this._windowsWithShortcuts.delete(webContents);
    }
  }

  public isRegistered(win: Electron.BrowserWindow, accelerator: string) {
    this.checkAccelerator(accelerator);

    const wc = win.webContents;
    const shortcutsOfWindow = this._windowsWithShortcuts.get(wc);
    const eventStamp = toKeyEvent(accelerator);

    return this.findShortcut(eventStamp, shortcutsOfWindow) !== -1;
  }

  public unregisterAll(win: Electron.BrowserWindow) {
    console.warn(`Unregistering all shortcuts on window ${this.title(win)}`);
    const wc = win.webContents;

    const shortcutsOfWindow = this._windowsWithShortcuts.get(wc);
    const keycodesOfWindow = this._windowsWithKeycodes.get(wc);

    if (keycodesOfWindow && (keycodesOfWindow as any).removeListener) {
      (keycodesOfWindow as any).removeListener();
      this._windowsWithKeycodes.delete(wc);
    }

    if (shortcutsOfWindow && (shortcutsOfWindow as any).removeListener) {
      (shortcutsOfWindow as any).removeListener();
      this._windowsWithShortcuts.delete(wc);
    }
  }

  public enableAll(win: Electron.BrowserWindow) {
    console.log(`Enabling all shortcuts on window ${this.title(win)}`);
    const wc = win.webContents;
    const shortcutsOfWindow = this._windowsWithShortcuts.get(wc);

    if (shortcutsOfWindow) {
      for (const shortcut of shortcutsOfWindow) {
        shortcut.enabled = true;
      }
    }
  }

  public disableAll(win: Electron.BrowserWindow) {
    console.log(`Disabling all shortcuts on window ${this.title(win)}`);
    const wc = win.webContents;
    const shortcutsOfWindow = this._windowsWithShortcuts.get(wc);

    if (shortcutsOfWindow) {
      for (const shortcut of shortcutsOfWindow) {
        shortcut.enabled = false;
      }
    }
  }

  private title(win: Electron.BrowserWindow) {
    if (win) {
      try {
        return win.getTitle();
      } catch (error) {
        return 'A destroyed window';
      }
    }

    return 'An falsy value';
  }

  private onBeforeInputKeyCode = (keyCodesOfWindow: IKeyboardShortcut[]) => (
    _: unknown,
    input: Electron.Input
  ) => {
    for (const { eventStamp, callback, autoRepeat } of keyCodesOfWindow) {
      if (
        (input.code === eventStamp.code || input.key === eventStamp.code) &&
        eventStamp.trigger === input.type
      ) {
        if (typeof autoRepeat === 'boolean' && autoRepeat === input.isAutoRepeat) {
          callback();
        } else if (typeof autoRepeat === 'undefined') {
          callback();
        }
      }
    }
  };

  private onBeforeInputShortcut = (shortcutsOfWindow: IKeyboardShortcut[]) => (
    _: unknown,
    input: Electron.Input
  ) => {
    if (input.type === 'keyUp') {
      return;
    }

    const event = this.normalizeEvent(input);

    for (const { eventStamp, callback, autoRepeat } of shortcutsOfWindow) {
      if (equals(eventStamp, event)) {
        if (typeof autoRepeat === 'boolean' && autoRepeat === input.isAutoRepeat) {
          callback();
        } else if (typeof autoRepeat === 'undefined') {
          callback();
        }
      }
    }
  };

  private normalizeEvent(input: any) {
    const normalizedEvent: any = {
      code: input.code,
      key: input.key,
    };

    KeyboardService.MetaKeys.forEach(prop => {
      if (typeof input[prop] !== 'undefined') {
        normalizedEvent[`${prop}Key`] = input[prop];
      }
    });

    if (typeof input.control !== 'undefined') {
      normalizedEvent.ctrlKey = input.control;
    }

    return normalizedEvent;
  }

  private findShortcut(event: any, shortcutsOfWindow: any): number {
    let i = 0;

    for (const shortcut of shortcutsOfWindow) {
      if (equals(shortcut.eventStamp, event)) {
        return i;
      }

      i++;
    }

    return -1;
  }

  private checkAccelerator(accelerator: string) {
    if (!isAccelerator(accelerator)) {
      const w: Error = { name: '', message: '' };
      Error.captureStackTrace(w);
      const stack = w.stack
        ? w.stack
            .split('\n')
            .slice(4)
            .join('\n')
        : w.message;
      const msg = `WARNING: ${accelerator} is not a valid accelerator.${stack}`;
      console.error(msg);
    }
  }
}

export const KeyboardRegistry = new KeyboardService();
