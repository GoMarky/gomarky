import Vue from 'vue';
import { IInstantiationService } from '@/gm/platform/instantiation/common/instantiation';

declare module '*.vue' {
  export default Vue;
}

declare module 'vue/types/vue' {
  interface Vue {
    instantiationService: IInstantiationService;
  }
}
