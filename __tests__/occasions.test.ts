import { suggestIdeas } from '../src/domain/ideas';
import { defaultOccasionDate, occurrenceYear, yearSpentCents } from '../src/domain/logic';
import {
  dateIsEstimated,
  easterSunday,
  isOneTimeOccasion,
  nextOccasionDate,
  occasionLabel,
  occasionNeedsDate,
  planOccasion,
  presetFor,
  ruleDate,
  teacherAppreciationDay,
} from '../src/domain/occasions';
import { planReminders } from '../src/domain/reminders';
import { haptic } from '../src/platform/haptics';
import type { GiftRecord, Occasion, Person } from '../src/domain/types';

function person(id: string, name: string): Person {
  return { id, name, budgetCents: null, tags: [], imported: false, opened: true, createdAt: 1, updatedAt: 1 };
}

function occasion(patch: Partial<Occasion> & Pick<Occasion, 'type'>): Occasion {
  return {
    id: 'o',
    personId: 'a',
    month: 1,
    day: 1,
    updatedAt: 1,
    ...patch,
  };
}

test('a blank birthday stays blank instead of becoming today', () => {
  const today = new Date(2026, 8, 15);
  expect(planOccasion({ type: 'birthday', today })).toBe('need-date');
  expect(defaultOccasionDate('birthday', today)).toBeNull();
  expect(defaultOccasionDate('christmas', today)).toEqual({ month: 12, day: 25 });
  expect(planOccasion({ type: 'wedding', today })).toBe('need-date');
  expect(planOccasion({ type: 'custom', today })).toBe('need-name');
});

test('fixed and moving holidays land on the published day', () => {
  expect(easterSunday(2024)).toEqual({ month: 3, day: 31 });
  expect(easterSunday(2025)).toEqual({ month: 4, day: 20 });
  expect(easterSunday(2026)).toEqual({ month: 4, day: 5 });
  expect(ruleDate(presetFor('mothers-day')!.rule, 2026)).toEqual({ month: 5, day: 10 });
  expect(ruleDate(presetFor('fathers-day')!.rule, 2026)).toEqual({ month: 6, day: 21 });
  expect(ruleDate(presetFor('thanksgiving')!.rule, 2026)).toEqual({ month: 11, day: 26 });
  expect(teacherAppreciationDay(2026)).toEqual({ month: 5, day: 5 });
  expect(ruleDate(presetFor('eid-fitr')!.rule, 2026)).toEqual({ month: 3, day: 20 });
  expect(ruleDate(presetFor('eid-adha')!.rule, 2026)).toEqual({ month: 5, day: 26 });
  expect(ruleDate(presetFor('diwali')!.rule, 2026)).toEqual({ month: 11, day: 8 });
  expect(ruleDate(presetFor('lunar-new-year')!.rule, 2026)).toEqual({ month: 2, day: 17 });
  expect(ruleDate(presetFor('hanukkah')!.rule, 2026)).toEqual({ month: 12, day: 4 });
  expect(planOccasion({ type: 'christmas', today: new Date(2026, 0, 2) })).toMatchObject({ month: 12, day: 25, recurs: true });
  expect(planOccasion({ type: 'valentines', today: new Date(2026, 0, 2) })).toMatchObject({ month: 2, day: 14, recurs: true });
});

test('older weddings stay one-time and older birthdays keep rolling forward', () => {
  const wedding = occasion({ id: 'w', type: 'wedding', month: 6, day: 1, year: 2024 });
  const viewed = new Date(2026, 8, 1);
  expect(isOneTimeOccasion(wedding)).toBe(true);
  expect(occurrenceYear(wedding, viewed)).toBe(2024);
  expect(nextOccasionDate(wedding, viewed)).toBeNull();

  const birthday = occasion({ id: 'b', type: 'birthday', month: 6, day: 1 });
  expect(isOneTimeOccasion(birthday)).toBe(false);
  expect(occurrenceYear(birthday, viewed)).toBe(2027);
  expect(isOneTimeOccasion({ ...birthday, recurs: false })).toBe(true);
  expect(isOneTimeOccasion({ ...wedding, recurs: true })).toBe(false);
});

test('a one-time date without a year uses the next time that day arrives', () => {
  const today = new Date(2026, 0, 15);
  expect(planOccasion({ type: 'graduation', month: 6, day: 1, today })).toMatchObject({ year: 2026, recurs: false });
  expect(planOccasion({ type: 'graduation', month: 1, day: 1, today })).toMatchObject({ year: 2027, recurs: false });
  expect(planOccasion({ type: 'custom', label: 'Name day', month: 3, day: 4, recurs: true, today })).toMatchObject({
    month: 3,
    day: 4,
    recurs: true,
    label: 'Name day',
  });
});

test('a moving holiday outside the published table asks, and a saved day is only a fallback', () => {
  expect(occasionNeedsDate('hanukkah', new Date(2026, 0, 1))).toBe(false);
  expect(occasionNeedsDate('hanukkah', new Date(2030, 0, 1))).toBe(true);
  expect(occasionNeedsDate('birthday')).toBe(true);
  expect(occasionNeedsDate('christmas')).toBe(false);
  const stored = occasion({ type: 'hanukkah', month: 12, day: 4, recurs: true });
  expect(dateIsEstimated(stored, 2031)).toBe(true);
  const next = nextOccasionDate(stored, new Date(2031, 0, 1));
  expect(next?.getFullYear()).toBe(2031);
  expect(next?.getMonth()).toBe(11);
  expect(next?.getDate()).toBe(4);
});

test('reminders, labels, ideas, and spending follow any occasion', () => {
  const mothers = occasion({ type: 'mothers-day', month: 1, day: 1, recurs: true });
  const slots = planReminders({
    people: [person('a', 'Ada')],
    occasions: [mothers],
    now: new Date(2026, 4, 1, 8, 0, 0),
    enabled: true,
  });
  const day = slots.find(slot => slot.kind === 'day');
  expect(new Date(day?.at ?? 0).getMonth()).toBe(4);
  expect(new Date(day?.at ?? 0).getDate()).toBe(10);
  expect(day?.occasionName).toBe("Mother's Day");
  expect(occasionLabel({ type: 'custom', label: 'Name day' })).toBe('Name day');
  expect(occasionLabel({ type: 'quinceanera' })).toBe('Quinceañera');
  expect(occasionLabel({ type: 'eid-fitr' })).toBe('Eid al-Fitr');

  const ideas = suggestIdeas({
    personId: 'a',
    name: 'Ada',
    tags: ['home'],
    occasion: 'housewarming',
    feedback: [],
    salt: 1,
  });
  expect(ideas.some(idea => idea.includes('new place'))).toBe(true);
  const general = suggestIdeas({
    personId: 'a',
    name: 'Ada',
    tags: [],
    occasion: null,
    feedback: [],
    salt: 1,
  });
  expect(general.length).toBeGreaterThan(0);

  const gift: GiftRecord = {
    id: 'g',
    personId: 'a',
    occasionId: 'custom-1',
    year: 2026,
    title: 'Bowl',
    priceCents: 500,
    purchasedOn: '2026-04-02',
    updatedAt: 1,
  };
  expect(yearSpentCents('a', [gift], 2026)).toBe(500);
});

test('haptics stay quiet when the engine is missing', () => {
  const native = require('react-native-haptic-feedback') as { default: { trigger: jest.Mock } };
  native.default.trigger.mockImplementation(() => {
    throw new Error('no engine');
  });
  expect(() => haptic('success')).not.toThrow();
  expect(() => haptic('warning')).not.toThrow();
  expect(() => haptic('error')).not.toThrow();
  native.default.trigger.mockImplementation(() => undefined);
  haptic('success');
  expect(native.default.trigger).toHaveBeenCalledWith('notificationSuccess', {
    enableVibrateFallback: true,
    ignoreAndroidSystemSettings: false,
  });
});
