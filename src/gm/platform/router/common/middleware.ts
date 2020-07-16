import { Route } from 'vue-router';

/**
 * @author Teodor_Dre <swen295@gmail.com>
 *
 * @description
 *  Middleware context
 *
 * @property {any} next - Navigation guard method.
 * @property {Route} to - Route object from current route.
 * @property {Route} from - Route object from previous route.
 */
export interface IMiddlewareContext {
  next: any;
  to: Route;
  from: Route;
}
