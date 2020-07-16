import { URI } from '@/gm/base/common/uri';
import { FIN } from '@/gm/base/common/iterator';
import { CharCode } from '@/gm/base/common/charCode';

interface Item<K, V> {
  previous: Item<K, V> | undefined;
  next: Item<K, V> | undefined;
  key: K;
  value: V;
}

export const enum Touch {
  None = 0,
  AsOld = 1,
  AsNew = 2,
}

export class LinkedMap<K, V> {
  private _map: Map<K, Item<K, V>>;
  private _head: Item<K, V> | undefined;
  private _tail: Item<K, V> | undefined;
  private _size: number;

  constructor() {
    this._map = new Map<K, Item<K, V>>();
    this._head = undefined;
    this._tail = undefined;
    this._size = 0;
  }

  public clear(): void {
    this._map.clear();
    this._head = undefined;
    this._tail = undefined;
    this._size = 0;
  }

  public isEmpty(): boolean {
    return !this._head && !this._tail;
  }

  public get size(): number {
    return this._size;
  }

  public get first(): V | undefined {
    return this._head?.value;
  }

  public get last(): V | undefined {
    return this._tail?.value;
  }

  public has(key: K): boolean {
    return this._map.has(key);
  }

  public get(key: K, touch: Touch = Touch.None): V | undefined {
    const item = this._map.get(key);

    if (!item) {
      return undefined;
    }

    if (touch !== Touch.None) {
      this.touch(item, touch);
    }

    return item.value;
  }

  public set(key: K, value: V, touch: Touch = Touch.None): void {
    let item = this._map.get(key);

    if (item) {
      item.value = value;

      if (touch !== Touch.None) {
        this.touch(item, touch);
      }
    } else {
      item = { key, value, next: undefined, previous: undefined };

      switch (touch) {
        case Touch.None:
          this.addItemLast(item);
          break;
        case Touch.AsOld:
          this.addItemFirst(item);
          break;
        case Touch.AsNew:
          this.addItemLast(item);
          break;
        default:
          this.addItemLast(item);
          break;
      }

      this._map.set(key, item);
      this._size++;
    }
  }

  public delete(key: K): boolean {
    return !!this.remove(key);
  }

  public remove(key: K): V | undefined {
    const item = this._map.get(key);

    if (!item) {
      return undefined;
    }

    this._map.delete(key);
    this.removeItem(item);
    this._size--;

    return item.value;
  }

  public shift(): V | undefined {
    if (!this._head && !this._tail) {
      return undefined;
    }

    if (!this._head || !this._tail) {
      throw new Error('Invalid list');
    }

    const item = this._head;

    this._map.delete(item.key);

    this.removeItem(item);

    this._size--;

    return item.value;
  }

  public forEach(
    callbackfn: (value: V, key: K, map: LinkedMap<K, V>) => void,
    thisArg?: any
  ): void {
    let current = this._head;

    while (current) {
      if (thisArg) {
        callbackfn.bind(thisArg)(current.value, current.key, this);
      } else {
        callbackfn(current.value, current.key, this);
      }
      current = current.next;
    }
  }

  public async forEachAsync(
    callbackfn: (value: V, key: K, map: LinkedMap<K, V>) => void,
    thisArg?: any
  ): Promise<void> {
    let current = this._head;

    while (current) {
      if (thisArg) {
        await callbackfn.bind(thisArg)(current.value, current.key, this);
      } else {
        await callbackfn(current.value, current.key, this);
      }
      current = current.next;
    }
  }

  public values(): V[] {
    const result: V[] = [];

    let current = this._head;

    while (current) {
      result.push(current.value);
      current = current.next;
    }

    return result;
  }

  public keys(): K[] {
    const result: K[] = [];

    let current = this._head;

    while (current) {
      result.push(current.key);
      current = current.next;
    }

    return result;
  }

  protected trimOld(newSize: number) {
    if (newSize >= this.size) {
      return;
    }

    if (newSize === 0) {
      this.clear();

      return;
    }

    let current = this._head;
    let currentSize = this.size;

    while (current && currentSize > newSize) {
      this._map.delete(current.key);
      current = current.next;
      currentSize--;
    }
    this._head = current;
    this._size = currentSize;

    if (current) {
      current.previous = undefined;
    }
  }

  private addItemFirst(item: Item<K, V>): void {
    if (!this._head && !this._tail) {
      this._tail = item;
    } else if (!this._head) {
      throw new Error('Invalid list');
    } else {
      item.next = this._head;
      this._head.previous = item;
    }
    this._head = item;
  }

  private addItemLast(item: Item<K, V>): void {
    if (!this._head && !this._tail) {
      this._head = item;
    } else if (!this._tail) {
      throw new Error('Invalid list');
    } else {
      item.previous = this._tail;
      this._tail.next = item;
    }
    this._tail = item;
  }

  private removeItem(item: Item<K, V>): void {
    if (item === this._head && item === this._tail) {
      this._head = undefined;
      this._tail = undefined;
      // tslint:disable-next-line:prefer-switch
    } else if (item === this._head) {
      if (!item.next) {
        throw new Error('Invalid list');
      }
      item.next.previous = undefined;
      this._head = item.next;
    } else if (item === this._tail) {
      if (!item.previous) {
        throw new Error('Invalid list');
      }
      item.previous.next = undefined;
      this._tail = item.previous;
    } else {
      const next = item.next;
      const previous = item.previous;
      if (!next || !previous) {
        throw new Error('Invalid list');
      }
      next.previous = previous;
      previous.next = next;
    }
    item.next = undefined;
    item.previous = undefined;
  }

  private touch(item: Item<K, V>, touch: Touch): void {
    if (!this._head || !this._tail) {
      throw new Error('Invalid list');
    }
    if (touch !== Touch.AsOld && touch !== Touch.AsNew) {
      return;
    }

    // tslint:disable-next-line:prefer-switch
    if (touch === Touch.AsOld) {
      if (item === this._head) {
        return;
      }

      const next = item.next;
      const previous = item.previous;

      // Unlink the item
      if (item === this._tail) {
        previous!.next = undefined;
        this._tail = previous;
      } else {
        // Both next and previous are not undefined since item was neither head nor tail.
        next!.previous = previous;
        previous!.next = next;
      }

      // Insert the node at head
      item.previous = undefined;
      item.next = this._head;
      this._head.previous = item;
      this._head = item;
    } else if (touch === Touch.AsNew) {
      if (item === this._tail) {
        return;
      }

      const next = item.next;
      const previous = item.previous;

      if (item === this._head) {
        next!.previous = undefined;
        this._head = next;
      } else {
        next!.previous = previous;
        previous!.next = next;
      }
      item.next = undefined;
      item.previous = this._tail;
      this._tail.next = item;
      this._tail = item;
    }
  }

  public toJSON(): [K, V][] {
    const data: [K, V][] = [];

    this.forEach((value, key) => {
      data.push([key, value]);
    });

    return data;
  }

  public fromJSON(data: [K, V][]): void {
    this.clear();

    for (const [key, value] of data) {
      this.set(key, value);
    }
  }
}

export class LRUCache<K, V> extends LinkedMap<K, V> {
  private _limit: number;
  private _ratio: number;

  constructor(limit: number, ratio = 1) {
    super();
    this._limit = limit;
    this._ratio = Math.min(Math.max(0, ratio), 1);
  }

  public get limit(): number {
    return this._limit;
  }

  public set limit(limit: number) {
    this._limit = limit;
    this.checkTrim();
  }

  public get ratio(): number {
    return this._ratio;
  }

  public set ratio(ratio: number) {
    this._ratio = Math.min(Math.max(0, ratio), 1);
    this.checkTrim();
  }

  public get(key: K): V | undefined {
    return super.get(key, Touch.AsNew);
  }

  public peek(key: K): V | undefined {
    return super.get(key, Touch.None);
  }

  public set(key: K, value: V): void {
    super.set(key, value, Touch.AsNew);
    this.checkTrim();
  }

  private checkTrim() {
    if (this.size > this._limit) {
      this.trimOld(Math.round(this._limit * this._ratio));
    }
  }
}

export interface IKeyIterator {
  reset(key: string): this;

  next(): this;

  hasNext(): boolean;

  cmp(a: string): number;

  value(): string;
}

export class StringIterator implements IKeyIterator {
  private _value = '';
  private _pos = 0;

  public reset(key: string): this {
    this._value = key;
    this._pos = 0;

    return this;
  }

  public next(): this {
    this._pos += 1;

    return this;
  }

  public hasNext(): boolean {
    return this._pos < this._value.length - 1;
  }

  public cmp(a: string): number {
    const aCode = a.charCodeAt(0);
    const thisCode = this._value.charCodeAt(this._pos);

    return aCode - thisCode;
  }

  public value(): string {
    return this._value[this._pos];
  }
}

export class PathIterator implements IKeyIterator {
  private _value!: string;
  private _from!: number;
  private _to!: number;

  constructor(private _splitOnBackslash: boolean = true) {}

  public reset(key: string): this {
    this._value = key.replace(/\\$|\/$/, '');
    this._from = 0;
    this._to = 0;

    return this.next();
  }

  public hasNext(): boolean {
    return this._to < this._value.length;
  }

  public next(): this {
    this._from = this._to;
    let justSeps = true;
    for (; this._to < this._value.length; this._to++) {
      const ch = this._value.charCodeAt(this._to);
      if (ch === CharCode.Slash || (this._splitOnBackslash && ch === CharCode.Backslash)) {
        if (justSeps) {
          this._from++;
        } else {
          break;
        }
      } else {
        justSeps = false;
      }
    }

    return this;
  }

  public cmp(a: string): number {
    let aPos = 0;
    const aLen = a.length;
    let thisPos = this._from;

    while (aPos < aLen && thisPos < this._to) {
      const cmp = a.charCodeAt(aPos) - this._value.charCodeAt(thisPos);
      if (cmp !== 0) {
        return cmp;
      }
      aPos += 1;
      thisPos += 1;
    }

    if (aLen === this._to - this._from) {
      return 0;
    } else if (aPos < aLen) {
      return -1;
    } else {
      return 1;
    }
  }

  public value(): string {
    return this._value.substring(this._from, this._to);
  }
}

class TernarySearchTreeNode<E> {
  segment!: string;
  value: E | undefined;
  key!: string;
  left: TernarySearchTreeNode<E> | undefined;
  mid: TernarySearchTreeNode<E> | undefined;
  right: TernarySearchTreeNode<E> | undefined;

  public isEmpty(): boolean {
    return !this.left && !this.mid && !this.right && !this.value;
  }
}

export class TernarySearchTree<E> {
  public static forPaths<E>(): TernarySearchTree<E> {
    return new TernarySearchTree<E>(new PathIterator());
  }

  public static forStrings<E>(): TernarySearchTree<E> {
    return new TernarySearchTree<E>(new StringIterator());
  }

  private _iter: IKeyIterator;
  private _root: TernarySearchTreeNode<E> | undefined;

  constructor(segments: IKeyIterator) {
    this._iter = segments;
  }

  public clear(): void {
    this._root = undefined;
  }

  public set(key: string, element: E): E | undefined {
    const iter = this._iter.reset(key);
    let node: TernarySearchTreeNode<E>;

    if (!this._root) {
      this._root = new TernarySearchTreeNode<E>();
      this._root.segment = iter.value();
    }

    node = this._root;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const val = iter.cmp(node.segment);
      if (val > 0) {
        // left
        if (!node.left) {
          node.left = new TernarySearchTreeNode<E>();
          node.left.segment = iter.value();
        }
        node = node.left;
      } else if (val < 0) {
        // right
        if (!node.right) {
          node.right = new TernarySearchTreeNode<E>();
          node.right.segment = iter.value();
        }
        node = node.right;
      } else if (iter.hasNext()) {
        // mid
        iter.next();
        if (!node.mid) {
          node.mid = new TernarySearchTreeNode<E>();
          node.mid.segment = iter.value();
        }
        node = node.mid;
      } else {
        break;
      }
    }
    const oldElement = node.value;
    node.value = element;
    node.key = key;

    return oldElement;
  }

  public get(key: string): E | undefined {
    const iter = this._iter.reset(key);
    let node = this._root;
    while (node) {
      const val = iter.cmp(node.segment);
      if (val > 0) {
        // left
        node = node.left;
      } else if (val < 0) {
        // right
        node = node.right;
      } else if (iter.hasNext()) {
        // mid
        iter.next();
        node = node.mid;
      } else {
        break;
      }
    }

    return node ? node.value : undefined;
  }

  public delete(key: string): void {
    const iter = this._iter.reset(key);
    const stack: [-1 | 0 | 1, TernarySearchTreeNode<E>][] = [];
    let node = this._root;

    // find and unset node
    while (node) {
      const val = iter.cmp(node.segment);
      if (val > 0) {
        // left
        stack.push([1, node]);
        node = node.left;
      } else if (val < 0) {
        // right
        stack.push([-1, node]);
        node = node.right;
      } else if (iter.hasNext()) {
        // mid
        iter.next();
        stack.push([0, node]);
        node = node.mid;
      } else {
        // remove element
        node.value = undefined;

        // clean up empty nodes
        while (stack.length > 0 && node.isEmpty()) {
          const [dir, parent] = stack.pop()!;
          switch (dir) {
            case 1:
              parent.left = undefined;
              break;
            case 0:
              parent.mid = undefined;
              break;
            case -1:
              parent.right = undefined;
              break;
          }
          node = parent;
        }
        break;
      }
    }
  }

  public findSubstr(key: string): E | undefined {
    const iter = this._iter.reset(key);
    let node = this._root;
    let candidate: E | undefined;
    while (node) {
      const val = iter.cmp(node.segment);
      if (val > 0) {
        // left
        node = node.left;
      } else if (val < 0) {
        // right
        node = node.right;
      } else if (iter.hasNext()) {
        // mid
        iter.next();
        candidate = node.value || candidate;
        node = node.mid;
      } else {
        break;
      }
    }

    return (node && node.value) || candidate;
  }

  public findSuperstr(key: string): Iterator<E> | undefined {
    const iter = this._iter.reset(key);
    let node = this._root;
    while (node) {
      const val = iter.cmp(node.segment);
      if (val > 0) {
        // left
        node = node.left;
      } else if (val < 0) {
        // right
        node = node.right;
      } else if (iter.hasNext()) {
        // mid
        iter.next();
        node = node.mid;
      } else {
        // collect
        if (!node.mid) {
          return undefined;
        } else {
          return this._nodeIterator(node.mid);
        }
      }
    }

    return undefined;
  }

  private _nodeIterator(node: TernarySearchTreeNode<E>): Iterator<E> {
    let res: { done: false; value: E };
    let idx: number;
    let data: E[];
    const next = (): IteratorResult<E> => {
      if (!data) {
        // lazy till first invocation
        data = [];
        idx = 0;
        this._forEach(node, value => data.push(value));
      }
      if (idx >= data.length) {
        return FIN;
      }

      if (!res) {
        res = { done: false, value: data[idx++] };
      } else {
        res.value = data[idx++];
      }

      return res;
    };

    return { next };
  }

  public forEach(callback: (value: E, index: string) => any) {
    this._forEach(this._root, callback);
  }

  private _forEach(
    node: TernarySearchTreeNode<E> | undefined,
    callback: (value: E, index: string) => any
  ) {
    if (node) {
      // left
      this._forEach(node.left, callback);

      // node
      if (node.value) {
        // callback(node.value, this._iter.join(parts));
        callback(node.value, node.key);
      }
      // mid
      this._forEach(node.mid, callback);

      // right
      this._forEach(node.right, callback);
    }
  }
}

export class ResourceMap<T> {
  protected readonly map: Map<string, T>;
  protected readonly ignoreCase?: boolean;

  constructor() {
    this.map = new Map<string, T>();
    this.ignoreCase = false;
  }

  public set(resource: URI, value: T): void {
    this.map.set(this.toKey(resource), value);
  }

  public get(resource: URI): T | undefined {
    return this.map.get(this.toKey(resource));
  }

  public has(resource: URI): boolean {
    return this.map.has(this.toKey(resource));
  }

  public get size(): number {
    return this.map.size;
  }

  public clear(): void {
    this.map.clear();
  }

  public delete(resource: URI): boolean {
    return this.map.delete(this.toKey(resource));
  }

  public forEach(clb: (value: T) => void): void {
    this.map.forEach(clb);
  }

  public values(): T[] {
    return Object.values(this.map);
  }

  private toKey(resource: URI): string {
    let key = resource.toString();
    if (this.ignoreCase) {
      key = key.toLowerCase();
    }

    return key;
  }

  public keys(): URI[] {
    return Object.keys(this.map).map(k => URI.parse(k));
  }

  public clone(): ResourceMap<T> {
    const resourceMap = new ResourceMap<T>();

    this.map.forEach((value, key) => resourceMap.map.set(key, value));

    return resourceMap;
  }
}
