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

export function t(key: string, vars?: Vars): string {
  let chosen = lookup(key);
  if (vars && typeof vars.count === 'number') {
    const category = new Intl.PluralRules(deviceLocale()).select(Number(vars.count));
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
  const intl = Intl.DateTimeFormat().resolvedOptions().locale;
  if (intl) {
    return intl;
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

export function formatMoney(cents: number, locale = deviceLocale(), currency = currencyForLocale(locale)): string {
  const amount = cents / 100;
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
  }).format(amount);
}

export function formatDate(date: Date, locale = deviceLocale()): string {
  return new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: 'numeric',
  }).format(date);
}

export function formatLongDate(date: Date, locale = deviceLocale()): string {
  return new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

export function todayIso(date = new Date()): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}
