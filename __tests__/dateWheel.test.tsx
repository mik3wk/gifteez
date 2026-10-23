import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { ScrollView } from 'react-native';
import { touch } from '../src/theme/tokens';

jest.mock('../src/state/GifteezContext', () => {
  const { BUNDLED_SKINS } = jest.requireActual('../src/theme/skins');
  return {
    useGifteez: () => ({
      colors: BUNDLED_SKINS.base,
      addOccasion: jest.fn(),
      notice: null,
      error: null,
    }),
  };
});

import { MonthDayField } from '../src/ui/DateField';
import { OccasionPicker } from '../src/ui/OccasionPicker';

const ROW = touch.minTarget;

function selectedLabels(renderer: ReactTestRenderer.ReactTestRenderer): string[] {
  return renderer.root
    .findAllByProps({ accessibilityRole: 'button' })
    .filter(node => node.props.accessibilityState?.selected)
    .map(node => String(node.props.accessibilityLabel));
}

function wheels(renderer: ReactTestRenderer.ReactTestRenderer) {
  return renderer.root.findAllByType(ScrollView);
}

test('scrolling the wheel selects the centered row, and a shorter month shortens the day', async () => {
  let month = '10';
  let day = '23';
  let renderer: ReactTestRenderer.ReactTestRenderer;
  function render() {
    return (
      <MonthDayField
        label="Date"
        month={month}
        day={day}
        year=""
        knowYear={false}
        onKnowYear={() => undefined}
        onChange={next => {
          month = next.month;
          day = next.day;
        }}
      />
    );
  }
  await ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(render());
  });
  const [monthWheel, dayWheel] = wheels(renderer!);
  expect(monthWheel.props.snapToInterval).toBe(ROW);
  expect(dayWheel.props.snapToInterval).toBe(ROW);
  expect(monthWheel.props.decelerationRate).toBe('fast');
  expect(dayWheel.props.decelerationRate).toBe('fast');
  expect(monthWheel.props.contentOffset).toEqual({ x: 0, y: 9 * ROW });
  expect(dayWheel.props.contentOffset).toEqual({ x: 0, y: 22 * ROW });
  expect(selectedLabels(renderer!)).toEqual(expect.arrayContaining(['October', '23']));

  await ReactTestRenderer.act(() => {
    dayWheel.props.onScrollEndDrag({
      nativeEvent: { contentOffset: { y: 25 * ROW }, velocity: { x: 0, y: 1.2 } },
    });
  });
  expect(day).toBe('23');

  await ReactTestRenderer.act(() => {
    dayWheel.props.onMomentumScrollEnd({ nativeEvent: { contentOffset: { x: 0, y: 24 * ROW } } });
  });
  await ReactTestRenderer.act(() => {
    renderer!.update(render());
  });
  expect(day).toBe('25');
  expect(selectedLabels(renderer!)).toEqual(expect.arrayContaining(['October', '25']));
  expect(selectedLabels(renderer!).includes('23')).toBe(false);

  const parked = wheels(renderer!)[1];
  const scrolled: Array<{ y: number; animated: boolean }> = [];
  (parked.instance as { scrollTo: (options: { y: number; animated: boolean }) => void }).scrollTo = options => {
    scrolled.push(options);
  };
  await ReactTestRenderer.act(() => {
    parked.props.onScrollEndDrag({
      nativeEvent: { contentOffset: { y: 24 * ROW + 7 }, velocity: { x: 0, y: 0 } },
    });
  });
  expect(day).toBe('25');
  expect(scrolled).toEqual([{ y: 24 * ROW, animated: true }]);

  await ReactTestRenderer.act(() => {
    wheels(renderer!)[1].props.onScrollEndDrag({
      nativeEvent: {
        contentOffset: { y: 24 * ROW },
        targetContentOffset: { y: 25 * ROW },
        velocity: { x: 0, y: 0 },
      },
    });
  });
  await ReactTestRenderer.act(() => {
    renderer!.update(render());
  });
  expect(day).toBe('26');
  expect(selectedLabels(renderer!)).toContain('26');

  const november = renderer!.root.findAllByProps({ accessibilityRole: 'button' }).find(node => node.props.accessibilityLabel === 'November');
  await ReactTestRenderer.act(() => {
    november?.props.onPress();
  });
  await ReactTestRenderer.act(() => {
    renderer!.update(render());
  });
  expect(month).toBe('11');
  expect(selectedLabels(renderer!)).toEqual(expect.arrayContaining(['November', '26']));

  month = '1';
  day = '31';
  await ReactTestRenderer.act(() => {
    renderer!.update(render());
  });
  await ReactTestRenderer.act(() => {
    wheels(renderer!)[0].props.onMomentumScrollEnd({ nativeEvent: { contentOffset: { x: 0, y: 3 * ROW } } });
  });
  await ReactTestRenderer.act(() => {
    renderer!.update(render());
  });
  expect(month).toBe('4');
  expect(day).toBe('30');
  expect(selectedLabels(renderer!)).toEqual(expect.arrayContaining(['April', '30']));
  expect(selectedLabels(renderer!).includes('31')).toBe(false);
});

test('add occasion opens on today, centered and highlighted, unless the preset has its own date', async () => {
  const today = new Date();
  const monthName = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][today.getMonth()];
  const day = String(today.getDate());
  let renderer: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(<OccasionPicker personId="p1" />);
  });
  expect(wheels(renderer!).length).toBe(0);
  const birthday = renderer!.root.findAllByProps({ accessibilityRole: 'button' }).find(node => node.props.accessibilityLabel === 'Birthday');
  await ReactTestRenderer.act(() => {
    birthday?.props.onPress();
  });
  const [monthWheel, dayWheel] = wheels(renderer!);
  expect(monthWheel.props.contentOffset.y).toBe(today.getMonth() * ROW);
  expect(dayWheel.props.contentOffset.y).toBe((today.getDate() - 1) * ROW);
  expect(selectedLabels(renderer!)).toEqual(expect.arrayContaining([monthName, day]));

  const christmas = renderer!.root.findAllByProps({ accessibilityRole: 'button' }).find(node => node.props.accessibilityLabel === 'Christmas');
  await ReactTestRenderer.act(() => {
    christmas?.props.onPress();
  });
  expect(wheels(renderer!).length).toBe(0);
});
