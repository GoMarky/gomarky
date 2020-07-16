import { Vue } from 'vue-property-decorator';
import Vuex, { Store } from 'vuex';
import { IInstantiationService } from '@/gm/platform/instantiation/common/instantiation';

Vue.use(Vuex);

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface IRootState {}

export interface IExpandedStore extends Store<IRootState> {
  instantiationService: IInstantiationService;
}

const store = new Vuex.Store<IRootState>({ strict: process.env.NODE_ENV !== 'production' });

export default (store as unknown) as IExpandedStore;
