import { createRenderer } from '@/gm/views/main';
import { ipcRenderer as ipc } from 'electron';
import { ILogService } from '@/gm/platform/log/common/log';

import { Vue } from 'vue-property-decorator';
import { LogLevel } from '@/gm/platform/log/common/abstractLog';

import { ILifecycleService, LifePhase } from '@/gm/platform/lifecycle/common/lifecycle';
import VueRouter from 'vue-router';
import VueCompositionApi from '@vue/composition-api';

import * as GMCore from '@/core';
import PIXI from 'pixi.js';

Vue.use(VueRouter);
Vue.use(VueCompositionApi);
Vue.config.productionTip = false;

async function main(): Promise<void> {
  await new Promise((resolve, reject) => {
    ipc.once('gomarky:acceptEnv', async () => {
      const windowConfig = (window.GOMARKY_WIN_CONFIGURATION = JSON.parse(
        decodeURIComponent(document.location.search.split('=')[1])
      ));

      const services = await createRenderer();

      const logService = services.get(ILogService);
      const lifecycleService = services.get(ILifecycleService);

      logService.setLevel(windowConfig.logLevel || LogLevel.Trace);
      lifecycleService.phase = LifePhase.Ready;

      return Promise.all([])
        .then(async () => {
          const App = (await import('@/gm/views/App')).default;

          new Vue({
            el: '#app',
            render: h => h(App),
          });

          resolve();
        })
        .catch(reject);
    });
  });

  const canvas = document.querySelector<HTMLCanvasElement>('#canvas') as HTMLCanvasElement;

  const options: PIXI.ApplicationOptions = {
    width: window.innerWidth,
    height: window.innerHeight,
    backgroundColor: 0xffffff,
    view: canvas,
    antialias: true,
    sharedTicker: true,
    forceFXAA: false,
    legacy: true,
    powerPreference: 'high-performance',
    resolution: devicePixelRatio,
    transparent: false,
  };

  new GMCore.Application(options);
}

void main();
