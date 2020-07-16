import services from '@/gm/gomarky/descriptors';

import { IStoreService } from '@/gm/platform/store/common/storeService';
import { CurrentModalView, IModalState } from '@/gm/platform/store/electron-browser/modal';
import { INotification } from '@/gm/platform/notification/common/notification';

import { INotificationState } from '@/gm/platform/store/electron-browser/notification';
import {
  IInstantiationService,
  IServicesAccessor,
} from '@/gm/platform/instantiation/common/instantiation';
import { computed, defineComponent } from '@vue/composition-api';

const component = services
  .get(IInstantiationService)
  .invokeFunction((accessor: IServicesAccessor) => {
    const storeService = accessor.get(IStoreService);

    const [ModalModule, NotificationModule] = storeService.getModules<
      IModalState,
      INotificationState
    >('modal', 'notification');

    return defineComponent({
      setup() {
        const modal = computed<CurrentModalView>(() => ModalModule.current);
        const notifications = computed<INotification[]>(() => NotificationModule.notifications);

        return { modal, notifications };
      },
      name: 'App',
    });
  });

export default component;
