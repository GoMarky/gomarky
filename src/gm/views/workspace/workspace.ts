import { createRenderer } from '@/gm/views/main';
import { ipcRenderer as ipc } from 'electron';
import { ILogService } from '@/gm/platform/log/common/log';

import { IRouterService } from '@/gm/platform/router/common/router';
import { Vue } from 'vue-property-decorator';
import { LogLevel } from '@/gm/platform/log/common/abstractLog';

import { ILifecycleService, LifePhase } from '@/gm/platform/lifecycle/common/lifecycle';
import VueRouter from 'vue-router';
import VueCompositionApi from '@vue/composition-api';

Vue.use(VueRouter);
Vue.use(VueCompositionApi);
Vue.config.productionTip = false;

function main(): void {
  ipc.once('gomarky:acceptEnv', async () => {
    const windowConfig = (window.GOMARKY_WIN_CONFIGURATION = JSON.parse(
      decodeURIComponent(document.location.search.split('=')[1])
    ));

    const services = await createRenderer();

    const logService = services.get(ILogService);
    const lifecycleService = services.get(ILifecycleService);

    logService.setLevel(windowConfig.logLevel || LogLevel.Trace);
    lifecycleService.phase = LifePhase.Ready;

    return Promise.all([]).then(async () => {
      const App = (await import('@/gm/views/App')).default;

      new Vue({
        el: '#app',
        render: h => h(App),
      });
    });
  });
}

main();
