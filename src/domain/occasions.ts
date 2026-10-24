import { t } from '../i18n';
import type { Occasion } from './types';

type MonthDay = { month: number; day: number };

type Rule =
  | { kind: 'fixed'; month: number; day: number }
  | { kind: 'nth'; month: number; weekday: number; n: number }
  | { kind: 'easter' }
  | { kind: 'teacher' }
  | { kind: 'table'; dates: Record<number, [number, number]> }
  | { kind: 'ask' };

export type OccasionPreset = {
  id: string;
  group: 'holiday' | 'celebration' | 'life';
  featured?: boolean;
  yearly: boolean;
  rule: Rule;
  /** Shown under the name when the date is calculated or can shift a day. */
  note?: string;
};

const HANUKKAH: Record<number, [number, number]> = {
  2024: [12, 25],
  2025: [12, 14],
  2026: [12, 4],
  2027: [12, 24],
  2028: [12, 12],
};

const LUNAR_NEW_YEAR: Record<number, [number, number]> = {
  2024: [2, 10],
  2025: [1, 29],
  2026: [2, 17],
  2027: [2, 6],
  2028: [1, 26],
  2029: [2, 13],
  2030: [2, 3],
  2031: [1, 23],
  2032: [2, 11],
  2033: [1, 31],
  2034: [2, 19],
  2035: [2, 8],
};

/** Umm al-Qura and Drik Panchang dates. Local moon sighting can move these by a day. */
const DIWALI: Record<number, [number, number]> = {
  2024: [11, 1],
  2025: [10, 21],
  2026: [11, 8],
  2027: [10, 29],
  2028: [10, 17],
  2029: [11, 5],
  2030: [10, 26],
};

const EID_FITR: Record<number, [number, number]> = {
  2024: [4, 10],
  2025: [3, 30],
  2026: [3, 20],
  2027: [3, 9],
  2028: [2, 26],
  2029: [2, 14],
  2030: [2, 4],
};

const EID_ADHA: Record<number, [number, number]> = {
  2024: [6, 16],
  2025: [6, 6],
  2026: [5, 26],
  2027: [5, 16],
  2028: [5, 4],
  2029: [4, 23],
  2030: [4, 13],
};

const MOON_NOTE = 'occasionNotes.moon';

export const OCCASION_PRESETS: OccasionPreset[] = [
  { id: 'birthday', group: 'celebration', featured: true, yearly: true, rule: { kind: 'ask' } },
  { id: 'christmas', group: 'holiday', featured: true, yearly: true, rule: { kind: 'fixed', month: 12, day: 25 } },
  { id: 'anniversary', group: 'celebration', featured: true, yearly: true, rule: { kind: 'ask' } },
  { id: 'valentines', group: 'holiday', featured: true, yearly: true, rule: { kind: 'fixed', month: 2, day: 14 } },
  { id: 'mothers-day', group: 'holiday', featured: true, yearly: true, rule: { kind: 'nth', month: 5, weekday: 0, n: 2 }, note: 'occasionNotes.mothersDay' },
  { id: 'fathers-day', group: 'holiday', featured: true, yearly: true, rule: { kind: 'nth', month: 6, weekday: 0, n: 3 }, note: 'occasionNotes.fathersDay' },
  { id: 'hanukkah', group: 'holiday', featured: true, yearly: true, rule: { kind: 'table', dates: HANUKKAH }, note: 'occasionNotes.hanukkah' },
  { id: 'thanksgiving', group: 'holiday', featured: true, yearly: true, rule: { kind: 'nth', month: 11, weekday: 4, n: 4 }, note: 'occasionNotes.thanksgiving' },
  { id: 'new-year', group: 'holiday', featured: true, yearly: true, rule: { kind: 'fixed', month: 1, day: 1 } },
  { id: 'wedding', group: 'celebration', featured: true, yearly: false, rule: { kind: 'ask' } },
  { id: 'graduation', group: 'life', featured: true, yearly: false, rule: { kind: 'ask' } },
  { id: 'just-because', group: 'life', featured: true, yearly: false, rule: { kind: 'ask' } },
  { id: 'easter', group: 'holiday', yearly: true, rule: { kind: 'easter' }, note: 'occasionNotes.easter' },
  { id: 'lunar-new-year', group: 'holiday', yearly: true, rule: { kind: 'table', dates: LUNAR_NEW_YEAR } },
  { id: 'diwali', group: 'holiday', yearly: true, rule: { kind: 'table', dates: DIWALI }, note: MOON_NOTE },
  { id: 'eid-fitr', group: 'holiday', yearly: true, rule: { kind: 'table', dates: EID_FITR }, note: MOON_NOTE },
  { id: 'eid-adha', group: 'holiday', yearly: true, rule: { kind: 'table', dates: EID_ADHA }, note: MOON_NOTE },
  { id: 'halloween', group: 'holiday', yearly: true, rule: { kind: 'fixed', month: 10, day: 31 } },
  { id: 'independence-day', group: 'holiday', yearly: true, rule: { kind: 'fixed', month: 7, day: 4 }, note: 'occasionNotes.independence' },
  { id: 'st-patricks', group: 'holiday', yearly: true, rule: { kind: 'fixed', month: 3, day: 17 } },
  { id: 'kwanzaa', group: 'holiday', yearly: true, rule: { kind: 'fixed', month: 12, day: 26 } },
  { id: 'teacher', group: 'celebration', yearly: true, rule: { kind: 'teacher' }, note: 'occasionNotes.teacher' },
  { id: 'secret-santa', group: 'celebration', yearly: true, rule: { kind: 'ask' } },
  { id: 'engagement', group: 'celebration', yearly: false, rule: { kind: 'ask' } },
  { id: 'bridal-shower', group: 'celebration', yearly: false, rule: { kind: 'ask' } },
  { id: 'baby-shower', group: 'celebration', yearly: false, rule: { kind: 'ask' } },
  { id: 'birth', group: 'celebration', yearly: false, rule: { kind: 'ask' } },
  { id: 'housewarming', group: 'celebration', yearly: false, rule: { kind: 'ask' } },
  { id: 'bar-mitzvah', group: 'celebration', yearly: false, rule: { kind: 'ask' } },
  { id: 'quinceanera', group: 'celebration', yearly: false, rule: { kind: 'ask' } },
  { id: 'communion', group: 'celebration', yearly: false, rule: { kind: 'ask' } },
  { id: 'retirement', group: 'life', yearly: false, rule: { kind: 'ask' } },
  { id: 'promotion', group: 'life', yearly: false, rule: { kind: 'ask' } },
  { id: 'get-well', group: 'life', yearly: false, rule: { kind: 'ask' } },
  { id: 'sympathy', group: 'life', yearly: false, rule: { kind: 'ask' } },
  { id: 'thank-you', group: 'life', yearly: false, rule: { kind: 'ask' } },
];

const BY_ID = new Map(OCCASION_PRESETS.map(preset => [preset.id, preset]));

export function presetFor(type: string): OccasionPreset | undefined {
  return BY_ID.get(type);
}

export function occasionLabel(occasion: { type: string; label?: string }): string {
  if (occasion.type === 'custom') {
    return occasion.label?.trim() || t('occasions.custom');
  }
  const key = `occasions.${occasion.type}`;
  const named = t(key);
  if (named !== key) {
    return named;
  }
  return occasion.label?.trim() || occasion.type;
}

/** Older weddings have no recurs flag and stay one-time. Every other saved occasion repeats. */
export function isOneTimeOccasion(occasion: Pick<Occasion, 'type' | 'recurs'>): boolean {
  if (typeof occasion.recurs === 'boolean') {
    return !occasion.recurs;
  }
  return occasion.type === 'wedding';
}

export function easterSunday(year: number): MonthDay {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return { month, day };
}

function nthWeekday(year: number, month: number, weekday: number, n: number): MonthDay {
  const first = new Date(year, month - 1, 1).getDay();
  const day = 1 + ((weekday - first + 7) % 7) + (n - 1) * 7;
  return { month, day };
}

/** Tuesday of the first Sunday-through-Saturday week that sits entirely in May. */
export function teacherAppreciationDay(year: number): MonthDay {
  const first = new Date(year, 4, 1).getDay();
  const sunday = 1 + ((7 - first) % 7);
  return { month: 5, day: sunday + 2 };
}

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function makeDate(month: number, day: number, year: number): Date {
  if (month === 2 && day === 29 && !isLeapYear(year)) {
    return new Date(year, 1, 28);
  }
  return new Date(year, month - 1, day);
}

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

export function ruleDate(rule: Rule, year: number): MonthDay | null {
  if (rule.kind === 'fixed') {
    return { month: rule.month, day: rule.day };
  }
  if (rule.kind === 'nth') {
    return nthWeekday(year, rule.month, rule.weekday, rule.n);
  }
  if (rule.kind === 'easter') {
    return easterSunday(year);
  }
  if (rule.kind === 'teacher') {
    return teacherAppreciationDay(year);
  }
  if (rule.kind === 'table') {
    const found = rule.dates[year];
    return found ? { month: found[0], day: found[1] } : null;
  }
  return null;
}

function storedDate(occasion: Pick<Occasion, 'month' | 'day'>): MonthDay | null {
  if (!Number.isInteger(occasion.month) || !Number.isInteger(occasion.day)) {
    return null;
  }
  if (occasion.month < 1 || occasion.day < 1) {
    return null;
  }
  return { month: occasion.month, day: occasion.day };
}

/** Calculated dates win. A saved month and day is the fallback when a moving date is not published yet. */
export function monthDayFor(occasion: Pick<Occasion, 'type' | 'month' | 'day'>, year: number): MonthDay | null {
  const preset = presetFor(occasion.type);
  if (preset && preset.rule.kind !== 'ask') {
    const computed = ruleDate(preset.rule, year);
    if (computed) {
      return computed;
    }
  }
  return storedDate(occasion);
}

export function dateIsEstimated(occasion: Pick<Occasion, 'type' | 'month' | 'day'>, year: number): boolean {
  const preset = presetFor(occasion.type);
  if (!preset || preset.rule.kind !== 'table') {
    return false;
  }
  return ruleDate(preset.rule, year) == null && storedDate(occasion) != null;
}

export function nextOccasionDate(occasion: Occasion, today: Date): Date | null {
  if (isOneTimeOccasion(occasion)) {
    const year = occasion.year != null && occasion.year > 0 ? occasion.year : today.getFullYear();
    const md = monthDayFor(occasion, year);
    if (!md) {
      return null;
    }
    const date = makeDate(md.month, md.day, year);
    if (startOfDay(date) < startOfDay(today)) {
      return null;
    }
    return date;
  }
  const year = today.getFullYear();
  for (const candidate of [year, year + 1]) {
    const md = monthDayFor(occasion, candidate);
    if (!md) {
      continue;
    }
    const date = makeDate(md.month, md.day, candidate);
    if (startOfDay(date) >= startOfDay(today)) {
      return date;
    }
  }
  return null;
}

const COMMON_DATE_TYPES = ['christmas', 'valentines', 'mothers-day', 'fathers-day'] as const;

/** Next Christmas, Valentine's Day, Mother's Day, or Father's Day. */
export function commonDates(today = new Date()): Array<{ type: string; date: Date }> {
  return COMMON_DATE_TYPES.flatMap(type => {
    const date = nextOccasionDate({ id: type, personId: '', type, month: 1, day: 1, updatedAt: 0 }, today);
    return date ? [{ type, date }] : [];
  });
}

/** Wheel default: a preset's own date, or today when the date is one you choose. */
export function openingMonthDay(type: string, today = new Date()): { month: number; day: number } {
  const preset = presetFor(type);
  if (preset && preset.rule.kind !== 'ask') {
    const year = today.getFullYear();
    const computed = ruleDate(preset.rule, year) ?? ruleDate(preset.rule, year + 1);
    if (computed) {
      return computed;
    }
  }
  return { month: today.getMonth() + 1, day: today.getDate() };
}

export function occasionNeedsDate(type: string, today = new Date()): boolean {
  if (type === 'custom') {
    return true;
  }
  const preset = presetFor(type);
  if (!preset || preset.rule.kind === 'ask') {
    return true;
  }
  const year = today.getFullYear();
  return ruleDate(preset.rule, year) == null && ruleDate(preset.rule, year + 1) == null;
}

export type PlannedOccasion = {
  month: number;
  day: number;
  year?: number;
  recurs: boolean;
  label?: string;
};

/** A blank birthday stays blank. Fixed and calculated occasions fill themselves. */
export function planOccasion(input: {
  type: string;
  month?: number;
  day?: number;
  year?: number;
  label?: string;
  recurs?: boolean;
  today: Date;
}): PlannedOccasion | 'need-date' | 'need-name' {
  const type = input.type === 'custom' || presetFor(input.type) ? input.type : 'custom';
  const label = input.label?.trim() || undefined;
  if (type === 'custom' && !label) {
    return 'need-name';
  }
  const preset = presetFor(type);
  const recurs = typeof input.recurs === 'boolean' ? input.recurs : (preset?.yearly ?? false);
  let month = input.month;
  let day = input.day;
  if (!(month && day)) {
    const year = input.today.getFullYear();
    const computed = preset && preset.rule.kind !== 'ask'
      ? ruleDate(preset.rule, year) ?? ruleDate(preset.rule, year + 1)
      : null;
    if (computed) {
      month = computed.month;
      day = computed.day;
    }
  }
  if (!month || !day) {
    return 'need-date';
  }
  let year = input.year && input.year > 0 ? input.year : undefined;
  if (!recurs && year == null) {
    const thisYear = makeDate(month, day, input.today.getFullYear());
    year = startOfDay(thisYear) >= startOfDay(input.today) ? input.today.getFullYear() : input.today.getFullYear() + 1;
  }
  return { month, day, year, recurs, label };
}
