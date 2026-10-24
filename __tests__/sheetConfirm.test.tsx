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

jest.mock('../src/state/GifteezContext', () => {
  const { BUNDLED_SKINS } = jest.requireActual('../src/theme/skins');
  return {
    useGifteez: () => ({
      colors: BUNDLED_SKINS.base,
      notice: null,
      error: null,
    }),
  };
});

import { Button, ConfirmHost, Sheet, confirmDestructive } from '../src/ui/ui';

test('a confirm opened from a sheet stays in that sheet and cancel leaves it usable', async () => {
  let answer: boolean | null = null;
  let renderer: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(
      <>
        <ConfirmHost />
        <Sheet visible onClose={() => undefined}>
          <Button
            label="Remove person"
            onPress={() => {
              const pending = confirmDestructive('Remove Marie?', 'They leave this list.', 'Remove person');
              pending.then(value => {
                answer = value;
              }).catch(() => undefined);
              return pending;
            }}
          />
        </Sheet>
      </>,
    );
  });
  const remove = renderer!.root.findAllByProps({ accessibilityRole: 'button' }).find(node =>
    node.findAllByType(Text).some(item => item.props.children === 'Remove person'),
  );
  expect(remove).toBeDefined();
  await ReactTestRenderer.act(() => {
    remove?.props.onPress();
  });
  const titles = renderer!.root.findAllByType(Text).filter(node => node.props.children === 'Remove Marie?');
  expect(titles).toHaveLength(1);
  await ReactTestRenderer.act(async () => {
    await new Promise<void>(resolve => {
      setTimeout(resolve, 350);
    });
  });
  const whileOpen = renderer!.root.findAllByProps({ accessibilityRole: 'button' }).find(node =>
    node.findAllByType(Text).some(item => item.props.children === 'Remove person'),
  );
  expect(whileOpen?.props.accessibilityState.busy).toBe(false);
  const hiddenSheet = renderer!.root.findAll(node =>
    node.props?.accessibilityElementsHidden === true
    && node.props?.importantForAccessibility === 'no-hide-descendants'
    && node.findAllByType(Text).some(item => item.props.children === 'Remove person'),
  );
  expect(hiddenSheet.length).toBeGreaterThan(0);
  const cancel = renderer!.root.findAllByProps({ accessibilityRole: 'button' }).find(node =>
    node.findAllByType(Text).some(item => item.props.children === 'Cancel'),
  );
  expect(cancel).toBeDefined();
  await ReactTestRenderer.act(async () => {
    await cancel?.props.onPress();
  });
  expect(answer).toBe(false);
  const again = renderer!.root.findAllByProps({ accessibilityRole: 'button' }).find(node =>
    node.findAllByType(Text).some(item => item.props.children === 'Remove person'),
  );
  expect(again).toBeDefined();
  await ReactTestRenderer.act(() => {
    again?.props.onPress();
  });
  expect(renderer!.root.findAllByType(Text).filter(node => node.props.children === 'Remove Marie?')).toHaveLength(1);
});

function labeled(renderer: ReactTestRenderer.ReactTestRenderer, label: string) {
  return renderer.root.findAllByProps({ accessibilityRole: 'button' }).find(node =>
    node.findAllByType(Text).some(item => item.props.children === label)
    || node.props.accessibilityLabel === label,
  );
}

test('a dirty sheet asks before closing, and a clean sheet closes', async () => {
  const onClose = jest.fn();
  let renderer: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(
      <Sheet visible dirty title="Details" onClose={onClose}>
        <Text>Name</Text>
      </Sheet>,
    );
  });
  expect(renderer!.root.findAllByType(Text).some(node => node.props.children === 'Done')).toBe(false);
  await ReactTestRenderer.act(() => {
    labeled(renderer!, 'Close')?.props.onPress();
  });
  expect(onClose).not.toHaveBeenCalled();
  expect(renderer!.root.findAllByType(Text).some(node => node.props.children === 'Discard changes?')).toBe(true);
  await ReactTestRenderer.act(async () => {
    await labeled(renderer!, 'Cancel')?.props.onPress();
  });
  expect(onClose).not.toHaveBeenCalled();
  await ReactTestRenderer.act(() => {
    labeled(renderer!, 'Close')?.props.onPress();
  });
  await ReactTestRenderer.act(async () => {
    await labeled(renderer!, 'Discard')?.props.onPress();
  });
  expect(onClose).toHaveBeenCalledTimes(1);

  const cleanClose = jest.fn();
  await ReactTestRenderer.act(() => {
    renderer!.unmount();
  });
  await ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(
      <Sheet visible title="Details" onClose={cleanClose}>
        <Text>Name</Text>
      </Sheet>,
    );
  });
  await ReactTestRenderer.act(() => {
    labeled(renderer!, 'Close')?.props.onPress();
  });
  expect(cleanClose).toHaveBeenCalledTimes(1);
  expect(renderer!.root.findAllByType(Text).some(node => node.props.children === 'Discard changes?')).toBe(false);
});
