/**
 * @format
 */

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

import App from '../App';

test('placeholder Firebase config shows a dev message instead of crashing', async () => {
  let renderer: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(<App />);
  });
  const tree = JSON.stringify(renderer!.toJSON());
  expect(tree).toContain('Firebase config');
  expect(tree).not.toContain('NewAppScreen');
});
