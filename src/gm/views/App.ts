import { IInstantiationService } from '@/gm/platform/instantiation/common/instantiation';
import { defineComponent } from '@vue/composition-api';

import services from '@/gm/views/descriptors';

const component = services.get(IInstantiationService).invokeFunction(() => {
  return defineComponent({
    name: 'App',
  });
});

export default component;
