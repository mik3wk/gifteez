import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { Image, Text } from 'react-native';

jest.mock('../src/state/GifteezContext', () => {
  const { BUNDLED_SKINS } = jest.requireActual('../src/theme/skins');
  return {
    useGifteez: () => ({ colors: BUNDLED_SKINS.base }),
  };
});

import { BrandedLoading } from '../src/ui/ui';

test('the first launch frame is the splash mark, and the words fade in after a delay', async () => {
  jest.useFakeTimers();
  let renderer: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(<BrandedLoading />);
  });
  expect(renderer!.root.findAllByType(Image).length).toBe(1);
  expect(renderer!.root.findAllByType(Text).some(node => node.props.children === 'Wrapping things up…')).toBe(false);
  expect(renderer!.root.findAllByType(Text).some(node => node.props.children === 'Gifteez')).toBe(false);
  await ReactTestRenderer.act(() => {
    jest.advanceTimersByTime(480);
  });
  expect(renderer!.root.findAllByType(Text).some(node => node.props.children === 'Wrapping things up…')).toBe(true);
  jest.useRealTimers();
});
