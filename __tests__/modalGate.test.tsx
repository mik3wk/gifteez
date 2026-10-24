import React, { useState } from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { Modal, Text } from 'react-native';
import { claimModal, MODAL_BUSY, releaseModal, resetModalGate } from '../src/ui/modalGate';

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

const mockOpenPaywall = jest.fn();
const mockAddPerson = jest.fn(async () => 'new');
const mockAddOccasion = jest.fn(async () => 'occasion');
const mockLoadContacts = jest.fn(async () => [] as unknown[]);
const mockImportPeople = jest.fn(async () => 0);

jest.mock('../src/platform/importers', () => ({
  scanCalendar: jest.fn(async () => []),
}));

jest.mock('../src/state/GifteezContext', () => {
  const { emptySnapshot } = jest.requireActual('../src/domain/types');
  const { BUNDLED_SKINS } = jest.requireActual('../src/theme/skins');
  const snapshot = emptySnapshot(1);
  return {
    snapshot,
    useGifteez: () => ({
      snapshot,
      colors: BUNDLED_SKINS.base,
      openPaywall: mockOpenPaywall,
      addPerson: mockAddPerson,
      addOccasion: mockAddOccasion,
      loadContacts: mockLoadContacts,
      importPeople: mockImportPeople,
    }),
  };
});

import { CalendarReviewLink } from '../src/ui/CalendarReview';
import { ContactsReviewLink } from '../src/ui/ContactsReview';
import { Sheet } from '../src/ui/ui';

const { scanCalendar } = jest.requireMock('../src/platform/importers') as { scanCalendar: jest.Mock };
const { snapshot } = jest.requireMock('../src/state/GifteezContext') as {
  snapshot: {
    people: Array<Record<string, unknown>>;
    entitlementPaid: boolean;
    occasions: unknown[];
  };
};

function visibleModals(renderer: ReactTestRenderer.ReactTestRenderer) {
  return renderer.root.findAllByType(Modal).filter(node => node.props.visible);
}

function pressLabel(renderer: ReactTestRenderer.ReactTestRenderer, label: string) {
  const node = renderer.root.findAll(item => (
    typeof item.props?.onPress === 'function' && item.props.accessibilityLabel === label
  )).at(-1);
  if (!node) {
    throw new Error(`No pressable labeled ${label}`);
  }
  return node.props.onPress();
}

beforeEach(() => {
  resetModalGate();
  mockOpenPaywall.mockReset();
  mockAddPerson.mockClear();
  mockAddOccasion.mockClear();
  snapshot.people = [];
  snapshot.entitlementPaid = false;
  snapshot.occasions = [];
});

test('a second modal waits, and a log records the refusal to present it now', () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  const granted: string[] = [];
  const first = claimModal(() => granted.push('first'));
  const second = claimModal(() => granted.push('second'));
  expect(granted).toEqual(['first']);
  expect(warn).toHaveBeenCalledWith(MODAL_BUSY);
  releaseModal(first);
  expect(granted).toEqual(['first', 'second']);
  releaseModal(second);
  warn.mockRestore();
});

test('two sheets present one modal, then the waiting sheet', async () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  function Pair() {
    const [first, setFirst] = useState(true);
    return (
      <>
        <Sheet visible={first} title="First sheet" onClose={() => setFirst(false)}>{null}</Sheet>
        <Sheet visible title="Second sheet" onClose={() => undefined}>{null}</Sheet>
      </>
    );
  }
  let renderer: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(<Pair />);
  });
  const open = visibleModals(renderer!);
  expect(open).toHaveLength(1);
  expect(open[0].findAllByType(Text).map(node => node.props.children)).toContain('First sheet');
  expect(warn).toHaveBeenCalledWith(MODAL_BUSY);
  await ReactTestRenderer.act(() => {
    const close = visibleModals(renderer!).at(-1)?.findAll(item => (
      item.props?.accessibilityLabel === 'Close' && typeof item.props.onPress === 'function'
    )).at(-1);
    close?.props.onPress();
  });
  const next = visibleModals(renderer!);
  expect(next).toHaveLength(1);
  expect(next[0].findAllByType(Text).map(node => node.props.children)).toContain('Second sheet');
  warn.mockRestore();
});

test('calendar paywall waits until the review sheet has dismissed', async () => {
  snapshot.people = [0, 1].map(index => ({
    id: `p${index}`,
    name: `Person ${index}`,
    budgetCents: null,
    tags: [],
    imported: false,
    opened: true,
    createdAt: 1,
    updatedAt: 1,
  }));
  scanCalendar.mockResolvedValueOnce([
    { key: 'a', name: 'Ada', month: 6, day: 10, occasion: 'birthday', title: 'Ada', personId: null },
    { key: 'b', name: 'Grace', month: 12, day: 9, occasion: 'birthday', title: 'Grace', personId: null },
    { key: 'c', name: 'Lin', month: 1, day: 2, occasion: 'birthday', title: 'Lin', personId: null },
    { key: 'd', name: 'Maya', month: 3, day: 4, occasion: 'birthday', title: 'Maya', personId: null },
  ]);
  let renderer: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(<CalendarReviewLink button label="Find birthdays" />);
  });
  await ReactTestRenderer.act(async () => {
    await pressLabel(renderer!, 'Find birthdays');
  });
  await ReactTestRenderer.act(async () => {
    await pressLabel(renderer!, 'Continue');
  });
  const seen = new Set<string>();
  const boxes = renderer!.root.findAll(item => {
    if (item.props?.accessibilityRole !== 'checkbox' || item.props.disabled || typeof item.props.onPress !== 'function') {
      return false;
    }
    const label = String(item.props.accessibilityLabel);
    if (seen.has(label)) {
      return false;
    }
    seen.add(label);
    return true;
  });
  expect(boxes).toHaveLength(4);
  await ReactTestRenderer.act(() => {
    boxes.slice(0, 4).forEach(box => box.props.onPress());
  });
  let visibleWhenPaywall = -1;
  mockOpenPaywall.mockImplementation(() => {
    visibleWhenPaywall = visibleModals(renderer!).length;
  });
  await ReactTestRenderer.act(async () => {
    await pressLabel(renderer!, 'Add 4 people · 4 occasions');
  });
  expect(mockOpenPaywall).toHaveBeenCalledTimes(1);
  expect(visibleWhenPaywall).toBe(0);
  expect(mockAddPerson).not.toHaveBeenCalled();
});

test('contacts paywall waits until the review sheet has dismissed', async () => {
  snapshot.people = Array.from({ length: 5 }, (_, index) => ({
    id: `p${index}`,
    name: `Person ${index}`,
    budgetCents: null,
    tags: [],
    imported: false,
    opened: true,
    createdAt: 1,
    updatedAt: 1,
  }));
  mockLoadContacts.mockResolvedValueOnce([{ name: 'Ada Lovelace', budgetCents: null, tags: [] }]);
  mockImportPeople.mockClear();
  let renderer: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(<ContactsReviewLink link label="Import from contacts" />);
  });
  await ReactTestRenderer.act(async () => {
    await pressLabel(renderer!, 'Import from contacts');
  });
  const box = renderer!.root.findAll(item => item.props?.accessibilityRole === 'checkbox')[0];
  await ReactTestRenderer.act(() => {
    box.props.onPress();
  });
  let visibleWhenPaywall = -1;
  mockOpenPaywall.mockImplementation(() => {
    visibleWhenPaywall = visibleModals(renderer!).length;
  });
  await ReactTestRenderer.act(async () => {
    await pressLabel(renderer!, 'Add 1 person');
  });
  expect(mockOpenPaywall).toHaveBeenCalledTimes(1);
  expect(visibleWhenPaywall).toBe(0);
  expect(mockImportPeople).not.toHaveBeenCalled();
});
