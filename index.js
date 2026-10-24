import 'react-native-get-random-values';

/**
 * @format
 */

import './src/platform/safeNativeEmitter';
import { AppRegistry } from 'react-native';
import { enableScreens } from 'react-native-screens';
import { name as appName } from './app.json';

try {
  const notifee = require('@notifee/react-native').default;
  notifee.onBackgroundEvent(() => undefined);
} catch {
  // The native module is absent in tests. Reminders still no-op there.
}

enableScreens();

const App = require('./App').default;

AppRegistry.registerComponent(appName, () => App);
