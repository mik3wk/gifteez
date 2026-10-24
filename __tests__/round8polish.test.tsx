import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { ScrollView, Text } from 'react-native';
import { personBackLabel } from '../src/app/navigation';
import { householdCrestLetter } from '../src/domain/monogram';

const mockGoBack = jest.fn();
let mockGivenName: string | undefined;

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
  useNavigation: () => ({
    goBack: mockGoBack,
    canGoBack: () => true,
    setOptions: jest.fn(),
    navigate: jest.fn(),
    dispatch: jest.fn(),
    replace: jest.fn(),
    getState: () => ({ index: 1, routes: [{ name: 'Fairness' }, { name: 'Person' }] }),
  }),
  useRoute: () => ({ params: { personId: 'ada', section: 'ideas' } }),
  usePreventRemove: () => undefined,
  CommonActions: {
    reset: (state: unknown) => ({ type: 'RESET', payload: state }),
    goBack: () => ({ type: 'GO_BACK' }),
  },
}));

jest.mock('../src/state/GifteezContext', () => {
  const { emptySnapshot } = jest.requireActual('../src/domain/types');
  const { BUNDLED_SKINS } = jest.requireActual('../src/theme/skins');
  const snapshot = emptySnapshot(1);
  snapshot.profile.householdName = 'Our gifts';
  snapshot.profile.onboarded = true;
  snapshot.people = [{
    id: 'ada',
    name: 'Ada',
    budgetCents: null,
    tags: [],
    imported: false,
    opened: true,
    createdAt: 1,
    updatedAt: 1,
  }];
  const api = {
    snapshot,
    colors: BUNDLED_SKINS.base,
    pickBackup: jest.fn(async () => undefined),
    resumePersonId: null,
    clearResumePerson: jest.fn(),
    openPaywall: jest.fn(),
    updateProfile: jest.fn(async () => undefined),
    setReminders: jest.fn(async () => undefined),
    focusPerson: jest.fn(async () => undefined),
    savePerson: jest.fn(async () => undefined),
    removePerson: jest.fn(async () => undefined),
    saveIdeaFor: jest.fn(async () => undefined),
    unsaveIdea: jest.fn(async () => undefined),
    toast: jest.fn(),
    logGift: jest.fn(async () => true),
    vote: jest.fn(async () => undefined),
    moreLike: jest.fn(async () => undefined),
    refreshIdeas: jest.fn(async () => undefined),
    cloudIdeas: jest.fn(async () => undefined),
    cloudRemaining: {},
    updateGift: jest.fn(async () => true),
    deleteGift: jest.fn(async () => undefined),
    setPersonCircle: jest.fn(async () => undefined),
  };
  return {
    useGifteez: () => {
      snapshot.profile.givenName = mockGivenName;
      return api;
    },
  };
});

import { FirstOpenScreen } from '../src/screens/FirstOpen';
import { HomeScreen } from '../src/screens/HomeScreen';
import { PersonScreen } from '../src/screens/PersonScreen';

function textOf(node: ReactTestRenderer.ReactTestInstance): string[] {
  return node.findAllByType(Text).map(item => item.props.children).filter((item): item is string => typeof item === 'string');
}

test('Want ideas from Fairness goes back to Fairness', async () => {
  expect(personBackLabel('Fairness')).toBe('Fairness');
  expect(personBackLabel('Home')).toBe('Home');
  expect(personBackLabel('People')).toBe('People');
  let renderer: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(<PersonScreen />);
  });
  const back = renderer!.root.findAllByProps({ accessibilityRole: 'button' }).find(node =>
    node.findAllByType(Text).some(item => item.props.children === '‹ Fairness'),
  );
  expect(back).toBeDefined();
  mockGoBack.mockClear();
  await ReactTestRenderer.act(async () => {
    back?.props.onPress();
  });
  expect(mockGoBack).toHaveBeenCalledTimes(1);
});

test('welcome fills the lower half and keeps the first-person button pinned', () => {
  let renderer: ReactTestRenderer.ReactTestRenderer;
  ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(<FirstOpenScreen />);
  });
  const scroll = renderer!.root.findByType(ScrollView);
  const inScroll = textOf(scroll);
  const all = textOf(renderer!.root);
  expect(inScroll).toEqual(expect.arrayContaining([
    'Remember every date',
    'Ideas that fit',
    'Keep it fair',
  ]));
  expect(inScroll).not.toContain('Add your first person');
  expect(all).toContain('Add your first person');
  expect(all).toContain('Restore from a backup');
});

test('the home crest uses a first name, and otherwise shows no letter', () => {
  expect(householdCrestLetter(undefined)).toBe('');
  expect(householdCrestLetter('  ')).toBe('');
  expect(householdCrestLetter('Maya')).toBe('M');
  expect(householdCrestLetter('mary ann')).toBe('M');
  mockGivenName = undefined;
  let renderer: ReactTestRenderer.ReactTestRenderer;
  ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(<HomeScreen />);
  });
  const letters = textOf(renderer!.root);
  expect(letters).toContain('Our gifts');
  expect(letters).not.toContain('O');
  expect(letters).not.toContain('G');

  mockGivenName = 'Maya';
  ReactTestRenderer.act(() => {
    renderer!.update(<HomeScreen />);
  });
  expect(textOf(renderer!.root)).toContain('M');
  expect(textOf(renderer!.root)).not.toContain('O');
});
