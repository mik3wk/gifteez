import { NativeModules, Platform } from 'react-native';
import enUS from './en-US.json';

type Vars = Record<string, string | number>;

function lookup(key: string): string | null {
  const parts = key.split('.');
  let node: unknown = enUS;
  for (const part of parts) {
    if (node && typeof node === 'object' && part in node) {
      node = (node as Record<string, unknown>)[part];
    } else {
      return null;
    }
  }
  return typeof node === 'string' ? node : null;
}

/**
 * English plural categories. Hermes on iOS has no Intl.PluralRules, and a
 * throw here takes down every screen that passes `count`.
 */
function pluralCategory(count: number): string {
  const Rules = typeof Intl === 'undefined' ? undefined : Intl.PluralRules;
  if (typeof Rules === 'function') {
    try {
      return new Rules(deviceLocale()).select(count);
    } catch {
      // Locale data can be missing even when the constructor exists.
    }
  }
  return Math.abs(count) === 1 ? 'one' : 'other';
}

export function t(key: string, vars?: Vars): string {
  let chosen = lookup(key);
  if (vars && typeof vars.count === 'number') {
    const category = pluralCategory(Number(vars.count));
    chosen = lookup(`${key}_${category}`) ?? lookup(`${key}_other`) ?? chosen;
  }
  if (chosen == null) {
    return key;
  }
  if (!vars) {
    return chosen;
  }
  return chosen.replace(/\{(\w+)\}/g, (_, name: string) => String(vars[name] ?? `{${name}}`));
}

export function deviceLocale(): string {
  try {
    if (typeof Intl !== 'undefined' && typeof Intl.DateTimeFormat === 'function') {
      const intl = new Intl.DateTimeFormat().resolvedOptions().locale;
      if (intl) {
        return intl;
      }
    }
  } catch {
    // Hermes can ship without locale data. Native settings are the fallback.
  }
  if (Platform.OS === 'ios') {
    const settings = NativeModules.SettingsManager?.settings;
    return settings?.AppleLocale || settings?.AppleLanguages?.[0] || 'en-US';
  }
  return NativeModules.I18nManager?.localeIdentifier || 'en-US';
}

const CURRENCIES: Array<[RegExp, string]> = [
  [/en-gb|-gb\b|gb$/, 'GBP'],
  [/en-au|-au\b/, 'AUD'],
  [/en-ca|-ca\b/, 'CAD'],
  [/es-mx|-mx\b/, 'MXN'],
  [/es-ar|-ar\b/, 'ARS'],
  [/pt-br|-br\b/, 'BRL'],
  [/en-in|-in\b|\bhi\b/, 'INR'],
  [/ja/, 'JPY'],
  [/ko/, 'KRW'],
  [/zh-tw|zh-hant|-tw\b/, 'TWD'],
  [/zh|zh-cn|zh-hans/, 'CNY'],
  [/^(de|fr|it|nl|es|pt)\b/, 'EUR'],
];

export function currencyForLocale(locale: string): string {
  const lower = locale.toLowerCase().replace(/_/g, '-');
  for (const [pattern, code] of CURRENCIES) {
    if (pattern.test(lower)) {
      return code;
    }
  }
  return 'USD';
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',
  GBP: '£',
  EUR: '€',
  AUD: 'A$',
  CAD: 'CA$',
  MXN: 'MX$',
  ARS: 'ARS ',
  BRL: 'R$',
  INR: '₹',
  JPY: '¥',
  KRW: '₩',
  TWD: 'NT$',
  CNY: 'CN¥',
};

function fallbackMoney(cents: number, currency: string): string {
  const zeroDecimal = currency === 'JPY' || currency === 'KRW';
  const amount = zeroDecimal ? Math.round(cents / 100) : cents / 100;
  const negative = amount < 0;
  const abs = Math.abs(amount);
  const text = zeroDecimal || !Number.isInteger(abs) ? (zeroDecimal ? String(Math.round(abs)) : abs.toFixed(2)) : abs.toFixed(2);
  const symbol = CURRENCY_SYMBOLS[currency] ?? `${currency} `;
  return `${negative ? '-' : ''}${symbol}${text}`;
}

/** Drop a trailing .00 / ,00 so whole amounts can read as $200. */
export function trimZeroFraction(formatted: string): string {
  return formatted.replace(/([.,])00(?=\D*$)/, '');
}

export function formatMoney(
  cents: number,
  locale = deviceLocale(),
  currency = currencyForLocale(locale),
  trimZeros = false,
): string {
  const amount = cents / 100;
  let formatted: string | null = null;
  try {
    if (typeof Intl !== 'undefined' && typeof Intl.NumberFormat === 'function') {
      formatted = new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amount);
    }
  } catch {
    formatted = null;
  }
  const text = formatted ?? fallbackMoney(cents, currency);
  return trimZeros ? trimZeroFraction(text) : text;
}

const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatWithDateTime(date: Date, locale: string, options: Intl.DateTimeFormatOptions): string | null {
  try {
    if (typeof Intl !== 'undefined' && typeof Intl.DateTimeFormat === 'function') {
      return new Intl.DateTimeFormat(locale, options).format(date);
    }
  } catch {
    return null;
  }
  return null;
}

export function formatDate(date: Date, locale = deviceLocale()): string {
  return formatWithDateTime(date, locale, { month: 'short', day: 'numeric' })
    ?? `${SHORT_MONTHS[date.getMonth()]} ${date.getDate()}`;
}

export function formatLongDate(date: Date, locale = deviceLocale()): string {
  return formatWithDateTime(date, locale, { month: 'short', day: 'numeric', year: 'numeric' })
    ?? `${SHORT_MONTHS[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

export function todayIso(date = new Date()): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}
