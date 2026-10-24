import 'react-native-get-random-values';

/**
 * @format
 */

import { AppRegistry } from 'react-native';
import { enableScreens } from 'react-native-screens';
import { name as appName } from './app.json';

// Device Info and Notifee construct a NativeEventEmitter when they load. Their
// turbo modules can be frozen, or a getter that returns a new object, so a
// one-time assignment does not stick. Wrap each read instead.
//
// Do not replace NativeEventEmitter. LinkingImpl extends that class, and a
// plain function in its place drops getInitialURL and addEventListener.
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

patchListenerModules();

try {
  const notifee = require('@notifee/react-native').default;
  notifee.onBackgroundEvent(() => undefined);
} catch {
  // The native module is absent in tests. Reminders still no-op there.
}

enableScreens();

const App = require('./App').default;

AppRegistry.registerComponent(appName, () => App);
