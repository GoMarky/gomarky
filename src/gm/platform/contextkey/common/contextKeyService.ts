import {
  IContext,
  IContextKey,
  IContextKeyChangeEvent,
  IContextKeyService,
  IContextKeyServiceTarget,
  IReadableSet,
} from '@/gm/platform/contextkey/common/contextkey';

import { DisposableStore, IDisposable } from '@/gm/base/common/lifecycle';
import { Event, PauseableEmitter } from '@/gm/base/common/event';
import { FunctionLike } from '@/gm/base/common/types';

const KEYBINDING_CONTEXT_ATTR = 'data-keybinding-context';

export class Context implements IContext {
  protected _parent: Context | null;
  protected _value: { [key: string]: any };
  protected _id: number;

  constructor(id: number, parent: Context | null) {
    this._id = id;
    this._parent = parent;
    this._value = Object.create(null);
    this._value._contextId = id;
  }

  public setValue(key: string, value: any): boolean {
    if (this._value[key] !== value) {
      this._value[key] = value;

      return true;
    }

    return false;
  }

  public removeValue(key: string): boolean {
    if (key in this._value) {
      delete this._value[key];

      return true;
    }

    return false;
  }

  public getValue<T>(key: string): T | undefined {
    const ret = this._value[key];
    if (typeof ret === 'undefined' && this._parent) {
      return this._parent.getValue<T>(key);
    }

    return ret;
  }

  collectAllValues(): { [key: string]: any } {
    let result = this._parent ? this._parent.collectAllValues() : Object.create(null);
    result = { ...result, ...this._value };
    delete result._contextId;

    return result;
  }
}

class NullContext extends Context {
  static readonly INSTANCE = new NullContext();

  constructor() {
    super(-1, null);
  }

  public setValue(_key: string, _value: any): boolean {
    return false;
  }

  public removeValue(_key: string): boolean {
    return false;
  }

  public getValue<T>(_key: string): T | undefined {
    return undefined;
  }

  collectAllValues(): { [key: string]: any } {
    return Object.create(null);
  }
}

class ConfigAwareContextValuesContainer extends Context {
  private static _keyPrefix = 'config.';

  private readonly _values = new Map<string, any>();
  private readonly _listener: IDisposable;

  constructor(id: number) {
    super(id, null);
  }

  dispose(): void {
    this._listener.dispose();
  }

  getValue(key: string): any {
    if (key.indexOf(ConfigAwareContextValuesContainer._keyPrefix) !== 0) {
      return super.getValue(key);
    }

    return this._values.get(key);
  }

  setValue(key: string, value: any): boolean {
    return super.setValue(key, value);
  }

  removeValue(key: string): boolean {
    return super.removeValue(key);
  }

  collectAllValues(): { [key: string]: any } {
    const result: { [key: string]: any } = Object.create(null);
    this._values.forEach((value, index) => (result[index] = value));

    return { ...result, ...super.collectAllValues() };
  }
}

class ContextKey<T> implements IContextKey<T> {
  private _service: AbstractContextKeyService;
  private _key: string;
  private _defaultValue: T | undefined;

  constructor(service: AbstractContextKeyService, key: string, defaultValue: T | undefined) {
    this._service = service;
    this._key = key;
    this._defaultValue = defaultValue;
    this.reset();
  }

  public set(value: T): void {
    this._service.setContext(this._key, value);
  }

  public reset(): void {
    if (typeof this._defaultValue === 'undefined') {
      this._service.removeContext(this._key);
    } else {
      this._service.setContext(this._key, this._defaultValue);
    }
  }

  public get(): T | undefined {
    return this._service.getContextKeyValue<T>(this._key);
  }
}

class SimpleContextKeyChangeEvent implements IContextKeyChangeEvent {
  constructor(readonly key: string) {}

  affectsSome(keys: IReadableSet<string>): boolean {
    return keys.has(this.key);
  }
}

class ArrayContextKeyChangeEvent implements IContextKeyChangeEvent {
  constructor(readonly keys: string[]) {}

  affectsSome(keys: IReadableSet<string>): boolean {
    for (const key of this.keys) {
      if (keys.has(key)) {
        return true;
      }
    }

    return false;
  }
}

class CompositeContextKeyChangeEvent implements IContextKeyChangeEvent {
  constructor(readonly events: IContextKeyChangeEvent[]) {}

  affectsSome(keys: IReadableSet<string>): boolean {
    for (const e of this.events) {
      if (e.affectsSome(keys)) {
        return true;
      }
    }

    return false;
  }
}

export abstract class AbstractContextKeyService implements IContextKeyService {
  protected _isDisposed: boolean;
  protected _onDidChangeContext = new PauseableEmitter<IContextKeyChangeEvent>({
    merge: input => new CompositeContextKeyChangeEvent(input),
  });
  protected _myContextId: number;

  constructor(myContextId: number) {
    this._isDisposed = false;
    this._myContextId = myContextId;
  }

  abstract dispose(): void;

  public createKey<T>(key: string, defaultValue: T | undefined): IContextKey<T> {
    if (this._isDisposed) {
      throw new Error('AbstractContextKeyService has been disposed');
    }

    return new ContextKey(this, key, defaultValue);
  }

  public get onDidChangeContext(): Event<IContextKeyChangeEvent> {
    return this._onDidChangeContext.event;
  }

  public bufferChangeEvents(callback: FunctionLike): void {
    this._onDidChangeContext.pause();
    try {
      callback();
    } finally {
      this._onDidChangeContext.resume();
    }
  }

  public createScoped(domNode: IContextKeyServiceTarget): IContextKeyService {
    if (this._isDisposed) {
      throw new Error('AbstractContextKeyService has been disposed');
    }

    return new ScopedContextKeyService(this, domNode);
  }

  public getContextKeyValue<T>(key: string): T | undefined {
    if (this._isDisposed) {
      return undefined;
    }

    return this.getContextValuesContainer(this._myContextId).getValue<T>(key);
  }

  public setContext(key: string, value: any): void {
    if (this._isDisposed) {
      return;
    }
    const myContext = this.getContextValuesContainer(this._myContextId);
    if (!myContext) {
      return;
    }
    if (myContext.setValue(key, value)) {
      this._onDidChangeContext.fire(new SimpleContextKeyChangeEvent(key));
    }
  }

  public removeContext(key: string): void {
    if (this._isDisposed) {
      return;
    }
    if (this.getContextValuesContainer(this._myContextId).removeValue(key)) {
      this._onDidChangeContext.fire(new SimpleContextKeyChangeEvent(key));
    }
  }

  public getContext(target: IContextKeyServiceTarget | null): IContext {
    if (this._isDisposed) {
      return NullContext.INSTANCE;
    }

    return this.getContextValuesContainer(findContextAttr(target));
  }

  public abstract getContextValuesContainer(contextId: number): Context;

  public abstract createChildContext(parentContextId?: number): number;

  public abstract disposeContext(contextId: number): void;
}

export class ContextKeyService extends AbstractContextKeyService implements IContextKeyService {
  public readonly serviceBrand = IContextKeyService;

  private _lastContextId: number;
  private readonly _contexts = new Map<number, Context>();

  private readonly _toDispose = new DisposableStore();

  constructor() {
    super(0);
    this._lastContextId = 0;

    const myContext = new ConfigAwareContextValuesContainer(this._myContextId);
    this._contexts.set(this._myContextId, myContext);
    this._toDispose.add(myContext);
  }

  public dispose(): void {
    this._isDisposed = true;
    this._toDispose.dispose();
  }

  public getContextValuesContainer(contextId: number): Context {
    if (this._isDisposed) {
      return NullContext.INSTANCE;
    }

    return this._contexts.get(contextId) || NullContext.INSTANCE;
  }

  public createChildContext(parentContextId: number = this._myContextId): number {
    if (this._isDisposed) {
      throw new Error('ContextKeyService has been disposed');
    }
    const id = ++this._lastContextId;
    this._contexts.set(id, new Context(id, this.getContextValuesContainer(parentContextId)));

    return id;
  }

  public disposeContext(contextId: number): void {
    if (!this._isDisposed) {
      this._contexts.delete(contextId);
    }
  }
}

class ScopedContextKeyService extends AbstractContextKeyService {
  private _parent: AbstractContextKeyService;
  private _domNode: IContextKeyServiceTarget | undefined;

  constructor(parent: AbstractContextKeyService, domNode?: IContextKeyServiceTarget) {
    super(parent.createChildContext());
    this._parent = parent;

    if (domNode) {
      this._domNode = domNode;
      this._domNode.setAttribute(KEYBINDING_CONTEXT_ATTR, String(this._myContextId));
    }
  }

  public dispose(): void {
    this._isDisposed = true;
    this._parent.disposeContext(this._myContextId);
    if (this._domNode) {
      this._domNode.removeAttribute(KEYBINDING_CONTEXT_ATTR);
      this._domNode = undefined;
    }
  }

  public get onDidChangeContext(): Event<IContextKeyChangeEvent> {
    return Event.any(this._parent.onDidChangeContext, this._onDidChangeContext.event);
  }

  public getContextValuesContainer(contextId: number): Context {
    if (this._isDisposed) {
      return NullContext.INSTANCE;
    }

    return this._parent.getContextValuesContainer(contextId);
  }

  public createChildContext(parentContextId: number = this._myContextId): number {
    if (this._isDisposed) {
      throw new Error('ScopedContextKeyService has been disposed');
    }

    return this._parent.createChildContext(parentContextId);
  }

  public disposeContext(contextId: number): void {
    if (this._isDisposed) {
      return;
    }
    this._parent.disposeContext(contextId);
  }
}

function findContextAttr(domNode: IContextKeyServiceTarget | null): number {
  while (domNode) {
    if (domNode.hasAttribute(KEYBINDING_CONTEXT_ATTR)) {
      const attr = domNode.getAttribute(KEYBINDING_CONTEXT_ATTR);
      if (attr) {
        return parseInt(attr, 10);
      }

      return NaN;
    }
    domNode = domNode.parentElement;
  }

  return 0;
}
