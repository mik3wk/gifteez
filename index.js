import 'react-native-get-random-values';

/**
 * @format
 */

import { AppRegistry, NativeModules } from 'react-native';
import { enableScreens } from 'react-native-screens';
import { name as appName } from './app.json';

// Device info and Notifee build emitters when their modules load. A turbo
// module can be frozen, or a fresh getter object, so patching NativeModules
// once at launch does not stick. Wrap the constructor instead: every later
// `new NativeEventEmitter(module)` sees addListener and removeListeners.
function listenerReady(nativeModule) {
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
  return new Proxy(nativeModule, {
    get(target, prop, receiver) {
      if (prop === 'addListener') {
        return () => undefined;
      }
      if (prop === 'removeListeners') {
        return () => undefined;
      }
      const value = Reflect.get(target, prop, receiver);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
}

const emitterModule = require('react-native/Libraries/EventEmitter/NativeEventEmitter');
const OriginalNativeEventEmitter = emitterModule.default;
function SafeNativeEventEmitter(nativeModule) {
  return new OriginalNativeEventEmitter(listenerReady(nativeModule));
}
SafeNativeEventEmitter.prototype = OriginalNativeEventEmitter.prototype;
Object.setPrototypeOf(SafeNativeEventEmitter, OriginalNativeEventEmitter);
emitterModule.default = SafeNativeEventEmitter;

// Keep the direct patch too, for modules that read the methods themselves.
listenerReady(NativeModules.RNDeviceInfo);
listenerReady(NativeModules.NotifeeApiModule);

try {
  const notifee = require('@notifee/react-native').default;
  notifee.onBackgroundEvent(() => undefined);
} catch {
  // The native module is absent in tests. Reminders still no-op there.
}

enableScreens();

const App = require('./App').default;

AppRegistry.registerComponent(appName, () => App);
