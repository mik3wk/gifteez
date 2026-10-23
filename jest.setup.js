// The package declares `let module`, which collides with Jest's CommonJS
// wrapper. Node already provides crypto.getRandomValues, which is what
// @noble uses in tests. On device, index.js loads the real module first.
jest.mock('react-native-haptic-feedback', () => ({
  default: { trigger: jest.fn() },
}));

jest.mock('react-native-get-random-values', () => {
  const { webcrypto } = require('crypto');
  if (typeof global.crypto !== 'object' || global.crypto == null) {
    global.crypto = {};
  }
  if (typeof global.crypto.getRandomValues !== 'function') {
    global.crypto.getRandomValues = array => webcrypto.getRandomValues(array);
  }
});
