import { Emitter, Event } from '@/gm/base/common/event';
import { CancellationTokenSource } from '@/gm/base/common/cancellation';
import { canceled } from '@/gm/base/common/errors';

import { IDisposable } from '@/gm/base/common/lifecycle';

export interface CancellationToken {
  readonly isCancellationRequested: boolean;
  readonly onCancellationRequested: Event<any>;
}

export class Delayer<T> implements IDisposable {
  private timeout: any;
  private completionPromise: Promise<any> | null;
  private doResolve: ((value?: any | Promise<any>) => void) | null;
  private doReject: ((err: any) => void) | null;
  private task: ITask<T | Promise<T>> | null;

  constructor(public defaultDelay: number) {
    this.timeout = null;
    this.completionPromise = null;
    this.doResolve = null;
    this.doReject = null;
    this.task = null;
  }

  public trigger(task: ITask<T | Promise<T>>, delay: number = this.defaultDelay): Promise<T> {
    this.task = task;
    this.cancelTimeout();

    if (!this.completionPromise) {
      this.completionPromise = new Promise((c, e) => {
        this.doResolve = c;
        this.doReject = e;
      }).then(() => {
        this.completionPromise = null;
        this.doResolve = null;
        if (this.task) {
          const task = this.task;
          this.task = null;

          return task();
        }

        return undefined;
      });
    }

    this.timeout = setTimeout(() => {
      this.timeout = null;
      if (this.doResolve) {
        this.doResolve(null);
      }
    }, delay);

    return this.completionPromise;
  }

  public isTriggered(): boolean {
    return this.timeout !== null;
  }

  public cancel(): void {
    this.cancelTimeout();

    if (this.completionPromise) {
      if (this.doReject) {
        this.doReject(canceled());
      }
      this.completionPromise = null;
    }
  }

  private cancelTimeout(): void {
    if (this.timeout !== null) {
      clearTimeout(this.timeout);
      this.timeout = null;
    }
  }

  public dispose(): void {
    this.cancelTimeout();
  }
}

export class Throttler {
  private activePromise: Promise<any> | null;
  private queuedPromise: Promise<any> | null;
  private queuedPromiseFactory: ITask<Promise<any>> | null;

  constructor() {
    this.activePromise = null;
    this.queuedPromise = null;
    this.queuedPromiseFactory = null;
  }

  public queue<T>(promiseFactory: ITask<Promise<T>>): Promise<T> {
    if (this.activePromise) {
      this.queuedPromiseFactory = promiseFactory;

      if (!this.queuedPromise) {
        const onComplete = () => {
          this.queuedPromise = null;

          const result = this.queue(this.queuedPromiseFactory!);
          this.queuedPromiseFactory = null;

          return result;
        };

        this.queuedPromise = new Promise(c => {
          this.activePromise!.then(onComplete, onComplete).then(c);
        });
      }

      return new Promise((c, e) => {
        this.queuedPromise!.then(c, e);
      });
    }

    this.activePromise = promiseFactory();

    return new Promise((c, e) => {
      this.activePromise!.then(
        (result: any) => {
          this.activePromise = null;
          c(result);
        },
        (err: any) => {
          this.activePromise = null;
          e(err);
        }
      );
    });
  }
}

export class ThrottledDelayer<T> {
  private delayer: Delayer<Promise<T>>;
  private throttler: Throttler;

  constructor(defaultDelay: number) {
    this.delayer = new Delayer(defaultDelay);
    this.throttler = new Throttler();
  }

  public trigger(promiseFactory: ITask<Promise<T>>, delay?: number): Promise<T> {
    return (this.delayer.trigger(
      () => this.throttler.queue(promiseFactory),
      delay
    ) as any) as Promise<T>;
  }

  public isTriggered(): boolean {
    return this.delayer.isTriggered();
  }

  public cancel(): void {
    this.delayer.cancel();
  }

  public dispose(): void {
    this.delayer.dispose();
  }
}

export interface ITask<T> {
  (): T;
}

export interface CancelablePromise<T> extends Promise<T> {
  cancel(): void;
}

export function isThenable<T>(obj: any): obj is Promise<T> {
  return obj && typeof (<Promise<any>>obj).then === 'function';
}

export function createCancelablePromise<T>(
  callback: (token: CancellationToken) => Promise<T>
): CancelablePromise<T> {
  const source = new CancellationTokenSource();

  const thenable = callback(source.token);
  const promise = new Promise<T>((resolve, reject) => {
    source.token.onCancellationRequested(() => {
      reject(canceled());
    });
    Promise.resolve(thenable).then(
      value => {
        source.dispose();
        resolve(value);
      },
      err => {
        source.dispose();
        reject(err);
      }
    );
  });

  return <CancelablePromise<T>>new (class {
    public cancel() {
      source.cancel();
    }
    public then<
      TResult1 = T,
      TResult2 = never
    >(resolve?: ((value: T) => TResult1 | Promise<TResult1>) | undefined | null, reject?: ((reason: any) => TResult2 | Promise<TResult2>) | undefined | null): Promise<TResult1 | TResult2> {
      return promise.then(resolve, reject);
    }
    public catch<
      TResult = never
    >(reject?: ((reason: any) => TResult | Promise<TResult>) | undefined | null): Promise<T | TResult> {
      return this.then(undefined, reject);
    }
    public finally(onfinally?: (() => void) | undefined | null): Promise<T> {
      return promise.finally(onfinally);
    }
  })();
}

interface Thenable<T> {
  then<TResult>(
    onfulfilled?: (value: T) => TResult | Thenable<TResult>,
    onrejected?: (reason: any) => TResult | Thenable<TResult> | void
  ): Thenable<TResult>;
}

export function raceCancellation<T>(
  promise: Promise<T>,
  token: CancellationToken
): Promise<T | undefined>;
export function raceCancellation<T>(
  promise: Promise<T>,
  token: CancellationToken,
  defaultValue: T
): Promise<T>;
export function raceCancellation<T>(
  promise: Promise<T>,
  token: CancellationToken,
  defaultValue?: T
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>(resolve => token.onCancellationRequested(() => resolve(defaultValue))),
  ]);
}

export function asPromise<T>(callback: () => T | Thenable<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const item = callback();
    if (isThenable<T>(item)) {
      item.then(resolve, reject);
    } else {
      // eslint-disable-next-line @typescript-eslint/ban-ts-ignore
      // @ts-ignore
      resolve(item);
    }
  });
}

interface ILimitedTaskFactory<T> {
  factory: ITask<Promise<T>>;
  c: (value?: T | Promise<T>) => void;
  e: (error?: any) => void;
}

export class Barrier {
  private _isOpen: boolean;
  private readonly _promise: Promise<boolean>;
  private _completePromise: (v: boolean) => void;

  constructor() {
    this._isOpen = false;
    this._promise = new Promise<boolean>(c => {
      this._completePromise = c;
    });
  }

  public isOpen(): boolean {
    return this._isOpen;
  }

  public open(): void {
    this._isOpen = true;
    this._completePromise(true);
  }

  public wait(): Promise<boolean> {
    return this._promise;
  }
}

export class Limiter<T> {
  private _size = 0;
  private runningPromises: number;
  private maxDegreeOfParalellism: number;
  private outstandingPromises: ILimitedTaskFactory<T>[];
  private readonly _onFinished: Emitter<void>;

  constructor(maxDegreeOfParalellism: number) {
    this.maxDegreeOfParalellism = maxDegreeOfParalellism;
    this.outstandingPromises = [];
    this.runningPromises = 0;
    this._onFinished = new Emitter<void>();
  }

  public get onFinished(): Event<void> {
    return this._onFinished.event;
  }

  public get size(): number {
    return this._size;
  }

  public queue(factory: ITask<Promise<T>>): Promise<T> {
    this._size++;

    return new Promise<T>((c, e) => {
      this.outstandingPromises.push({ factory, c, e });
      this.consume();
    });
  }

  private consume(): void {
    while (this.outstandingPromises.length && this.runningPromises < this.maxDegreeOfParalellism) {
      const iLimitedTask = this.outstandingPromises.shift()!;
      this.runningPromises++;

      const promise = iLimitedTask.factory();
      promise.then(iLimitedTask.c, iLimitedTask.e);
      promise.then(
        () => this.consumed(),
        () => this.consumed()
      );
    }
  }

  private consumed(): void {
    this._size--;
    this.runningPromises--;

    if (this.outstandingPromises.length > 0) {
      this.consume();
    } else {
      this._onFinished.fire();
    }
  }

  dispose(): void {
    this._onFinished.dispose();
  }
}

export class Queue<T> extends Limiter<T> {
  constructor() {
    super(1);
  }
}

export function timeout(millis: number): CancelablePromise<void>;
export function timeout(millis: number, token: CancellationToken): Promise<void>;
export function timeout(
  millis: number,
  token?: CancellationToken
): CancelablePromise<void> | Promise<void> {
  if (!token) {
    return createCancelablePromise(token => timeout(millis, token));
  }

  return new Promise((resolve, reject) => {
    const handle = setTimeout(resolve, millis);
    token.onCancellationRequested(() => {
      clearTimeout(handle);
      reject(canceled());
    });
  });
}

export class RunOnceScheduler {
  protected runner: ((...args: any[]) => void) | null;

  private timeoutToken: any;
  private timeout: number;
  private readonly timeoutHandler: () => void;

  constructor(runner: (...args: any[]) => void, timeout: number) {
    this.timeoutToken = -1;
    this.runner = runner;
    this.timeout = timeout;
    this.timeoutHandler = this.onTimeout.bind(this);
  }

  /**
   * Dispose RunOnceScheduler
   */
  public dispose(): void {
    this.cancel();
    this.runner = null;
  }

  /**
   * Cancel current scheduled runner (if any).
   */
  public cancel(): void {
    if (this.isScheduled()) {
      clearTimeout(this.timeoutToken);
      this.timeoutToken = -1;
    }
  }

  /**
   * Cancel previous runner (if any) & schedule a new runner.
   */
  public schedule(delay = this.timeout): void {
    this.cancel();
    this.timeoutToken = setTimeout(this.timeoutHandler, delay);
  }

  /**
   * Returns true if scheduled.
   */
  public isScheduled(): boolean {
    return this.timeoutToken !== -1;
  }

  private onTimeout() {
    this.timeoutToken = -1;

    if (this.runner) {
      this.doRun();
    }
  }

  protected doRun(): void {
    if (this.runner) {
      this.runner();
    }
  }
}

export async function retry<T>(
  task: ITask<Promise<T>>,
  delay: number,
  retries: number
): Promise<T> {
  let lastError: Error | undefined;

  for (let i = 0; i < retries; i++) {
    try {
      return await task();
    } catch (error) {
      lastError = error;

      await timeout(delay);
    }
  }

  throw lastError;
}

export interface IdleDeadline {
  readonly didTimeout: boolean;
  timeRemaining(): number;
}

/**
 * Execute the callback the next time the browser is idle
 */
export let runWhenIdle: (callback: (idle: IdleDeadline) => void, timeout?: number) => IDisposable;

declare function requestIdleCallback(
  callback: (args: IdleDeadline) => void,
  options?: { timeout: number }
): number;
declare function cancelIdleCallback(handle: number): void;

(function() {
  if (typeof requestIdleCallback !== 'function' || typeof cancelIdleCallback !== 'function') {
    const dummyIdle: IdleDeadline = Object.freeze({
      didTimeout: true,
      timeRemaining() {
        return 15;
      },
    });
    runWhenIdle = runner => {
      const handle = setTimeout(() => runner(dummyIdle));
      let disposed = false;
      return {
        dispose() {
          if (disposed) {
            return;
          }
          disposed = true;
          clearTimeout(handle);
        },
      };
    };
  } else {
    runWhenIdle = (runner, timeout?) => {
      const handle: number = requestIdleCallback(
        runner,
        typeof timeout === 'number' ? { timeout } : undefined
      );
      let disposed = false;
      return {
        dispose() {
          if (disposed) {
            return;
          }
          disposed = true;
          cancelIdleCallback(handle);
        },
      };
    };
  }
})();
