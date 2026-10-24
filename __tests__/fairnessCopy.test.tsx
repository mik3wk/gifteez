import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { Text } from 'react-native';
import type { CircleSection } from '../src/domain/circles';

jest.mock('react-native-safe-area-context', () => {
  const ReactActual = require('react');
  const { View } = require('react-native');
  const inset = { top: 0, right: 0, bottom: 0, left: 0 };
  return {
    SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
    SafeAreaView: ({ children }: { children: React.ReactNode }) => ReactActual.createElement(View, null, children),
    useSafeAreaInsets: () => inset,
  };
});

jest.mock('../src/state/GifteezContext', () => {
  const { BUNDLED_SKINS } = jest.requireActual('../src/theme/skins');
  return {
    useGifteez: () => ({ colors: BUNDLED_SKINS.base }),
  };
});

import { CircleFairnessCard } from '../src/ui/stationery';
import { circleSheetAction } from '../src/screens/FairnessScreen';

const quiet: CircleSection = {
  circleId: 'kids',
  name: 'Kids',
  status: 'even',
  behind: [],
  members: [
    { personId: 'leo', name: 'Leo', yearSpentCents: 0, budgetCents: 20000, behindCents: 0 },
    { personId: 'maya', name: 'Maya', yearSpentCents: 0, budgetCents: 20000, behindCents: 0 },
  ],
};

const matched: CircleSection = {
  ...quiet,
  members: quiet.members.map(member => ({ ...member, yearSpentCents: 4000 })),
};

function textOf(renderer: ReactTestRenderer.ReactTestRenderer): string[] {
  return renderer.root.findAllByType(Text).map(node => node.props.children).filter(item => typeof item === 'string');
}

test('zero spend explains that comparison starts after a gift', () => {
  let renderer: ReactTestRenderer.ReactTestRenderer;
  ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(
      <CircleFairnessCard section={quiet} money={cents => `$${cents / 100}`} />,
    );
  });
  const copy = textOf(renderer!);
  expect(copy).toContain("Nothing bought yet. You'll see how everyone compares once you log a gift.");
  expect(copy).not.toContain('Balanced');
  expect(copy.join(' ')).not.toContain('Nicely done');
});

test('matching spend still says everyone matches', () => {
  let renderer: ReactTestRenderer.ReactTestRenderer;
  ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(
      <CircleFairnessCard section={matched} money={cents => `$${cents / 100}`} />,
    );
  });
  const copy = textOf(renderer!);
  expect(copy).toContain('Everyone matches. Nicely done.');
  expect(copy).toContain('Balanced');
});

test('a new circle confirms with Create circle', () => {
  expect(circleSheetAction('new')).toBe('Create circle');
  expect(circleSheetAction('kids')).toBe('Save changes');
  expect(circleSheetAction(null)).toBe('Save changes');
});
