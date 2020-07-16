import {
  ExtensionIdentifier,
  IExtensionDescription,
} from '@/gm/platform/extensions/common/extensions';
import { ILogService } from '@/gm/platform/log/common/log';

export class ExtensionDescriptionRegistry {
  private _extensionDescriptions: IExtensionDescription[];
  private readonly _extensionsMap: Map<string, IExtensionDescription> = new Map();

  constructor(
    extensionDescriptions: IExtensionDescription[],
    @ILogService private readonly logService: ILogService
  ) {
    this._extensionDescriptions = extensionDescriptions;

    this.initialize();
  }

  public get extensionDescriptions(): IExtensionDescription[] {
    return this._extensionDescriptions;
  }

  public deltaExtensions(toAdd: IExtensionDescription[]): void {
    this._extensionDescriptions = this.extensionDescriptions.concat(toAdd);

    this.initialize();
  }

  private initialize(): void {
    for (const extensionDescription of this._extensionDescriptions) {
      const extensionKeyIdentifier = ExtensionIdentifier.toKey(extensionDescription.identifier);

      if (this._extensionsMap.has(extensionKeyIdentifier)) {
        this.logService.error(
          `Extension ${extensionDescription.identifier.value} is already registered`
        );

        continue;
      }

      this._extensionsMap.set(extensionKeyIdentifier, extensionDescription);
    }

    this.logService.info(
      `ExtensionDescriptionRegistry#initialize - activate ${this._extensionDescriptions.length} extensions`
    );
  }
}
