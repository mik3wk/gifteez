import { NativeEventEmitter, NativeModules } from 'react-native';

// Device Info and Notifee construct a NativeEventEmitter when they load. Their
// turbo modules can be frozen, or a getter that returns a new object, so a
// one-time assignment does not stick. Wrap each public read instead.
//
// Subclass the public NativeEventEmitter and publish that subclass on the
// public export. A missing addListener or removeListeners makes React Native
// warn, and the Debug yellow toast is that warning's fusebox stand-in. The
// subclass supplies the methods. Linking imports the emitter from inside React
// Native and keeps extending that real class, so getInitialURL stays put.
// A plain function in this spot would drop it.

const LISTENER_MODULES = new Set(['RNDeviceInfo', 'NotifeeApiModule']);

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

function publish(name, value) {
  const reactNative = require('react-native');
  const current = Object.getOwnPropertyDescriptor(reactNative, name);
  Object.defineProperty(reactNative, name, {
    configurable: true,
    enumerable: current?.enumerable !== false,
    get() {
      return value;
    },
  });
}

function installSafeNativeEventEmitter() {
  if (typeof NativeEventEmitter !== 'function' || NativeEventEmitter.__gifteezSafe) {
    return;
  }
  class SafeNativeEventEmitter extends NativeEventEmitter {
    constructor(nativeModule) {
      super(withListenerMethods(nativeModule));
    }
  }
  SafeNativeEventEmitter.__gifteezSafe = true;
  publish('NativeEventEmitter', SafeNativeEventEmitter);

  if (NativeModules == null || typeof NativeModules !== 'object') {
    return;
  }
  const patched = new Proxy(NativeModules, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (typeof prop === 'string' && LISTENER_MODULES.has(prop)) {
        return withListenerMethods(value);
      }
      return value;
    },
  });
  publish('NativeModules', patched);
}

installSafeNativeEventEmitter();
