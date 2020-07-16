import { JSONSchema as Schema } from 'json-schema-typed';

export interface ICreateStoreInstanceOptions<T> {
  /**
   * Config used if there are no existing config.
   * **Note:** The values in `defaults` will overwrite the `default` key in the `schema` option.
   */
  readonly defaults?: Readonly<T>;

  /**
   * [JSON Schema](https://json-schema.org) to validate your config data.
   * Under the hood, the JSON Schema validator [ajv](https://github.com/epoberezkin/ajv) is used to validate your config.
   * We use [JSON Schema draft-07](http://json-schema.org/latest/json-schema-validation.html)
   * and support all [validation keywords](https://github.com/epoberezkin/ajv/blob/master/KEYWORDS.md) and [formats](https://github.com/epoberezkin/ajv#formats).
   * You should define your schema as an object where each key is the name of your data's property and each value is a JSON schema used to validate that property.
   * See more [here](https://json-schema.org/understanding-json-schema/reference/object.html#properties).
   *
   */
  readonly schema?: { [P in keyof T]: Schema };

  /**
   * Name of the config file (without extension).
   * Useful if you need multiple config files for your app or module. For example, different config files between two major versions.
   * @default 'config'
   */
  readonly configName?: string;

  /**
   * You only need to specify this if you don't have a package.json file in your project or if it doesn't have a name defined within it.
   * Default: The name field in the `package.json` closest to where `conf` is imported.
   */
  projectName?: string;

  /**
   * You only need to specify this if you don't have a package.json file in your project or if it doesn't have a version defined within it.
   * Default: The name field in the `package.json` closest to where `conf` is imported.
   */
  projectVersion?: string;

  /*
  _Don't use this feature until [this issue](https://github.com/sindresorhus/conf/issues/92) has been fixed._
  You can use migrations to perform operations to the store whenever a version is changed.
  The `migrations` object should consist of a key-value pair of `'version': handler`. The `version` can also be a [semver range](https://github.com/npm/node-semver#ranges).
  */
  readonly migrations?: { [version: string]: (store: IStoreInstance<T>) => void };

  /**
   * __You most likely don't need this. Please don't use it unless you really have to.__
   * The only use-case I can think of is having the config located in the app directory or on
   * some external storage. Default: System default user [config directory](https://github.com/sindresorhus/env-paths#pathsconfig).
   */
  cwd: string;

  /**
   * Note that this is __not intended for security purposes__, since the encryption key would be easily found inside a plain-text Node.js app.
   * Its main use is for obscurity. If a user looks through the config directory and finds the config file,
   * since it's just a JSON file, they may be tempted to modify it. By providing an encryption key, the file will be obfuscated, which should hopefully deter any users from doing so.
   * It also has the added bonus of ensuring the config file's integrity. If the file is changed in any way,
   * the decryption will not work, in which case the store will just reset back to its default state.
   * When specified, the store will be encrypted using the [`aes-256-cbc`](https://en.wikipedia.org/wiki/Block_cipher_mode_of_operation) encryption algorithm.
   */
  readonly encryptionKey?: string | Buffer | NodeJS.TypedArray | DataView;

  /**
   * Extension of the config file.
   * You would usually not need this, but could be useful if you want to interact with a file with a
   * custom file extension that can be associated with your app. These might be simple save/export/preference
   * files that are intended to be shareable or saved outside of the app.
   * @default 'json'
   */
  readonly fileExtension?: string;

  /**
   * The config is cleared if reading the config file causes a `SyntaxError`.
   * This is a good default, as the config file is not intended to be hand-edited,
   * so it usually means the config is corrupt and there's nothing the user can do about it anyway.
   * However, if you let the user edit the config file directly, mistakes might happen and it could be more useful to throw an error when the config is invalid instead of clearing.
   * Disabling this option will make it throw a `SyntaxError` on invalid config instead of clearing.
   * @default true
   */
  readonly clearInvalidConfig?: boolean;

  /**
   * Function to serialize the config object to a UTF-8 string when writing the config file.
   * You would usually not need this, but it could be useful if you want to use a format other than JSON.
   * @default value => JSON.stringify(value, null, '\t')
   */
  readonly serialize?: (value: T) => string;

  /**
   * Function to deserialize the config object from a UTF-8 string when reading the config file.
   * You would usually not need this, but it could be useful if you want to use a format other than JSON.
   * @default JSON.parse
   */
  readonly deserialize?: (text: string) => T;

  /**
   * __You most likely don't need this. Please don't use it unless you really have to.__
   * Suffix appended to `projectName` during config file creation to avoid name conflicts with native apps.
   * You can pass an empty string to remove the suffix.
   * For example, on macOS, the config file will be stored in the `~/Library/Preferences/foo-nodejs` directory, where `foo` is the `projectName`.
   *  @default 'nodejs'
   */
  readonly projectSuffix?: string;
  readonly accessPropertiesByDotNotation?: boolean;

  /**
   *  Watch for any changes in the config file and call the callback for `onDidChange` if set. This is useful if there are multiple processes changing the same config file.
   *  __Currently this option doesn't work on Node.js 8 on macOS.__
   * @default false
   */
  readonly watch?: boolean;
}

export interface IStoreInstance<T> {
  store: T;
  readonly size: number;

  /**
   * Set an item.
   * @param key - You can use [dot-notation](https://github.com/sindresorhus/dot-prop) in a key to access nested properties.
   * @param value - Must be JSON serializable. Trying to set the type `undefined`, `function`, or `symbol` will result in a `TypeError`.
   */
  set<K extends keyof T>(key: K, value: T[K]): void;

  /**
   * Set multiple items at once.
   * @param object - A hashmap of items to set at once.
   */
  set(object: Partial<T>): void;

  /**
   * Get an item.
   * @param key - The key of the item to get.
   * @param defaultValue - The default value if the item does not exist.
   */
  get<K extends keyof T>(key: K, defaultValue?: T[K]): T[K];

  /**
   * Reset items to their default values, as defined by the `defaults` or `schema` option.
   * @param keys - The keys of the items to reset.
   */
  reset<K extends keyof T>(...keys: K[]): void;

  /**
   * Check if an item exists.
   * @param key - The key of the item to check.
   */
  has<K extends keyof T>(key: K): boolean;

  /**
   * Delete an item.
   * @param key - The key of the item to delete.
   */
  delete<K extends keyof T>(key: K): void;

  /**
   * Delete all items.
   */
  clear(): void;

  /**
   * Watches the given `key`, calling `callback` on any changes.
   * @param key - The key wo watch.
   * @param callback - A callback function that is called on any changes. When a `key` is first set `oldValue` will be `undefined`, and when a key is deleted `newValue` will be `undefined`.
   */
  onDidChange<K extends keyof T>(
    key: K,
    callback: (newValue?: T[K], oldValue?: T[K]) => void
  ): () => void;

  /**
   * Watches the whole config object, calling `callback` on any changes.
   * @param callback - A callback function that is called on any changes. When a `key` is first set `oldValue` will be `undefined`, and when a key is deleted `newValue` will be `undefined`.
   */
  onDidAnyChange(callback: (newValue?: Readonly<T>, oldValue?: Readonly<T>) => void): () => void;

  [Symbol.iterator](): IterableIterator<[keyof T, T[keyof T]]>;
}
