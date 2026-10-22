import { NativeModules, Platform } from 'react-native';
import enUS from './en-US.json';

type Vars = Record<string, string | number>;

export function t(key: string, vars?: Vars): string {
  const parts = key.split('.');
  let node: unknown = enUS;
  for (const part of parts) {
    if (node && typeof node === 'object' && part in node) {
      node = (node as Record<string, unknown>)[part];
    } else {
      return key;
    }
  }
  if (typeof node !== 'string') {
    return key;
  }
  if (!vars) {
    return node;
  }
  return node.replace(/\{(\w+)\}/g, (_, name: string) => String(vars[name] ?? `{${name}}`));
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

export function currencyForLocale(locale: string): string {
  const lower = locale.toLowerCase();
  if (lower.includes('gb')) {
    return 'GBP';
  }
  if (lower.includes('au')) {
    return 'AUD';
  }
  if (lower.includes('-ca') || lower.endsWith('ca')) {
    return 'CAD';
  }
  if (lower.startsWith('es') || lower.includes('-mx')) {
    return 'USD';
  }
  return 'USD';
}

export function formatMoney(cents: number, locale = deviceLocale()): string {
  const amount = cents / 100;
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currencyForLocale(locale),
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
