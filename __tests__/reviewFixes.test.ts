import { classifyStartupError, startupCause } from '../src/domain/startup';
import { BUNDLED_SKINS, contrastRatio, type ThemeColors } from '../src/theme/skins';

const MIN_CONTRAST = 4.5;

test('startup failures keep the cause and name config, network, or disabled auth', () => {
  const missing = Object.assign(new Error("No Firebase App '[DEFAULT]' has been created"), { code: 'app/no-app' });
  expect(classifyStartupError(missing)).toBe('config');
  expect(startupCause(missing)).toContain('No Firebase App');

  const offline = Object.assign(new Error('A network error has occurred'), { code: 'auth/network-request-failed' });
  expect(classifyStartupError(offline)).toBe('network');
  expect(startupCause(offline)).toContain('auth/network-request-failed');

  const disabled = Object.assign(
    new Error('This operation is not allowed. You must enable this service in the console.'),
    { code: 'auth/operation-not-allowed' },
  );
  expect(classifyStartupError(disabled)).toBe('auth');
  expect(startupCause(disabled)).toContain('auth/operation-not-allowed');

  expect(classifyStartupError(new Error('keychain refused'))).toBe('unknown');
  expect(startupCause(new Error('keychain refused'))).toBe('keychain refused');
});

test('every skin keeps text on the background and on the accent at 4.5:1', () => {
  const spring = require('../skins/spring.json').colors as ThemeColors;
  const summer = require('../skins/summer.json').colors as ThemeColors;
  const skins: Record<string, ThemeColors> = {
    ...BUNDLED_SKINS,
    spring,
    summer,
  };
  for (const [name, colors] of Object.entries(skins)) {
    expect(contrastRatio(colors.text, colors.background)).toBeGreaterThanOrEqual(MIN_CONTRAST);
    expect(contrastRatio(colors.accentText, colors.accent)).toBeGreaterThanOrEqual(MIN_CONTRAST);
    expect(name).toBeTruthy();
  }
});
