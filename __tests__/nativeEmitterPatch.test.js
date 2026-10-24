jest.unmock('react-native/Libraries/Linking/Linking');
jest.unmock('react-native/Libraries/AppState/AppState');
jest.unmock('react-native/Libraries/Utilities/Appearance');
jest.unmock('react-native/Libraries/Components/Keyboard/Keyboard');
jest.unmock('react-native/Libraries/PushNotificationIOS/PushNotificationIOS');
jest.unmock('react-native/Libraries/Utilities/DevSettings');

const NativeModules = require('react-native/Libraries/BatchedBridge/NativeModules').default;

let deviceBuilds = 0;
Object.defineProperty(NativeModules, 'RNDeviceInfo', {
  configurable: true,
  enumerable: true,
  get() {
    deviceBuilds += 1;
    return Object.freeze({ getVersion: () => '1' });
  },
});
Object.defineProperty(NativeModules, 'NotifeeApiModule', {
  configurable: true,
  enumerable: true,
  get() {
    return Object.freeze({ getConstants: () => ({}) });
  },
});
NativeModules.LinkingManager = {
  getInitialURL: jest.fn(async () => null),
  canOpenURL: jest.fn(async () => true),
  openURL: jest.fn(async () => undefined),
  openSettings: jest.fn(async () => undefined),
  addListener: jest.fn(),
  removeListeners: jest.fn(),
};
NativeModules.AppState = {
  getConstants: () => ({ initialAppState: 'active' }),
  getCurrentAppState: success => { success({ app_state: 'active' }); },
  addListener: jest.fn(),
  removeListeners: jest.fn(),
};
NativeModules.Appearance = {
  getColorScheme: () => 'light',
  setColorScheme: jest.fn(),
  addListener: jest.fn(),
  removeListeners: jest.fn(),
};
NativeModules.DevSettings.addListener = jest.fn();
NativeModules.DevSettings.removeListeners = jest.fn();

require('../index');

const { Appearance, AppState, DevSettings, Keyboard, Linking, NativeEventEmitter, PushNotificationIOS } = require('react-native');

test('Linking keeps getInitialURL and addEventListener after the index patch', async () => {
  expect(typeof Linking.getInitialURL).toBe('function');
  expect(typeof Linking.addEventListener).toBe('function');
  await expect(Linking.getInitialURL()).resolves.toBeNull();
  const subscription = Linking.addEventListener('url', () => undefined);
  expect(typeof subscription.remove).toBe('function');
  expect(() => subscription.remove()).not.toThrow();
});

test('classes that use NativeEventEmitter still subscribe', () => {
  expect(typeof Keyboard.addListener).toBe('function');
  const keyboard = Keyboard.addListener('keyboardDidShow', () => undefined);
  expect(typeof keyboard.remove).toBe('function');
  keyboard.remove();

  expect(typeof AppState.addEventListener).toBe('function');
  const appState = AppState.addEventListener('change', () => undefined);
  expect(typeof appState.remove).toBe('function');
  appState.remove();

  expect(typeof Appearance.addChangeListener).toBe('function');
  const appearance = Appearance.addChangeListener(() => undefined);
  expect(typeof appearance.remove).toBe('function');
  appearance.remove();

  expect(typeof PushNotificationIOS.addEventListener).toBe('function');
  expect(() => PushNotificationIOS.addEventListener('notification', () => undefined)).not.toThrow();
  expect(() => PushNotificationIOS.removeEventListener('notification')).not.toThrow();

  expect(typeof DevSettings.addMenuItem).toBe('function');
  expect(() => DevSettings.addMenuItem('Gifteez', () => undefined)).not.toThrow();
});

test('NativeEventEmitter stays a class, and Device Info and Notifee gain listeners', () => {
  class Probe extends NativeEventEmitter {
    ping() {
      return 'ok';
    }
  }
  const probe = new Probe({ addListener() { return undefined; }, removeListeners() { return undefined; } });
  expect(probe.ping()).toBe('ok');
  expect(typeof probe.addListener).toBe('function');

  const seen = deviceBuilds;
  const first = require('react-native').NativeModules.RNDeviceInfo;
  const second = require('react-native').NativeModules.RNDeviceInfo;
  expect(deviceBuilds).toBe(seen + 2);
  expect(first).not.toBe(second);
  expect(typeof first.addListener).toBe('function');
  expect(typeof first.removeListeners).toBe('function');
  expect(first.getVersion()).toBe('1');
  expect(typeof second.addListener).toBe('function');

  const notifee = require('react-native').NativeModules.NotifeeApiModule;
  expect(typeof notifee.addListener).toBe('function');
  expect(typeof notifee.removeListeners).toBe('function');
  expect(notifee.getConstants()).toEqual({});

  const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  new NativeEventEmitter(first);
  new NativeEventEmitter(notifee);
  expect(warn).not.toHaveBeenCalled();
  warn.mockRestore();
});
