import React from 'react';
import { Text } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';

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
  const { emptySnapshot } = jest.requireActual('../src/domain/types');
  const { BUNDLED_SKINS } = jest.requireActual('../src/theme/skins');
  const snapshot = emptySnapshot(1);
  snapshot.profile.defaultBudgetCents = 7500;
  const loadContacts = jest.fn();
  const importPeople = jest.fn(async () => 1);
  const openPaywall = jest.fn();
  return {
    snapshot,
    loadContacts,
    importPeople,
    openPaywall,
    useGifteez: () => ({
      snapshot,
      colors: BUNDLED_SKINS.base,
      loadContacts,
      importPeople,
      openPaywall,
    }),
  };
});

import { ContactsReviewLink } from '../src/ui/ContactsReview';

const mocked = jest.requireMock('../src/state/GifteezContext') as {
  snapshot: { people: Array<{ id: string; name: string; deleted?: boolean; budgetCents: null; tags: string[]; imported: boolean; opened: boolean; createdAt: number; updatedAt: number }>; entitlementPaid: boolean };
  loadContacts: jest.Mock;
  importPeople: jest.Mock;
  openPaywall: jest.Mock;
};

function pressLabeled(renderer: ReactTestRenderer.ReactTestRenderer, label: string) {
  const node = renderer.root.findAll(item => (
    typeof item.props?.onPress === 'function'
    && item.props.accessibilityLabel === label
  )).at(-1);
  if (!node) {
    throw new Error(`No pressable labeled ${label}`);
  }
  return node.props.onPress();
}

function checkboxes(renderer: ReactTestRenderer.ReactTestRenderer) {
  const seen = new Set<string>();
  return renderer.root.findAll(item => {
    if (item.props?.accessibilityRole !== 'checkbox' || typeof item.props.onPress !== 'function') {
      return false;
    }
    const label = String(item.props.accessibilityLabel);
    if (seen.has(label)) {
      return false;
    }
    seen.add(label);
    return true;
  });
}

test('contacts stay unticked until the chosen ones fit the free slots', async () => {
  mocked.snapshot.people = [];
  mocked.snapshot.entitlementPaid = false;
  mocked.loadContacts.mockResolvedValueOnce([
    { name: 'Ada Lovelace', budgetCents: null, tags: [], month: 12, day: 10 },
    { name: 'Grace Hopper', budgetCents: null, tags: [] },
  ]);
  let renderer: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(<ContactsReviewLink link label="Import from contacts" />);
  });
  await ReactTestRenderer.act(async () => {
    await pressLabeled(renderer!, 'Import from contacts');
  });
  const boxes = checkboxes(renderer!);
  expect(boxes.map(box => box.props.accessibilityLabel)).toEqual(['Ada Lovelace · 12/10', 'Grace Hopper']);
  expect(boxes.map(box => box.props.accessibilityState.checked)).toEqual([false, false]);
  const copy = renderer!.root.findAllByType(Text).map(item => item.props.children);
  expect(copy).toEqual(expect.arrayContaining(['5 of 5 free left']));
  expect(mocked.importPeople).not.toHaveBeenCalled();
  await ReactTestRenderer.act(() => {
    boxes[0].props.onPress();
  });
  expect(renderer!.root.findAllByType(Text).map(item => item.props.children)).toEqual(
    expect.arrayContaining(['4 of 5 free left']),
  );
  await ReactTestRenderer.act(() => {
    boxes[1].props.onPress();
  });
  expect(renderer!.root.findAllByType(Text).map(item => item.props.children)).toEqual(
    expect.arrayContaining(['3 of 5 free left']),
  );
  await ReactTestRenderer.act(() => {
    boxes[1].props.onPress();
  });
  expect(renderer!.root.findAllByType(Text).map(item => item.props.children)).toEqual(
    expect.arrayContaining(['4 of 5 free left']),
  );
  await ReactTestRenderer.act(async () => {
    await pressLabeled(renderer!, 'Add 1 person');
  });
  expect(mocked.openPaywall).not.toHaveBeenCalled();
  expect(mocked.importPeople).toHaveBeenCalledWith([
    { name: 'Ada Lovelace', budgetCents: 7500, tags: [], month: 12, day: 10 },
  ]);
});

test('picking more people than the free slots opens the paywall and adds nobody', async () => {
  mocked.snapshot.entitlementPaid = false;
  mocked.snapshot.people = Array.from({ length: 5 }, (_, index) => ({
    id: `p${index}`,
    name: `Person ${index}`,
    budgetCents: null,
    tags: [],
    imported: false,
    opened: true,
    createdAt: 1,
    updatedAt: 1,
  }));
  mocked.loadContacts.mockResolvedValueOnce([
    { name: 'Ada Lovelace', budgetCents: null, tags: [] },
  ]);
  mocked.importPeople.mockClear();
  mocked.openPaywall.mockClear();
  let renderer: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(<ContactsReviewLink link label="Import from contacts" />);
  });
  await ReactTestRenderer.act(async () => {
    await pressLabeled(renderer!, 'Import from contacts');
  });
  expect(renderer!.root.findAllByType(Text).map(item => item.props.children)).toEqual(
    expect.arrayContaining(['0 of 5 free left']),
  );
  const box = checkboxes(renderer!)[0];
  await ReactTestRenderer.act(() => {
    box.props.onPress();
  });
  await ReactTestRenderer.act(async () => {
    await pressLabeled(renderer!, 'Add 1 person');
  });
  expect(mocked.openPaywall).toHaveBeenCalled();
  expect(mocked.importPeople).not.toHaveBeenCalled();
});
