import 'react-native-get-random-values';
import { randomBytes } from '@noble/ciphers/utils.js';

test('noble randomBytes can read crypto.getRandomValues', () => {
  const cryptoObj = (globalThis as { crypto?: { getRandomValues?: unknown } }).crypto;
  expect(typeof cryptoObj?.getRandomValues).toBe('function');
  const bytes = randomBytes(16);
  expect(bytes).toBeInstanceOf(Uint8Array);
  expect(bytes.length).toBe(16);
});
