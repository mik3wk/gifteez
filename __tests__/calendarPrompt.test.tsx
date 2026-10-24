import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { Platform, Text } from 'react-native';

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

jest.mock('../src/platform/importers', () => ({
  scanCalendar: jest.fn(async () => []),
}));

jest.mock('../src/state/GifteezContext', () => {
  const { emptySnapshot } = jest.requireActual('../src/domain/types');
  const { BUNDLED_SKINS } = jest.requireActual('../src/theme/skins');
  return {
    useGifteez: () => ({
      snapshot: emptySnapshot(1),
      colors: BUNDLED_SKINS.base,
      openPaywall: jest.fn(),
      addPerson: jest.fn(),
      addOccasion: jest.fn(),
    }),
  };
});

import { CalendarReviewLink } from '../src/ui/CalendarReview';

const { scanCalendar } = jest.requireMock('../src/platform/importers') as {
  scanCalendar: jest.Mock;
};

const sentence = 'iOS asks for full access to read events. Gifteez only reads birthdays and anniversaries and never changes your calendar.';

function labeled(renderer: ReactTestRenderer.ReactTestRenderer, label: string) {
  return renderer.root.findAllByProps({ accessibilityRole: 'button' }).find(node =>
    node.findAllByType(Text).some(item => item.props.children === label)
    || node.props.accessibilityLabel === label,
  );
}

test('iOS explains calendar access before the system prompt', async () => {
  const previous = Platform.OS;
  Platform.OS = 'ios';
  scanCalendar.mockClear();
  let renderer: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(<CalendarReviewLink label="Find birthdays in Calendar" />);
  });
  await ReactTestRenderer.act(() => {
    labeled(renderer!, 'Find birthdays in Calendar')?.props.onPress();
  });
  const copy = renderer!.root.findAllByType(Text).map(node => node.props.children);
  expect(copy).toContain(sentence);
  expect(scanCalendar).not.toHaveBeenCalled();
  await ReactTestRenderer.act(async () => {
    await labeled(renderer!, 'Continue')?.props.onPress();
  });
  expect(scanCalendar).toHaveBeenCalledTimes(1);
  Platform.OS = previous;
});
