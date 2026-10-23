import { classifySyncError } from '../src/domain/syncStatus';

test('sync errors are not all called offline', () => {
  const appCheck = Object.assign(new Error('AppCheck failed'), { code: 'permission-denied' });
  expect(classifySyncError(appCheck)).toBe('permission');
  expect(classifySyncError(new Error('Missing or insufficient permissions.'))).toBe('permission');
  expect(classifySyncError({ code: 'unauthenticated', message: 'sign in' })).toBe('permission');

  expect(classifySyncError(new Error('A network error has occurred'))).toBe('offline');
  expect(classifySyncError({ code: 'unavailable', message: 'backend' })).toBe('offline');

  expect(classifySyncError(new Error('ciphertext would not open'))).toBe('failed');
});
