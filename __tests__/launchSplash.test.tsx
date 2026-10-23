import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { Image, NativeModules, Text } from 'react-native';

jest.mock('../src/state/GifteezContext', () => {
  const { BUNDLED_SKINS } = jest.requireActual('../src/theme/skins');
  return {
    useGifteez: () => ({ colors: BUNDLED_SKINS.base }),
  };
});

import { BrandedLoading } from '../src/ui/ui';

test('the first launch frame is the splash mark, and the words fade in after a delay', async () => {
  const hide = jest.fn();
  NativeModules.GifteezSplash = { hide };
  jest.useFakeTimers();
  let renderer: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(<BrandedLoading />);
  });
  expect(renderer!.root.findAllByType(Image).length).toBe(1);
  expect(renderer!.root.findAllByType(Text).some(node => node.props.children === 'Wrapping things up…')).toBe(false);
  expect(renderer!.root.findAllByType(Text).some(node => node.props.children === 'Gifteez')).toBe(false);
  expect(hide).not.toHaveBeenCalled();
  await ReactTestRenderer.act(() => {
    renderer!.root.findByProps({ accessibilityRole: 'progressbar' }).props.onLayout();
  });
  expect(hide).not.toHaveBeenCalled();
  await ReactTestRenderer.act(() => {
    jest.advanceTimersByTime(16);
  });
  expect(hide).toHaveBeenCalledTimes(1);
  await ReactTestRenderer.act(() => {
    jest.advanceTimersByTime(480);
  });
  expect(renderer!.root.findAllByType(Text).some(node => node.props.children === 'Wrapping things up…')).toBe(true);
  jest.useRealTimers();
});
