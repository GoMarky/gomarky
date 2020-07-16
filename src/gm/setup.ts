import { app } from 'electron';
import pkg from '../../package.json';
import { getDefaultUserDataPath } from '@/gm/paths';

import { isDev, isProd, isTest, LANGUAGE_DEFAULT } from '@/gm/base/platform';
import { join } from 'path';
import { getNLSConfig } from '@/gm/base/node/language';

import { mkdir, readFile } from '@/gm/base/node/pfs';
import * as Sentry from '@sentry/electron';

if (isProd) {
  Sentry.init({ dsn: 'https://1c3838524dc74daa80772f8ecab81c28@o217651.ingest.sentry.io/5247498' });
}

const userDataPath = getDefaultUserDataPath(process.platform);

app.setPath('userData', userDataPath);
app.name = pkg.name;

app.allowRendererProcessReuse = true;

if (isDev) {
  app.commandLine.appendSwitch('inspect', '5858');
}

setCurrentWorkingDirectory();
setElectronEnvironment();
registerGlobalListeners();

function setCurrentWorkingDirectory(): void {
  if (isProd || isTest) {
    (global as any).__static = join(__dirname, '/static').replace(/\\/g, '\\\\');
  }

  try {
    if (process.platform === 'win32') {
      console.log(process);
    }
  } catch (err) {
    console.error(err);
  }
}

function setElectronEnvironment(): void {
  if (!isDev) {
    return;
  }

  process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true';

  void app.whenReady().then(() => {
    const installExtension = require('electron-devtools-installer');
    installExtension.default(installExtension.VUEJS_DEVTOOLS);
  });
}

async function createAppDataFolders(): Promise<void> {
  const appDataFolder = join(app.getPath('appData'), app.name);

  await mkdir(appDataFolder);
  await mkdir(join(appDataFolder, 'config'));
  await mkdir(join(appDataFolder, 'db'));
  await mkdir(join(app.getPath('temp'), app.name));
}

function registerGlobalListeners() {
  const macOpenFiles: string[] = [];
  (global as any).MAC_DROPPED_FILES = macOpenFiles;

  app.on('open-file', (_: Electron.Event, path: string) => {
    macOpenFiles.push(path);

    console.log(macOpenFiles);
  });
}

app.whenReady().then(async () => {
  await onReady();
});

async function onReady(): Promise<void> {
  try {
    await createAppDataFolders();
  } catch (error) {
    //
  }

  await getNLSConfig(userDataPath, LANGUAGE_DEFAULT);

  /*
   * Require our main program.
   * */

  require('./main');
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function getUserDefinedLocale(): Promise<string> {
  let localeFile: Buffer | string = '';
  let applicationLocale = '';
  const locale_json: string = join(userDataPath, 'locale.json');

  try {
    localeFile = await readFile(locale_json, 'utf-8');
  } catch (err) {
    if (err.code === 'ENOENT') {
      // await writeJSON(locale_json, {locale: app.getLocale(), });
    } else {
      throw err;
    }
  }

  if (!localeFile) {
    throw new Error('Incorrect locale.json file');
  }

  try {
    const config: { locale: string } = JSON.parse(localeFile.toString());

    applicationLocale = config.locale;
  } catch (err) {
    throw new Error('Incorrect locale.json file');
  }

  return applicationLocale.toLowerCase();
}
