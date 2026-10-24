'use strict';

// Device Info and Notifee construct a NativeEventEmitter when they load. Their
// turbo modules can be frozen, or a getter that returns a new object, so a
// one-time assignment does not stick. Wrap each read instead.
//
// Also subclass NativeEventEmitter before anything extends it. A missing
// addListener or removeListeners makes React Native warn, and the Debug yellow
// toast is that warning's fusebox stand-in. The subclass supplies the methods
// at construction. It stays a real class: LinkingImpl extends it and keeps
// getInitialURL and addEventListener. A plain function in this spot drops them.

const LISTENER_MODULES = new Set(['RNDeviceInfo', 'NotifeeApiModule']);
const patchedExports = new WeakSet();

function withListenerMethods(nativeModule) {
  if (nativeModule == null || typeof nativeModule !== 'object') {
    return nativeModule;
  }
  const hasAdd = typeof nativeModule.addListener === 'function';
  const hasRemove = typeof nativeModule.removeListeners === 'function';
  if (hasAdd && hasRemove) {
    return nativeModule;
  }
  try {
    if (!hasAdd) {
      nativeModule.addListener = () => undefined;
    }
    if (!hasRemove) {
      nativeModule.removeListeners = () => undefined;
    }
    if (typeof nativeModule.addListener === 'function' && typeof nativeModule.removeListeners === 'function') {
      return nativeModule;
    }
  } catch {
    // A frozen module cannot grow methods. The proxy below supplies them.
  }
  // Proxy a fresh target. A frozen module's own methods are non-configurable, so a
  // proxy of the module itself cannot hand back a bound function.
  return new Proxy({}, {
    get(_target, prop) {
      if (prop === 'addListener' || prop === 'removeListeners') {
        const existing = nativeModule[prop];
        return typeof existing === 'function' ? existing.bind(nativeModule) : () => undefined;
      }
      const value = nativeModule[prop];
      return typeof value === 'function' ? value.bind(nativeModule) : value;
    },
    has(_target, prop) {
      return prop === 'addListener' || prop === 'removeListeners' || prop in nativeModule;
    },
  });
}

function patchListenerModules() {
  const nativeModulesModule = require('react-native/Libraries/BatchedBridge/NativeModules');
  const current = nativeModulesModule.default;
  if (current == null || patchedExports.has(current)) {
    return;
  }
  const patched = new Proxy(current, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (typeof prop === 'string' && LISTENER_MODULES.has(prop)) {
        return withListenerMethods(value);
      }
      return value;
    },
  });
  patchedExports.add(current);
  patchedExports.add(patched);
  nativeModulesModule.default = patched;
}

function installSafeNativeEventEmitter() {
  const emitterModule = require('react-native/Libraries/EventEmitter/NativeEventEmitter');
  const Original = emitterModule.default;
  if (typeof Original !== 'function' || Original.__gifteezSafe) {
    return;
  }
  class SafeNativeEventEmitter extends Original {
    constructor(nativeModule) {
      super(withListenerMethods(nativeModule));
    }
  }
  SafeNativeEventEmitter.__gifteezSafe = true;
  emitterModule.default = SafeNativeEventEmitter;
}

patchListenerModules();
installSafeNativeEventEmitter();
