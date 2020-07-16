let _isWindows = false;
let _isMacintosh = false;
let _isLinux = false;

export const LANGUAGE_DEFAULT = 'en';

export const isDev = process.env.NODE_ENV === 'development';
export const isProd = process.env.NODE_ENV === 'production';
export const isTest = process.env.NODE_ENV === 'test';

export const isBrowser = typeof process !== 'object';

export const enum Platform {
  Web,
  Mac,
  Linux,
  Windows,
}

export type IWindowType = 'win' | 'win32' | 'win64';

export const platformMap: IPlatformMap = {
  Windows: ['win', 'win32', 'win64'],
  Mac: ['darwin', 'osx'],
  Linux: ['linux', 'freebsd', 'sunos'],
};

export class PlatformError extends Error {
  public readonly name = 'PlatformError';

  constructor(message: string) {
    super(message);
  }
}

export interface IPlatformMap {
  Windows: string[];
  Mac: string[];
  Linux: string[];
}

export type IPlatformMapKey = keyof IPlatformMap;

export function normalizedPlatformName(): string {
  if (!process.platform) {
    throw new PlatformError(
      'normalizedPlatformName - process.platform does not have correct value'
    );
  }

  for (const platform in platformMap) {
    if (
      platformMap.hasOwnProperty(platform) &&
      platformMap[platform as IPlatformMapKey].indexOf(process.platform) > -1
    ) {
      return platform;
    }
  }

  throw new PlatformError(
    `normalizedPlatformName - ${JSON.stringify(platformMap)} doesnt have correct platform`
  );
}

export function PlatformToString(platform: Platform): string {
  switch (platform) {
    case Platform.Web:
      return 'Web';
    case Platform.Mac:
      return 'Mac';
    case Platform.Linux:
      return 'Linux';
    case Platform.Windows:
      return 'Windows';
  }
}

const language: string = LANGUAGE_DEFAULT;

if (!isBrowser) {
  const currentPlatform: string = normalizedPlatformName();

  _isMacintosh = currentPlatform === PlatformToString(Platform.Mac);
  _isLinux = currentPlatform === PlatformToString(Platform.Linux);
  _isWindows = currentPlatform === PlatformToString(Platform.Windows);
}

export function value(): string {
  return language;
}

export function isDefault(): boolean {
  return language === 'en';
}

export const enum OperatingSystem {
  Windows = 1,
  Macintosh = 2,
  Linux = 3,
}

export const OS = _isMacintosh
  ? OperatingSystem.Macintosh
  : _isWindows
  ? OperatingSystem.Windows
  : OperatingSystem.Linux;
export const isWindows: boolean = _isWindows;
export const isMacintosh: boolean = _isMacintosh;
export const isLinux: boolean = _isLinux;
