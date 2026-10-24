import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { commonDates, occasionLabel } from '../src/domain/occasions';
import { formatDate } from '../src/i18n';

jest.mock('../src/state/GifteezContext', () => {
  const { BUNDLED_SKINS } = jest.requireActual('../src/theme/skins');
  return {
    useGifteez: () => ({
      colors: BUNDLED_SKINS.base,
      addOccasion: jest.fn(),
      snapshot: { people: [] },
      notice: null,
      error: null,
    }),
  };
});

import { MonthDayField } from '../src/ui/DateField';
import { OccasionPicker } from '../src/ui/OccasionPicker';

function chipLabel(type: string, date: Date): string {
  return `${occasionLabel({ type })} · ${formatDate(date)}`;
}

function buttons(renderer: ReactTestRenderer.ReactTestRenderer) {
  return renderer.root.findAllByProps({ accessibilityRole: 'button' });
}

function press(renderer: ReactTestRenderer.ReactTestRenderer, label: string) {
  const node = buttons(renderer).find(item => item.props.accessibilityLabel === label);
  node?.props.onPress();
}

function spinners(renderer: ReactTestRenderer.ReactTestRenderer) {
  return renderer.root.findAllByProps({ display: 'spinner', mode: 'date' }, { deep: false });
}

function includeYear(renderer: ReactTestRenderer.ReactTestRenderer) {
  return renderer.root.findAllByProps(
    { accessibilityRole: 'switch', accessibilityLabel: 'Include year' },
    { deep: false },
  );
}

test('the native spinner, holiday chips, and Include year replace the wheels', async () => {
  let month = '';
  let day = '';
  let year = '';
  let knowYear = false;
  let renderer: ReactTestRenderer.ReactTestRenderer;
  function render() {
    return (
      <MonthDayField
        label="Date"
        month={month}
        day={day}
        year={year}
        knowYear={knowYear}
        onKnowYear={value => {
          knowYear = value;
        }}
        onChange={next => {
          month = next.month;
          day = next.day;
          year = next.year;
        }}
      />
    );
  }
  await ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(render());
  });
  const picker = renderer!.root.findByProps({ display: 'spinner' });
  expect(picker.props.mode).toBe('date');
  const holidays = commonDates();
  const labels = holidays.map(item => chipLabel(item.type, item.date));
  expect(buttons(renderer!).map(node => node.props.accessibilityLabel)).toEqual(expect.arrayContaining(labels));

  const christmas = holidays.find(item => item.type === 'christmas')!;
  await ReactTestRenderer.act(() => {
    press(renderer!, chipLabel(christmas.type, christmas.date));
  });
  await ReactTestRenderer.act(() => {
    renderer!.update(render());
  });
  expect(month).toBe(String(christmas.date.getMonth() + 1));
  expect(day).toBe(String(christmas.date.getDate()));
  expect(year).toBe('');
  const selected = buttons(renderer!).find(node => node.props.accessibilityState?.selected);
  expect(selected?.props.accessibilityLabel).toBe(chipLabel(christmas.type, christmas.date));

  await ReactTestRenderer.act(() => {
    picker.props.onValueChange({}, new Date(2026, 1, 14));
  });
  await ReactTestRenderer.act(() => {
    renderer!.update(render());
  });
  expect(month).toBe('2');
  expect(day).toBe('14');
  expect(year).toBe('');

  const includeYear = renderer!.root.findByProps({ accessibilityRole: 'switch', accessibilityLabel: 'Include year' });
  await ReactTestRenderer.act(() => {
    includeYear.props.onPress();
  });
  await ReactTestRenderer.act(() => {
    renderer!.update(render());
  });
  expect(knowYear).toBe(true);
  expect(year).toBe('2026');

  await ReactTestRenderer.act(() => {
    renderer!.root.findByProps({ accessibilityRole: 'switch', accessibilityLabel: 'Include year' }).props.onPress();
  });
  await ReactTestRenderer.act(() => {
    renderer!.update(render());
  });
  expect(knowYear).toBe(false);
  expect(year).toBe('');
});

test('a birthday uses the spinner, and Christmas keeps its own date', async () => {
  let renderer: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(<OccasionPicker personId="p1" />);
  });
  expect(spinners(renderer!)).toHaveLength(0);

  await ReactTestRenderer.act(() => {
    press(renderer!, 'Birthday');
  });
  expect(spinners(renderer!)).toHaveLength(1);
  expect(includeYear(renderer!)).toHaveLength(1);
  expect(buttons(renderer!).map(node => node.props.accessibilityLabel)).toEqual(
    expect.arrayContaining(commonDates().map(item => chipLabel(item.type, item.date))),
  );

  await ReactTestRenderer.act(() => {
    press(renderer!, 'Christmas');
  });
  expect(spinners(renderer!)).toHaveLength(0);
  expect(includeYear(renderer!)).toHaveLength(0);
});
