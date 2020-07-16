import { URI } from '@/gm/base/common/uri';
import { equalsIgnoreCase } from '@/gm/base/common/string';

export const enum ExtensionType {
  System,
  User,
}

export type ExtensionKind = 'ui' | 'workspace';

export interface IExtensionModule {
  activate(context: IExtensionContext): Promise<IExtensionAPI>;

  deactivate(): Promise<void>;
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface IExtensionContext {}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface IExtensionAPI {}

export interface IExtensionManifest {
  readonly name: string;
  readonly displayName: string;
  readonly version: string;

  readonly publisher: string;
  readonly author: string;
  readonly main?: string;

  readonly description?: string;

  readonly repository: { url: string };
  readonly engines?: { gomarky: string };
  readonly api?: { baseUrl: string };
}

export interface IExtensionDescription extends IExtensionManifest {
  readonly identifier: ExtensionIdentifier;
  readonly uuid?: string;
  readonly isBuiltin: boolean;
  readonly isUnderDevelopment: boolean;
  readonly extensionLocation: URI;
}

export interface IExtension {
  readonly type: ExtensionType;
  readonly identifier: string;
  readonly manifest: IExtensionManifest;
  readonly location: URI;
}

export interface ILog {
  error(source: string, message: string): void;

  warn(source: string, message: string): void;

  info(source: string, message: string): void;
}

export class ExtensionIdentifier {
  public readonly value: string;
  private readonly _lower: string;

  constructor(value: string) {
    this.value = value;
    this._lower = value.toLowerCase();
  }

  public static equals(
    a: ExtensionIdentifier | string | null | undefined,
    b: ExtensionIdentifier | string | null | undefined
  ) {
    if (typeof a === 'undefined' || a === null) {
      return typeof b === 'undefined' || b === null;
    }
    if (typeof b === 'undefined' || b === null) {
      return false;
    }
    if (typeof a === 'string' || typeof b === 'string') {
      const aValue = typeof a === 'string' ? a : a.value;
      const bValue = typeof b === 'string' ? b : b.value;

      return equalsIgnoreCase(aValue, bValue);
    }

    return a._lower === b._lower;
  }

  public static toKey(id: ExtensionIdentifier | string): string {
    if (typeof id === 'string') {
      return id.toLowerCase();
    }
    return id._lower;
  }
}
