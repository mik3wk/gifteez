import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { Text } from 'react-native';
import { ideaCacheId } from '../src/domain/ideas';

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

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: jest.fn(), setOptions: jest.fn(), replace: jest.fn(), getState: () => ({ index: 0, routes: [{ name: 'People' }] }) }),
  useRoute: () => ({ params: { personId: 'ada' } }),
  usePreventRemove: () => undefined,
}));

const mockCallable = jest.fn();

jest.mock('../src/state/GifteezContext', () => {
  const { emptySnapshot } = jest.requireActual('../src/domain/types');
  const { BUNDLED_SKINS } = jest.requireActual('../src/theme/skins');
  const { ideaCacheId: cacheId } = jest.requireActual('../src/domain/ideas');
  const snapshot = emptySnapshot(1);
  snapshot.people = [{
    id: 'ada',
    name: 'Ada',
    budgetCents: 20000,
    tags: ['books'],
    imported: false,
    opened: true,
    createdAt: 1,
    updatedAt: 1,
  }];
  snapshot.ideas = [{
    id: cacheId('ada', 'general', 'on-device', ['books']),
    personId: 'ada',
    occasionKey: 'general',
    ideas: ['Wool socks'],
    source: 'on-device',
    salt: 0,
    generatedAt: 1,
    updatedAt: 1,
  }];
  return {
    mockCallable,
    useGifteez: () => ({
      snapshot,
      colors: BUNDLED_SKINS.base,
      focusPerson: jest.fn(async () => undefined),
      savePerson: jest.fn(async () => undefined),
      removePerson: jest.fn(async () => undefined),
      saveIdeaFor: jest.fn(async () => undefined),
      unsaveIdea: jest.fn(async () => undefined),
      toast: jest.fn(),
      logGift: jest.fn(async () => true),
      vote: jest.fn(async () => undefined),
      refreshIdeas: jest.fn(async () => undefined),
      cloudIdeas: (personId: string) => mockCallable(personId),
      cloudRemaining: {},
      updateGift: jest.fn(async () => true),
      deleteGift: jest.fn(async () => undefined),
    }),
  };
});

import { PersonScreen } from '../src/screens/PersonScreen';

const failures = [
  Object.assign(new Error('person'), { code: 'functions/not-found' }),
  new Error('Network request failed'),
  Object.assign(new Error('timeout'), { code: 'timeout' }),
  Object.assign(new Error('App Check token rejected'), { code: 'functions/unauthenticated' }),
];

function buttonLabeled(renderer: ReactTestRenderer.ReactTestRenderer, label: string) {
  return renderer.root.findAllByProps({ accessibilityRole: 'button' }).find(node =>
    node.findAllByType(Text).some(item => item.props.children === label),
  );
}

test('a rejected cloud ideas callable shows retry and keeps on-device ideas', async () => {
  let renderer: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(<PersonScreen />);
  });
  expect(ideaCacheId('ada', 'general', 'on-device', ['books'])).toBe('ada:general:on-device:books:::v4');
  for (const failure of failures) {
    mockCallable.mockRejectedValueOnce(failure);
    const ask = buttonLabeled(renderer!, 'Ask for more ideas') ?? buttonLabeled(renderer!, 'Try again');
    expect(ask).toBeDefined();
    await ReactTestRenderer.act(async () => {
      await ask?.props.onPress();
    });
    const copy = renderer!.root.findAllByType(Text).map(node => node.props.children).flat();
    expect(copy).toContain("Couldn't get ideas right now. The ideas already on this phone are still here. Try again.");
    expect(copy).toContain('Wool socks');
    expect(copy).not.toContain('Cloud ideas are unavailable right now.');
    expect(buttonLabeled(renderer!, 'Try again')).toBeDefined();
  }
  expect(mockCallable).toHaveBeenCalledTimes(failures.length);
  expect(mockCallable).toHaveBeenCalledWith('ada');
});
