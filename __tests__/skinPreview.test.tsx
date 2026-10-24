import React from 'react';
import TestRenderer from 'react-test-renderer';
import { Text } from 'react-native';
import { BUNDLED_SKINS, withColorScheme, type ResolvedColors } from '../src/theme/skins';

const mockPreview: { colors: ResolvedColors } = {
  colors: withColorScheme(BUNDLED_SKINS.base, 'light'),
};

jest.mock('../src/state/GifteezContext', () => ({
  useGifteez: () => ({
    colors: mockPreview.colors,
    skinPreview: 'base',
  }),
}));

import { useTheme } from '../src/theme/useTheme';

function Probe() {
  const { colors } = useTheme();
  return <Text>{`${colors.button}|${colors.pink}|${colors.accent}`}</Text>;
}

test('a screen sees different tokens when the skin changes', () => {
  const base = withColorScheme(BUNDLED_SKINS.base, 'light');
  const winter = withColorScheme(BUNDLED_SKINS.winter, 'light');
  const winterDark = withColorScheme(BUNDLED_SKINS.winter, 'dark');
  expect(base.button.toUpperCase()).toBe('#A93F55');
  expect(winter.button.toUpperCase()).toBe('#2F5D50');
  expect(winter.pink.toUpperCase()).toBe('#2F5D50');
  expect(winterDark.button.toUpperCase()).toBe('#9FCBBC');
  expect(winter.button).not.toBe(base.button);

  mockPreview.colors = base;
  let renderer: TestRenderer.ReactTestRenderer;
  TestRenderer.act(() => {
    renderer = TestRenderer.create(<Probe />);
  });
  expect(renderer!.root.findByType(Text).props.children).toBe(`${base.button}|${base.pink}|${base.accent}`);
  mockPreview.colors = winter;
  TestRenderer.act(() => {
    renderer!.update(<Probe />);
  });
  const next = renderer!.root.findByType(Text).props.children as string;
  expect(next).toBe(`${winter.button}|${winter.pink}|${winter.accent}`);
  expect(next.startsWith('#2F5D50')).toBe(true);
});
