import path from 'path';
import { readFile } from '@/gm/base/node/pfs';

export async function getLanguagePackConfig(
  userDataPath: string,
  locale: string
): Promise<unknown> {
  const configFile = path.join(userDataPath, 'language_config.json');

  const defaultConfiguration = {
    [locale]: {
      hash: '',
      extensions: [],
      translations: {
        gomarky: '',
      },
    },
  };

  let configData: Buffer | string | object;

  try {
    configData = await readFile(configFile, 'utf-8');
  } catch (error) {
    if (error.code === 'ENOENT') {
      // await writeJSON(configFile, defaultConfiguration);
    }

    console.warn('No language_config.json file, create it');

    return defaultConfiguration;
  }

  if (!configData) {
    throw new Error('getLanguagePackConfig - undefined language_config.json file');
  }

  try {
    configData = JSON.parse(configData.toString());
  } catch (err) {
    console.warn(err);

    return undefined;
  }

  return configData;
}

export async function getNLSConfig(userDataPath: string, locale: string) {
  const config = await getLanguagePackConfig(userDataPath, locale);

  if (!config) {
    return;
  }

  return config;
}
