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

jest.mock('@react-native-community/datetimepicker', () => 'DateTimePicker');

jest.mock('../src/state/GifteezContext', () => {
  const { emptySnapshot } = jest.requireActual('../src/domain/types');
  const { BUNDLED_SKINS } = jest.requireActual('../src/theme/skins');
  const snapshot = emptySnapshot(1);
  snapshot.profile.reminders = 'on';
  snapshot.profile.reminderLeadDays = 7;
  snapshot.profile.reminderHour = 9;
  snapshot.profile.reminderMinute = 0;
  return {
    useGifteez: () => ({
      snapshot,
      colors: BUNDLED_SKINS.base,
      setReminders: jest.fn(),
      updateProfile: jest.fn(async () => undefined),
    }),
  };
});

import { ReminderBellSheet } from '../src/ui/ui';

test('an enabled bell sheet shows the real schedule with Change and Done', () => {
  let renderer: ReactTestRenderer.ReactTestRenderer;
  ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(<ReminderBellSheet visible onClose={() => undefined} />);
  });
  const copy = renderer!.root.findAllByType(Text).map(node => node.props.children).filter(item => typeof item === 'string');
  expect(copy).toContain('Reminders are on · 7 days before at 9:00 AM');
  expect(copy).toContain('Change');
  expect(copy).toContain('Done');
  expect(copy).not.toContain('Remind me');
});
