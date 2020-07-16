declare module 'keyboardevent-from-electron-accelerator' {
  interface IKeyEvent {
    metaKey?: boolean;
    shiftKey?: boolean;
    altKey?: boolean;
    key: string;
    code?: string;
  }

  function toKeyEvent(...args: any): IKeyEvent;
}
