import 'react-native-get-random-values';

/**
 * @format
 */

import { AppRegistry, NativeModules } from 'react-native';
import { enableScreens } from 'react-native-screens';
import { name as appName } from './app.json';

// Device info builds its emitter at import time. Without these methods the
// native module logs one yellow box on launch.
function ensureEmitter(nativeModule) {
  if (!nativeModule || typeof nativeModule !== 'object') {
    return;
  }
  try {
    if (typeof nativeModule.addListener !== 'function') {
      nativeModule.addListener = () => undefined;
    }
    if (typeof nativeModule.removeListeners !== 'function') {
      nativeModule.removeListeners = () => undefined;
    }
  } catch {
    // A frozen turbo module cannot be patched. The warning stays in that case.
  }
}

ensureEmitter(NativeModules.RNDeviceInfo);
ensureEmitter(NativeModules.NotifeeApiModule);

try {
  const notifee = require('@notifee/react-native').default;
  notifee.onBackgroundEvent(() => undefined);
} catch {
  // The native module is absent in tests. Reminders still no-op there.
}

enableScreens();

const App = require('./App').default;

AppRegistry.registerComponent(appName, () => App);
