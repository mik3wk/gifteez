import React from 'react';
import ReactTestRenderer from 'react-test-renderer';

jest.mock('react-native-safe-area-context', () => {
  const ReactActual = require('react');
  const { View } = require('react-native');
  const inset = { top: 0, right: 0, bottom: 0, left: 0 };
  return {
    SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
    SafeAreaView: ({ children }: { children: React.ReactNode }) =>
      ReactActual.createElement(View, null, children),
    useSafeAreaInsets: () => inset,
  };
});

jest.mock('../src/state/GifteezContext', () => {
  const { BUNDLED_SKINS } = jest.requireActual('../src/theme/skins');
  return { useGifteez: () => ({ colors: BUNDLED_SKINS.base }) };
});

import { StartupScreen } from '../src/screens/StartupScreen';
import { screenTopInset } from '../src/ui/ui';

test('screen top inset is skipped when a stack header is already showing', () => {
  expect(screenTopInset(undefined, 47)).toBe(47);
  expect(screenTopInset(0, 47)).toBe(47);
  expect(screenTopInset(56, 47)).toBe(0);
});

test('the startup screen names the cause and retries', async () => {
  const onRetry = jest.fn();
  let renderer: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(
      <StartupScreen
        kind="auth"
        detail="auth/operation-not-allowed: Anonymous sign-in is disabled."
        onRetry={onRetry}
      />,
    );
  });
  const title = renderer!.root.findAllByProps({ accessibilityLabel: 'Gifteez could not start' })
    .find(node => node.props.accessibilityRole === 'header');
  const retry = renderer!.root.findAllByProps({ accessibilityLabel: 'Retry starting Gifteez' })
    .find(node => node.props.accessibilityRole === 'button');
  expect(title).toBeTruthy();
  expect(JSON.stringify(renderer!.toJSON())).toContain('Anonymous sign-in is off, so cloud ideas cannot start.');
  expect(JSON.stringify(renderer!.toJSON())).toContain('auth/operation-not-allowed');
  await ReactTestRenderer.act(() => {
    retry?.props.onPress();
  });
  expect(onRetry).toHaveBeenCalledTimes(1);
});
