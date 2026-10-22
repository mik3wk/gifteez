import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { describeIncomingLink, joinConfirmModel } from '../src/app/incomingLink';
import { keyToString, randomKey } from '../src/crypto/crypto';

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

jest.mock('../src/state/GifteezContext', () => {
  const { BUNDLED_SKINS } = jest.requireActual('../src/theme/skins');
  return { useGifteez: () => ({ colors: BUNDLED_SKINS.base }) };
});

import { JoinConfirmView } from '../src/screens/MoreScreens';

test('an invite link asks to confirm and does not join by itself', () => {
  const key = keyToString(randomKey());
  const app = `gifteez://join/g1?i=i1#k=${key}`;
  const web = `https://gifteez.app/join/g1?i=i1#k=${key}`;
  expect(describeIncomingLink(app)).toBe('confirm-invite');
  expect(describeIncomingLink(web)).toBe('confirm-invite');
  expect(describeIncomingLink('https://gifteez.app/__/auth/action?mode=signIn&oobCode=abc')).toBe('email');
  expect(describeIncomingLink('https://gifteez.app/')).toBe('ignore');
});

test('the confirm screen names the preview and falls back to Shared list', () => {
  const named = joinConfirmModel({ label: 'Mike, Sam & Jo', emoji: '🎁', color: '#1F6B4A' });
  expect(named.question).toBe('Join Mike, Sam & Jo?');
  expect(named.emoji).toBe('🎁');
  expect(named.color).toBe('#1F6B4A');
  expect(named.joinLabel).toBe('Join Mike, Sam & Jo');
  expect(named.cancelLabel).toBe('Cancel joining');
  const pending = joinConfirmModel(null);
  expect(pending.question).toBe('Join Shared list?');
  expect(pending.emoji).toBe('');
  expect(joinConfirmModel({ label: '   ', emoji: '🎀', color: '#C4622D' }).question).toBe('Join Shared list?');
});

test('Join and Cancel are labeled and only Join starts the join', async () => {
  const onJoin = jest.fn();
  const onCancel = jest.fn();
  let renderer: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(
      <JoinConfirmView
        model={joinConfirmModel({ label: 'Mike, Sam & Jo', emoji: '🎁', color: '#1F6B4A' })}
        onJoin={onJoin}
        onCancel={onCancel}
      />,
    );
  });
  const labeled = (label: string) => {
    const match = renderer!.root
      .findAllByProps({ accessibilityLabel: label })
      .find(node => node.props.accessibilityRole);
    if (!match) {
      throw new Error(`No accessible node for ${label}`);
    }
    return match;
  };
  const question = labeled('Join Mike, Sam & Jo?');
  const join = labeled('Join Mike, Sam & Jo');
  const cancel = labeled('Cancel joining');
  expect(question.props.accessibilityRole).toBe('header');
  expect(join.props.accessibilityRole).toBe('button');
  expect(cancel.props.accessibilityRole).toBe('button');
  await ReactTestRenderer.act(() => {
    cancel.props.onPress();
  });
  expect(onCancel).toHaveBeenCalledTimes(1);
  expect(onJoin).not.toHaveBeenCalled();
  await ReactTestRenderer.act(() => {
    join.props.onPress();
  });
  expect(onJoin).toHaveBeenCalledTimes(1);
});
