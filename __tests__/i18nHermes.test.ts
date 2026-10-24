import { deviceLocale, formatDate, formatLongDate, formatMoney, t, timeGreeting } from '../src/i18n';

function withIntl<K extends keyof typeof Intl>(key: K, value: unknown, run: () => void) {
  const descriptor = Object.getOwnPropertyDescriptor(Intl, key);
  Object.defineProperty(Intl, key, { configurable: true, writable: true, value });
  try {
    run();
  } finally {
    if (descriptor) {
      Object.defineProperty(Intl, key, descriptor);
    } else {
      delete Intl[key];
    }
  }
}

test('the greeting is morning from 5, afternoon from 12, evening from 17, and hi late at night', () => {
  expect(timeGreeting(new Date(2026, 0, 1, 4, 30))).toBe('Hi');
  expect(timeGreeting(new Date(2026, 0, 1, 22, 0))).toBe('Hi');
  expect(timeGreeting(new Date(2026, 0, 1, 5, 0))).toBe('Good morning');
  expect(timeGreeting(new Date(2026, 0, 1, 11, 59))).toBe('Good morning');
  expect(timeGreeting(new Date(2026, 0, 1, 12, 0))).toBe('Good afternoon');
  expect(timeGreeting(new Date(2026, 0, 1, 16, 59))).toBe('Good afternoon');
  expect(timeGreeting(new Date(2026, 0, 1, 17, 0))).toBe('Good evening');
  expect(timeGreeting(new Date(2026, 0, 1, 21, 59))).toBe('Good evening');
});

test('whole dollar amounts can drop the trailing cents', () => {
  expect(formatMoney(0, 'en-US', 'USD', true)).toBe('$0');
  expect(formatMoney(20000, 'en-US', 'USD', true)).toBe('$200');
  expect(formatMoney(150, 'en-US', 'USD', true)).toBe('$1.50');
});

test('plural copy works when Hermes has no Intl.PluralRules', () => {
  withIntl('PluralRules', undefined, () => {
    expect(typeof Intl.PluralRules).not.toBe('function');
    expect(t('fairness.gifts', { count: 1 })).toBe('1 gift');
    expect(t('fairness.gifts', { count: 0 })).toBe('0 gifts');
    expect(t('fairness.gifts', { count: 2 })).toBe('2 gifts');
    expect(t('people.inDays', { count: 1 })).toBe('in 1 day');
    expect(t('people.daysUnit', { count: 3 })).toBe('days');
    expect(t('importFlow.added', { count: 1 })).toContain('person');
    expect(t('people.inDays', { count: 8 })).toContain('8');
  });
});

test('plural copy survives a PluralRules constructor that throws', () => {
  withIntl('PluralRules', function PluralRules() {
    throw new Error('unsupported');
  }, () => {
    expect(t('person.cloudLeft', { count: 1 })).toBe('1 cloud refresh left');
    expect(t('person.cloudLeft', { count: 4 })).toBe('4 cloud refreshes left');
  });
});

test('money and dates do not need currency style, month names, or RelativeTimeFormat', () => {
  withIntl('NumberFormat', function NumberFormat() {
    throw new Error('currency unsupported');
  }, () => {
    expect(formatMoney(999, 'en-US', 'USD')).toBe('$9.99');
    expect(formatMoney(0, 'en-US', 'USD')).toBe('$0.00');
    expect(formatMoney(5000, 'en-GB', 'USD')).toContain('50');
    expect(formatMoney(5000, 'en-GB', 'USD')).not.toContain('£');
    expect(formatMoney(20000, 'en-US', 'USD', true)).toBe('$200');
  });
  withIntl('DateTimeFormat', function DateTimeFormat() {
    throw new Error('locale data missing');
  }, () => {
    expect(formatDate(new Date(2026, 11, 25), 'en-US')).toBe('Dec 25');
    expect(formatLongDate(new Date(2026, 2, 14), 'en-US')).toBe('Mar 14, 2026');
    expect(deviceLocale()).toBeTruthy();
  });
  withIntl('RelativeTimeFormat', undefined, () => {
    expect(formatDate(new Date(2026, 0, 2), 'en-US')).toContain('2');
    expect(t('people.inDays', { count: 2 })).toBe('in 2 days');
  });
});
