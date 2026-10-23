// The package declares `let module`, which collides with Jest's CommonJS
// wrapper. Node already provides crypto.getRandomValues, which is what
// @noble uses in tests. On device, index.js loads the real module first.
jest.mock('react-native-haptic-feedback', () => ({
  default: { trigger: jest.fn() },
}));

jest.mock('react-native-svg', () => {
  const React = require('react');
  const { View } = require('react-native');
  const Mock = ({ children }) => React.createElement(View, null, children);
  return { __esModule: true, default: Mock, Path: Mock };
});

jest.mock('@react-native-community/datetimepicker', () => {
  const React = require('react');
  const { View } = require('react-native');
  return props => React.createElement(View, props);
});

jest.mock('react-native-reanimated', () => {
  const React = require('react');
  const { Image, Text, View } = require('react-native');
  const wrap = Component => React.forwardRef((props, ref) => React.createElement(Component, { ...props, ref }));
  const Animated = {
    View: wrap(View),
    Image: wrap(Image),
    Text: wrap(Text),
    createAnimatedComponent: Component => wrap(Component),
  };
  const pass = value => value;
  return {
    __esModule: true,
    default: Animated,
    useSharedValue: value => ({ value }),
    useAnimatedStyle: updater => updater(),
    withSpring: pass,
    withTiming: pass,
    withDelay: (_delay, value) => value,
    withSequence: (...values) => values[values.length - 1],
    withRepeat: animation => animation,
    cancelAnimation: () => undefined,
    runOnJS: fn => fn,
    Easing: { linear: pass, ease: pass, inOut: easing => easing, out: easing => easing, cubic: pass },
  };
});

jest.mock('react-native-get-random-values', () => {
  const { webcrypto } = require('crypto');
  if (typeof global.crypto !== 'object' || global.crypto == null) {
    global.crypto = {};
  }
  if (typeof global.crypto.getRandomValues !== 'function') {
    global.crypto.getRandomValues = array => webcrypto.getRandomValues(array);
  }
});
