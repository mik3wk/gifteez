import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { Text } from 'react-native';

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
  useNavigation: () => ({ goBack: jest.fn(), setOptions: jest.fn(), getState: () => ({ index: 0, routes: [{ name: 'People' }] }) }),
  useRoute: () => ({ params: { personId: 'ada', sourcePersonId: 'ada2', sourceGroupId: 'there' } }),
  usePreventRemove: () => undefined,
}));

jest.mock('../src/state/GifteezContext', () => {
  const { emptySnapshot } = jest.requireActual('../src/domain/types');
  const { BUNDLED_SKINS } = jest.requireActual('../src/theme/skins');
  const snapshot = emptySnapshot(1);
  snapshot.profile.displayName = 'Ada';
  snapshot.profile.reminders = 'off';
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
  const setReminders = jest.fn();
  const shareBackup = jest.fn(async () => undefined);
  return {
    setReminders,
    shareBackup,
    useGifteez: () => ({
      snapshot,
      colors: BUNDLED_SKINS.base,
      exportBackup: () => '{"version":1}',
      shareBackup,
      pickBackup: jest.fn(async () => undefined),
      previewBackup: jest.fn(),
      restoreBackup: jest.fn(async () => 'ok'),
      appearance: 'system',
      setAppearance: jest.fn(async () => undefined),
      setReminders,
      buy: jest.fn(),
      restorePurchases: jest.fn(),
      storeProduct: null,
      storeReady: false,
      skinId: 'base',
      importText: jest.fn(async () => 0),
      importFromContacts: jest.fn(async () => 0),
      importFromCalendar: jest.fn(async () => 0),
      error: null,
      mergePeople: jest.fn(),
      sendEmail: jest.fn(),
      finishEmail: jest.fn(),
      sendPhone: jest.fn(),
      confirmPhone: jest.fn(),
    }),
  };
});

import { SettingsScreen } from '../src/screens/MoreScreens';
import { ConfirmHost } from '../src/ui/ui';

const { setReminders } = jest.requireMock('../src/state/GifteezContext') as {
  setReminders: jest.Mock;
};

test('settings shares a backup and labels reminders', async () => {
  const { shareBackup } = jest.requireMock('../src/state/GifteezContext') as {
    shareBackup: jest.Mock;
  };
  let renderer: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(
      <>
        <SettingsScreen />
        <ConfirmHost />
      </>,
    );
  });
  const exportButton = renderer!.root.findAllByProps({ accessibilityRole: 'button' }).find(node =>
    node.findAllByType(Text).some(item => item.props.children === 'Export backup'),
  );
  expect(exportButton).toBeDefined();
  await ReactTestRenderer.act(() => {
    exportButton?.props.onPress();
  });
  expect(shareBackup).toHaveBeenCalled();
  const copy = renderer!.root.findAllByType(Text).map(item => item.props.children);
  expect(copy).toEqual(expect.arrayContaining([
    'Export a copy before you replace this list.',
    'Read-only. Nothing is added until you pick people.',
    'Nothing is added until you choose.',
    'As an Amazon Associate, Gifteez earns from qualifying purchases.',
  ]));
  expect(renderer!.root.findAllByProps({ accessibilityLabel: 'Turn occasion reminders on or off' }).length).toBeGreaterThan(0);
  const reminders = renderer!.root.findByProps({ accessibilityLabel: 'Turn occasion reminders on or off' });
  await ReactTestRenderer.act(() => {
    reminders.props.onPress();
  });
  expect(setReminders).toHaveBeenCalledWith(true);
});
