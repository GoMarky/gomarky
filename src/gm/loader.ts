import Module from 'module';

Module.prototype.require = new Proxy(Module.prototype.require, {
  apply(target: NodeRequireFunction, thisArg, argumentsList) {
    return Reflect.apply(target, thisArg, argumentsList);
  },
});
