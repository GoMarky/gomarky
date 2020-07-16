import { IMiddlewareContext } from '@/gm/platform/router/common/middleware';
import {
  IInstantiationService,
  IServicesAccessor,
} from '@/gm/platform/instantiation/common/instantiation';

/**
 * @author Teodor_Dre <swen295@gmail.com>
 *
 * @description
 * Conveyor middleware function.
 *
 * @param {IMiddlewareContext} context - Context object that we created earlier so that it can be passed to each middleware in the stack.
 * @param {any} middleware - Array of middleware that we passed to route.
 * @param {number} index - current using middleware index.
 * @param {IInstantiationService} instantiationService - accessor into another services.
 *
 * @returns () => void
 */
export function middlewarePipeline(
  context: IMiddlewareContext,
  middleware: any,
  index: number,
  instantiationService: IInstantiationService
): () => void {
  const nextMiddleware = middleware[index];

  if (!nextMiddleware) {
    return context.next;
  }

  return () => {
    instantiationService.invokeFunction((accessor: IServicesAccessor) => {
      return nextMiddleware(accessor, {
        ...context,
        next: middlewarePipeline(context, middleware, index + 1, instantiationService),
      });
    });
  };
}
