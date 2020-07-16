import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

import assert from 'assert';
import { EventEmitter } from 'events';
import dotProp from 'dot-prop';

import makeDir from 'make-dir';
import pkgUp from 'pkg-up';
import envPaths from 'env-paths';

import writeFileAtomic from 'write-file-atomic';
import Ajv, { ValidateFunction } from 'ajv';
import debounceFn from 'debounce-fn';

import semver from 'semver';
import onetime from 'onetime';
import { Disposable } from '@/gm/base/common/lifecycle';

import { ICreateStoreInstanceOptions, IStoreInstance } from '@/gm/platform/storage/common/store';

const plainObject = () => Object.create(null);
const encryptionAlgorithm = 'aes-256-cbc';

// Prevent caching of this module so module.parent is always accurate
delete require.cache[__filename];
const parentDir = path.dirname((module.parent && module.parent.filename) || '.');

const nonJsonTypes = ['undefined', 'symbol', 'function'];

const checkValueType = <T>(key: T, value: any) => {
  const type = typeof value;

  if (nonJsonTypes.includes(type)) {
    throw new TypeError(
      `Setting a value of type \`${type}\` for key \`${key}\` is not allowed as it's not supported by JSON`
    );
  }
};

const INTERNAL_KEY = '__internal__';
const MIGRATION_KEY = `${INTERNAL_KEY}.migrations.version`;

export class StoreInstance<T> extends Disposable implements IStoreInstance<T> {
  private readonly _defaultValues: any;
  private _options: ICreateStoreInstanceOptions<T>;
  private readonly _validator: ValidateFunction;

  private _events: EventEmitter;
  private readonly _deserialize: (text: string) => T;
  private readonly _serialize: <T>(value: T) => string;

  private readonly encryptionKey: string | Buffer | NodeJS.TypedArray | DataView | undefined;

  private readonly _path: string;

  constructor(options: ICreateStoreInstanceOptions<T>) {
    super();
    options = {
      configName: 'config',
      fileExtension: 'json',
      projectSuffix: 'nodejs',
      clearInvalidConfig: true,
      serialize: value => JSON.stringify(value, null, '\t'),
      deserialize: JSON.parse,
      accessPropertiesByDotNotation: true,
      ...options,
    };

    const getPackageData = onetime(() => {
      const packagePath = pkgUp.sync({ cwd: parentDir });
      // Can't use `require` because of Webpack being annoying:
      // https://github.com/webpack/webpack/issues/196
      const packageData = packagePath && JSON.parse(fs.readFileSync(packagePath, 'utf8'));

      return packageData || {};
    });

    if (!options.cwd) {
      if (!options.projectName) {
        options.projectName = getPackageData().name;
      }

      if (!options.projectName) {
        throw new Error(
          'Project name could not be inferred. Please specify the `projectName` option.'
        );
      }

      options.cwd = envPaths(options.projectName, { suffix: options.projectSuffix }).config;
    }

    this._options = options;
    this._defaultValues = {};

    if (options.schema) {
      if (typeof options.schema !== 'object') {
        throw new TypeError('The `schema` option must be an object.');
      }

      const ajv = new Ajv({
        allErrors: true,
        format: 'full',
        useDefaults: true,
        errorDataPath: 'property',
      });
      const schema = {
        type: 'object',
        properties: options.schema,
      };

      this._validator = ajv.compile(schema);

      for (const [key, value] of Object.entries(options.schema)) {
        // eslint-disable-next-line @typescript-eslint/ban-ts-ignore
        // @ts-ignore
        if (value && value.default) {
          // eslint-disable-next-line @typescript-eslint/ban-ts-ignore
          // @ts-ignore
          this._defaultValues[key] = value.default;
        }
      }
    }

    if (options.defaults) {
      this._defaultValues = {
        ...this._defaultValues,
        ...options.defaults,
      };
    }

    this._events = new EventEmitter();
    this.encryptionKey = options.encryptionKey;
    this._serialize = options.serialize as any;
    this._deserialize = options.deserialize as any;

    const fileExtension = options.fileExtension ? `.${options.fileExtension}` : '';
    this._path = path.resolve(options.cwd, `${options.configName}${fileExtension}`);

    const fileStore = this.store;
    const store = Object.assign(plainObject(), options.defaults, fileStore);
    this.validate(store);

    try {
      assert.deepEqual(fileStore, store);
    } catch (_) {
      this.store = store;
    }

    if (options.watch) {
      this.watch();
    }

    if (options.migrations) {
      if (!options.projectVersion) {
        options.projectVersion = getPackageData().version;
      }

      if (!options.projectVersion) {
        throw new Error(
          'Project version could not be inferred. Please specify the `projectVersion` option.'
        );
      }

      this.migrate(options.migrations, options.projectVersion);
    }
  }

  private validate(data: string | Buffer) {
    if (!this._validator) {
      return;
    }

    const valid = this._validator(data);

    if (!valid) {
      const errors = this._validator.errors?.reduce(
        (error, { dataPath, message }) => `${error} \`${dataPath.slice(1)}\` ${message};`,
        ''
      );

      throw new Error(`Config schema violation: ${errors?.slice(0, -1)}`);
    }
  }

  private ensureDirectory() {
    // TODO: Use `fs.mkdirSync` `recursive` option when targeting Node.js 12.
    // Ensure the directory exists as it could have been deleted in the meantime.
    makeDir.sync(path.dirname(this._path));
  }

  private write(value: any) {
    let data: string | Buffer = this._serialize(value);

    if (this.encryptionKey) {
      const initializationVector = crypto.randomBytes(16);
      const password = crypto.pbkdf2Sync(
        this.encryptionKey,
        initializationVector.toString(),
        10000,
        32,
        'sha512'
      );
      const cipher = crypto.createCipheriv(encryptionAlgorithm, password, initializationVector);
      data = Buffer.concat([
        initializationVector,
        Buffer.from(':'),
        cipher.update(Buffer.from(data)),
        cipher.final(),
      ]);
    }

    // Temporary workaround for Conf being packaged in a Ubuntu Snap app.
    // See https://github.com/sindresorhus/conf/pull/82
    if (process.env.SNAP) {
      fs.writeFileSync(this._path, data);
    } else {
      writeFileAtomic.sync(this._path, data);
    }
  }

  private watch() {
    this.ensureDirectory();

    if (!fs.existsSync(this._path)) {
      this.write({});
    }

    fs.watch(
      this._path,
      { persistent: false },
      debounceFn(
        () => {
          // On Linux and Windows, writing to the config file emits a `rename` event, so we skip checking the event type.
          this._events.emit('change');
        },
        { wait: 100 }
      )
    );
  }

  private migrate(migrations: { [x: string]: any }, versionToMigrate: string | semver.SemVer) {
    let previousMigratedVersion = this._get(MIGRATION_KEY, '0.0.0');

    const newerVersions = Object.keys(migrations).filter(candidateVersion =>
      this.shouldPerformMigration(candidateVersion, previousMigratedVersion, versionToMigrate)
    );

    let storeBackup = { ...this.store };

    for (const version of newerVersions) {
      try {
        const migration = migrations[version];
        migration(this);

        this._set(MIGRATION_KEY, version);

        previousMigratedVersion = version;
        storeBackup = { ...this.store };
      } catch (error) {
        this.store = storeBackup;

        throw new Error(
          `Something went wrong during the migration! Changes applied to the store until this failed migration will be restored. ${error}`
        );
      }
    }

    if (
      this.isVersionInRangeFormat(previousMigratedVersion) ||
      !semver.eq(previousMigratedVersion, versionToMigrate)
    ) {
      this._set(MIGRATION_KEY, versionToMigrate);
    }
  }

  private containsReservedKey(key: string) {
    if (typeof key === 'object') {
      const firstKey = Object.keys(key)[0];

      if (firstKey === INTERNAL_KEY) {
        return true;
      }
    }

    if (typeof key !== 'string') {
      return false;
    }

    if (this._options.accessPropertiesByDotNotation) {
      return key.startsWith(`${INTERNAL_KEY}.`);
    }

    return false;
  }

  private isVersionInRangeFormat(version: string) {
    return semver.clean(version) === null;
  }

  private shouldPerformMigration(
    candidateVersion: string,
    previousMigratedVersion: string | semver.SemVer,
    versionToMigrate: string | semver.SemVer
  ) {
    if (this.isVersionInRangeFormat(candidateVersion)) {
      if (
        previousMigratedVersion !== '0.0.0' &&
        semver.satisfies(previousMigratedVersion, candidateVersion)
      ) {
        return false;
      }

      return semver.satisfies(versionToMigrate, candidateVersion);
    }

    if (semver.lte(candidateVersion, previousMigratedVersion)) {
      return false;
    }

    if (semver.gt(candidateVersion, versionToMigrate)) {
      return false;
    }

    return true;
  }

  private _get(key: string, defaultValue: string) {
    return dotProp.get(this.store, key, defaultValue);
  }

  private _set(key: string, value: unknown) {
    const { store } = this;
    dotProp.set(store, key, value);

    this.store = store;
  }

  public get<K extends keyof T>(key: K, defaultValue?: T[K]): T[K] {
    if (this._options.accessPropertiesByDotNotation) {
      // eslint-disable-next-line @typescript-eslint/ban-ts-ignore
      // @ts-ignore
      return dotProp.get(this.store, key, defaultValue);
    }

    return key in this.store ? this.store[key] : defaultValue;
  }

  // eslint-disable-next-line @typescript-eslint/ban-ts-ignore
  // @ts-ignore
  public set<K extends keyof T>(key: K, value: T[K]): void {
    if (typeof key !== 'string' && typeof key !== 'object') {
      throw new TypeError(
        `Expected \`key\` to be of type \`string\` or \`object\`, got ${typeof key}`
      );
    }

    if (typeof key !== 'object' && value === undefined) {
      throw new TypeError('Use `delete()` to clear values');
    }

    if (this.containsReservedKey(key)) {
      throw new TypeError(
        `Please don't use the ${INTERNAL_KEY} key, as it's used to manage this module internal operations.`
      );
    }

    const { store } = this;

    const set = (key: string, value: unknown) => {
      checkValueType(key, value);
      if (this._options.accessPropertiesByDotNotation) {
        dotProp.set(store, key, value);
      } else {
        store[key] = value;
      }
    };

    if (typeof key === 'object') {
      const object = key;
      for (const [key, value] of Object.entries(object)) {
        set(key, value);
      }
    } else {
      set(key, value);
    }

    this.store = store;
  }

  public has<K extends keyof T>(key: K): boolean {
    if (this._options.accessPropertiesByDotNotation) {
      return dotProp.has(this.store, key as string);
    }

    return key in this.store;
  }

  public reset<K extends keyof T>(...keys: K[]): void {
    for (const key of keys) {
      if (this._defaultValues[key]) {
        this.set(key, this._defaultValues[key]);
      }
    }
  }

  public delete<K extends keyof T>(key: K): void {
    const { store } = this;
    if (this._options.accessPropertiesByDotNotation) {
      dotProp.delete(store, key as string);
    } else {
      delete store[key];
    }

    this.store = store;
  }

  public clear() {
    this.store = plainObject();
  }

  public onDidChange<K extends keyof T>(
    key: K,
    callback: (newValue?: T[K], oldValue?: T[K]) => void
  ): () => void {
    if (typeof key !== 'string') {
      throw new TypeError(`Expected \`key\` to be of type \`string\`, got ${typeof key}`);
    }

    if (typeof callback !== 'function') {
      throw new TypeError(
        `Expected \`callback\` to be of type \`function\`, got ${typeof callback}`
      );
    }

    const getter = () => this.get(key);

    return this.handleChange(getter, callback);
  }

  public onDidAnyChange(
    callback: (newValue?: Readonly<T>, oldValue?: Readonly<T>) => void
  ): () => void {
    if (typeof callback !== 'function') {
      throw new TypeError(
        `Expected \`callback\` to be of type \`function\`, got ${typeof callback}`
      );
    }

    const getter = () => this.store;

    return this.handleChange(getter, callback);
  }

  private handleChange(getter: any, callback: any) {
    let currentValue = getter();

    const onChange = () => {
      const oldValue = currentValue;
      const newValue = getter();

      try {
        // TODO: Use `util.isDeepStrictEqual` when targeting Node.js 10
        assert.deepEqual(newValue, oldValue);
      } catch (_) {
        currentValue = newValue;
        callback.call(this, newValue, oldValue);
      }
    };

    this._events.on('change', onChange);

    return () => this._events.removeListener('change', onChange);
  }

  public get size() {
    return Object.keys(this.store).length;
  }

  public get store() {
    try {
      let data = fs.readFileSync(this._path, this.encryptionKey ? null : 'utf8');

      if (this.encryptionKey) {
        try {
          // Check if an initialization vector has been used to encrypt the data
          if (data.slice(16, 17).toString() === ':') {
            const initializationVector = data.slice(0, 16);
            const password = crypto.pbkdf2Sync(
              this.encryptionKey,
              initializationVector.toString(),
              10000,
              32,
              'sha512'
            );
            const decipher = crypto.createDecipheriv(
              encryptionAlgorithm,
              password,
              initializationVector
            );
            data = Buffer.concat([decipher.update(data.slice(17) as any), decipher.final()]);
          } else {
            const decipher = crypto.createDecipher(encryptionAlgorithm, this.encryptionKey);
            data = Buffer.concat([decipher.update(data as any), decipher.final()]);
          }
        } catch (_) {
          //
        }
      }

      (data as any) = this._deserialize(data as any);
      this.validate(data);

      return Object.assign(plainObject(), data);
    } catch (error) {
      if (error.code === 'ENOENT') {
        this.ensureDirectory();

        return plainObject();
      }

      if (this._options.clearInvalidConfig && error.name === 'SyntaxError') {
        return plainObject();
      }

      throw error;
    }
  }

  public set store(value: any) {
    this.ensureDirectory();

    this.validate(value);
    this.write(value);

    this._events.emit('change');
  }

  // eslint-disable-next-line @typescript-eslint/ban-ts-ignore
  // @ts-ignore
  public *[Symbol.iterator]() {
    for (const [key, value] of Object.entries(this.store)) {
      yield [key, value];
    }
  }
}
