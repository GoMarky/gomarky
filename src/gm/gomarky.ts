declare module 'gomarky' {
  export type FunctionLike = (...args: any[]) => any;

  export interface IDisposable {
    dispose(): void;
  }

  /**
   * Represents a type which can release resources, such
   * as event listening or a timer.
   */
  export class Disposable {
    /**
     * Combine many disposable-likes into one. Use this method
     * when having objects with a dispose function which are not
     * instances of Disposable.
     *
     * @param disposableLikes Objects that have at least a `dispose`-function member.
     * @return Returns a new disposable which, upon dispose, will
     * dispose all provided disposables.
     */
    static from(...disposableLikes: { dispose: () => any }[]): Disposable;

    /**
     * Creates a new Disposable calling the provided function
     * on dispose.
     * @param callOnDispose Function that disposes something.
     */
    constructor(callOnDispose: Function);

    /**
     * Dispose this object.
     */
    dispose(): any;
  }

  export interface Event<T> {
    /**
     * A function that represents an event to which you subscribe by calling it with
     * a listener function as argument.
     *
     * @param listener The listener function will be called when the event happens.
     * @param thisArgs The `this`-argument which will be used when calling the event listener.
     * @param disposables An array to which a [disposable](#Disposable) will be added.
     * @return A disposable which unsubscribes the event listener.
     */
    (listener: (e: T) => any, thisArgs?: any, disposables?: Disposable[]): Disposable;
  }

  interface IServiceIdentifier<T> {
    (...args: any[]): void;

    type: T;
  }

  interface IServicesAccessor {
    get<T>(id: IServiceIdentifier<T>): T;
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-interface
  export interface IExtensionContext {}

  /**
   * Represents the state of a window.
   */
  export interface WindowState {
    /**
     * Whether the current window is focused.
     */
    readonly focused: boolean;
  }

  export namespace window {
    export const state: WindowState;

    export const onDidWindowFocus: Event<number>;

    export function toggleFullScreen(): Promise<void>;
    export function maximize(): Promise<void>;
  }

  export type ICommandFuncBody = (...args: any[]) => ICommandExecuteBody;

  export interface ICommandExecuteBody {
    execute: FunctionLike;
    undo?: FunctionLike;
  }

  export namespace commands {
    export function executeCommand<T>(command: string, ...args: any[]): Promise<T | void>;

    export function registerCommand(command: string, method?: ICommandFuncBody): IDisposable;
  }

  export namespace scene {
    export function zoomIn(): void;
    export function zoomOut(): void;
  }

  export namespace session {}

  export namespace workspace {}

  export namespace env {}
}
