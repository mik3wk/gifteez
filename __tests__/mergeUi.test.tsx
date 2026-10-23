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

import type { DuplicateHint } from '../src/domain/merge';
import { DuplicateOffers, MergeChecklist } from '../src/screens/mergeUi';

test('merge checklist exposes each gift as a checkbox and toggles it', async () => {
  const onToggle = jest.fn();
  let renderer: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(
      <MergeChecklist gifts={[{ id: 'g1', title: 'Scarf' }]} checked={{ g1: true }} onToggle={onToggle} />,
    );
  });
  const box = renderer!.root.findAllByProps({ accessibilityLabel: 'Share Scarf with the group' })
    .find(node => node.props.accessibilityRole === 'checkbox');
  expect(box?.props.accessibilityState).toEqual({ checked: true });
  await ReactTestRenderer.act(() => {
    box?.props.onPress();
  });
  expect(onToggle).toHaveBeenCalledWith('g1');
});

test('a join duplicate offer can be reviewed or dismissed and does not merge on its own', async () => {
  const offer: DuplicateHint = {
    targetPersonId: 'ada',
    targetGroupId: 'group',
    sourcePersonId: 'wife',
    sourceGroupId: 'solo',
    sourceName: 'Ada',
    targetName: 'Ada',
    sourceListName: 'Mine',
    reason: 'name',
  };
  const onReview = jest.fn();
  const onDismiss = jest.fn();
  let renderer: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(
      <DuplicateOffers offers={[offer]} onReview={onReview} onDismiss={onDismiss} />,
    );
  });
  const review = renderer!.root.findAllByProps({ accessibilityLabel: 'Review merging Ada into Ada' })
    .find(node => node.props.accessibilityRole === 'button');
  const dismiss = renderer!.root.findAllByProps({ accessibilityLabel: 'Keep Ada and Ada separate' })
    .find(node => node.props.accessibilityRole === 'button');
  expect(JSON.stringify(renderer!.toJSON())).toContain('Ada on Mine looks like Ada here.');
  await ReactTestRenderer.act(() => {
    review?.props.onPress();
    dismiss?.props.onPress();
  });
  expect(onReview).toHaveBeenCalledWith(offer);
  expect(onDismiss).toHaveBeenCalledWith(offer);
  expect(onReview).toHaveBeenCalledTimes(1);
});
