import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { Share, Text } from 'react-native';

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
  useNavigation: () => ({ goBack: jest.fn(), setOptions: jest.fn() }),
  useRoute: () => ({ params: { personId: 'ada', sourcePersonId: 'ada2', sourceGroupId: 'there' } }),
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
  const deleteAccount = jest.fn();
  return {
    setReminders,
    deleteAccount,
    useGifteez: () => ({
      snapshot,
      colors: BUNDLED_SKINS.base,
      exportText: () => 'exported',
      setReminders,
      deleteAccount,
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

import { MergeScreen } from '../src/screens/MergeScreen';
import { SettingsScreen } from '../src/screens/MoreScreens';
import { ConfirmHost } from '../src/ui/ui';

const { setReminders, deleteAccount } = jest.requireMock('../src/state/GifteezContext') as {
  setReminders: jest.Mock;
  deleteAccount: jest.Mock;
};

test('settings keeps export until an account exists, and labels reminders and deletion', async () => {
  const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: Share.sharedAction, activityType: undefined });
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
    node.findAllByType(Text).some(item => item.props.children === 'Export list'),
  );
  expect(exportButton).toBeDefined();
  await ReactTestRenderer.act(() => {
    exportButton?.props.onPress();
  });
  expect(share).not.toHaveBeenCalled();
  expect(renderer!.root.findAllByProps({ accessibilityLabel: 'Turn occasion reminders on or off' }).length).toBeGreaterThan(0);
  const reminders = renderer!.root.findByProps({ accessibilityLabel: 'Turn occasion reminders on or off' });
  await ReactTestRenderer.act(() => {
    reminders.props.onPress();
  });
  expect(setReminders).toHaveBeenCalledWith(true);
  const remove = renderer!.root.findByProps({ accessibilityLabel: 'Delete this account' });
  await ReactTestRenderer.act(() => {
    remove.props.onPress();
  });
  const confirm = renderer!.root.findByProps({ accessibilityLabel: 'Confirm account deletion' });
  await ReactTestRenderer.act(() => {
    confirm.props.onPress();
  });
  expect(deleteAccount).toHaveBeenCalled();
  share.mockRestore();
});

test('merge states that the other copy stays until the save, and that undo exists', async () => {
  let renderer: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(<MergeScreen />);
  });
  const tree = JSON.stringify(renderer!.toJSON());
  expect(tree).toContain('removes the other copy after it saves');
  expect(tree).toContain('You can undo it from the person');
});
