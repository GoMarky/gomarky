import os from 'os';
import path from 'path';
import pkg from '../../package.json';

export function getAppDataPath(platform: string) {
  switch (platform) {
    case 'win32':
      return path.join(os.homedir(), 'AppData', 'Roaming');
    case 'darwin':
      return path.join(os.homedir(), 'Library', 'Application Support');
    case 'linux':
      return path.join(os.homedir(), '.config');
    default:
      throw new Error('Platform not supported');
  }
}

export function getDefaultUserDataPath(platform: string): string {
  return path.join(getAppDataPath(platform), pkg.name);
}
