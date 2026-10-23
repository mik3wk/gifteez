import { classifyStartupError, startupCause } from '../src/domain/startup';
import { BUNDLED_SKINS, contrastRatio, withColorScheme, type ThemeColors } from '../src/theme/skins';

const MIN_CONTRAST = 4.5;
const MIN_BOUNDARY = 3;

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

test('every skin and scheme keeps text and boundaries readable', () => {
  const spring = require('../skins/spring.json').colors as ThemeColors;
  const summer = require('../skins/summer.json').colors as ThemeColors;
  const skins: Record<string, ThemeColors> = {
    ...BUNDLED_SKINS,
    spring,
    summer,
  };
  for (const colors of Object.values(skins)) {
    expect(contrastRatio(colors.text, colors.background)).toBeGreaterThanOrEqual(MIN_CONTRAST);
    expect(contrastRatio(colors.accentText, colors.accent)).toBeGreaterThanOrEqual(MIN_CONTRAST);
    for (const scheme of ['light', 'dark'] as const) {
      const resolved = withColorScheme(colors, scheme);
      expect(contrastRatio(resolved.text, resolved.background)).toBeGreaterThanOrEqual(MIN_CONTRAST);
      expect(contrastRatio(resolved.text, resolved.surface)).toBeGreaterThanOrEqual(MIN_CONTRAST);
      expect(contrastRatio(resolved.muted, resolved.background)).toBeGreaterThanOrEqual(MIN_CONTRAST);
      expect(contrastRatio(resolved.muted, resolved.surface)).toBeGreaterThanOrEqual(MIN_CONTRAST);
      expect(contrastRatio(resolved.onAccent, resolved.accent)).toBeGreaterThanOrEqual(MIN_CONTRAST);
      expect(contrastRatio(resolved.accentForeground, resolved.background)).toBeGreaterThanOrEqual(MIN_CONTRAST);
      expect(contrastRatio(resolved.accentForeground, resolved.surface)).toBeGreaterThanOrEqual(MIN_CONTRAST);
      expect(contrastRatio(resolved.dangerText, resolved.background)).toBeGreaterThanOrEqual(MIN_CONTRAST);
      expect(contrastRatio(resolved.dangerText, resolved.surface)).toBeGreaterThanOrEqual(MIN_CONTRAST);
      expect(contrastRatio(resolved.onDanger, resolved.danger)).toBeGreaterThanOrEqual(MIN_CONTRAST);
      expect(contrastRatio(resolved.onSuccess, resolved.success)).toBeGreaterThanOrEqual(MIN_CONTRAST);
      expect(contrastRatio(resolved.borderStrong, resolved.surface)).toBeGreaterThanOrEqual(MIN_BOUNDARY);
      expect(contrastRatio(resolved.text, resolved.banner)).toBeGreaterThanOrEqual(MIN_CONTRAST);
      expect(resolved.banner).not.toBe(resolved.background);
    }
    const dark = withColorScheme(colors, 'dark');
    expect(contrastRatio(dark.banner, dark.background)).toBeGreaterThan(1.8);
  }
  expect(withColorScheme(BUNDLED_SKINS.fall, 'dark').banner).not.toBe(withColorScheme(BUNDLED_SKINS.winter, 'dark').banner);
});
