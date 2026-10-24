import { t } from '../i18n';
import { sticker } from './tokens';

export type SkinId = 'base' | 'fall' | 'winter' | 'spring' | 'summer';

export type ThemeColors = {
  background: string;
  surface: string;
  text: string;
  muted: string;
  accent: string;
  accentText: string;
  border: string;
  danger: string;
  success: string;
  banner: string;
};

/** Foreground colors that clear WCAG AA on this scheme. Fills stay as authored. */
export type ResolvedColors = ThemeColors & {
  accentForeground: string;
  dangerText: string;
  borderStrong: string;
  onAccent: string;
  onDanger: string;
  onSuccess: string;
  primary: string;
  onPrimary: string;
  primaryText: string;
  secondary: string;
  onSecondary: string;
  highlight: string;
  onHighlight: string;
  warning: string;
  info: string;
  onWarning: string;
  onInfo: string;
  ink: string;
  onInk: string;
  button: string;
  onButton: string;
  pink: string;
  onPink: string;
  teal: string;
  onTeal: string;
  sunshine: string;
  onSunshine: string;
  lilac: string;
  onLilac: string;
  surfaceAlt: string;
  outline: string;
  shadow: string;
};

export const COLOR_KEYS: (keyof ThemeColors)[] = [
  'background',
  'surface',
  'text',
  'muted',
  'accent',
  'accentText',
  'border',
  'danger',
  'success',
  'banner',
];

const PAPER: Pick<ThemeColors, 'background' | 'surface' | 'text' | 'muted' | 'border' | 'danger' | 'success'> = {
  background: sticker.light.background,
  surface: sticker.light.surface,
  text: sticker.light.text,
  muted: sticker.light.muted,
  border: sticker.light.hairline,
  danger: sticker.light.danger,
  success: sticker.light.success,
};

export const BUNDLED_SKINS: Record<'base' | 'fall' | 'winter', ThemeColors> = {
  base: { ...PAPER, accent: sticker.light.pink, accentText: '#FFFFFF', banner: '#F6E7E8' },
  fall: { ...PAPER, accent: '#9A4A2E', accentText: '#FFFFFF', banner: '#F8E6DC' },
  winter: { ...PAPER, accent: '#2F5D50', accentText: '#FFFFFF', banner: '#F6E7C8' },
};

/** Dots beside list names. Text stays colors.text. */
export const groupHues = {
  light: [sticker.light.pink, sticker.light.teal, sticker.light.lilac, sticker.light.sunshine, sticker.light.plum, '#9A4A2E'],
  dark: [sticker.dark.pink, sticker.dark.teal, sticker.dark.lilac, sticker.dark.sunshine, sticker.dark.plum, '#F0B090'],
};

export function groupHue(index: number, scheme: 'light' | 'dark' | null | undefined): string {
  const list = scheme === 'dark' ? groupHues.dark : groupHues.light;
  return list[Math.abs(index) % list.length];
}

export function skinForDate(date: Date): SkinId {
  const monthDay = (date.getMonth() + 1) * 100 + date.getDate();
  if (monthDay >= 1201 || monthDay <= 115) {
    return 'winter';
  }
  if (monthDay >= 320 && monthDay <= 620) {
    return 'spring';
  }
  if (monthDay >= 621 && monthDay <= 831) {
    return 'summer';
  }
  if (monthDay >= 901 && monthDay <= 1130) {
    return 'fall';
  }
  return 'base';
}

const SKIN_LABEL: Record<SkinId, string> = {
  base: 'settings.skinBase',
  fall: 'settings.skinFall',
  winter: 'settings.skinWinter',
  spring: 'settings.skinSpring',
  summer: 'settings.skinSummer',
};

/** "Auto (Fall)" for the skin the date resolves to. */
export function autoSkinLabel(date: Date): string {
  return t('settings.skinAutoNamed', { name: t(SKIN_LABEL[skinForDate(date)]) });
}

export function isBundledSkin(id: string): id is 'base' | 'fall' | 'winter' {
  return id === 'base' || id === 'fall' || id === 'winter';
}

export function resolveSkin(input: {
  remoteValue: string;
  today: Date;
  downloaded: Partial<Record<SkinId, ThemeColors>>;
}): { id: SkinId; colors: ThemeColors } {
  const requested = input.remoteValue && input.remoteValue !== 'auto'
    ? input.remoteValue
    : skinForDate(input.today);
  return colorsFor(requested, input.downloaded);
}

export function colorsFor(
  id: string,
  downloaded: Partial<Record<SkinId, ThemeColors>>,
): { id: SkinId; colors: ThemeColors } {
  if (isBundledSkin(id)) {
    return { id, colors: BUNDLED_SKINS[id] };
  }
  if ((id === 'spring' || id === 'summer') && downloaded[id]) {
    return { id, colors: downloaded[id] as ThemeColors };
  }
  return { id: 'base', colors: BUNDLED_SKINS.base };
}

function channelLuminance(channel: number): number {
  const value = channel / 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(hex: string): number {
  const match = /^#([0-9a-fA-F]{6})$/.exec(hex);
  if (!match) {
    throw new Error(`Color must be #RRGGBB, got ${hex}.`);
  }
  const raw = match[1];
  const red = channelLuminance(parseInt(raw.slice(0, 2), 16));
  const green = channelLuminance(parseInt(raw.slice(2, 4), 16));
  const blue = channelLuminance(parseInt(raw.slice(4, 6), 16));
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

/** WCAG contrast ratio. 4.5 is the minimum for normal text. */
const DARK: Pick<ThemeColors, 'background' | 'surface' | 'text' | 'muted' | 'border'> = {
  background: sticker.dark.background,
  surface: sticker.dark.surface,
  text: sticker.dark.text,
  muted: sticker.dark.muted,
  border: sticker.dark.hairline,
};

const DARK_ROLE = {
  accentText: sticker.dark.onFill,
  danger: sticker.dark.danger,
  success: sticker.dark.success,
};

/** Bright fills for dark mode, keyed by the light accent. Banners stay distinct and readable. */
const DARK_FILLS: Record<string, Pick<ThemeColors, 'accent' | 'accentText' | 'danger' | 'success' | 'banner'>> = {
  '#A93F55': { ...DARK_ROLE, accent: sticker.dark.pink, banner: '#6B3E4C' },
  '#FF7A1A': { ...DARK_ROLE, accent: '#FDBA74', banner: '#6B442C' },
  '#9A4A2E': { ...DARK_ROLE, accent: '#F0B090', banner: '#6B4034' },
  '#5D7290': { ...DARK_ROLE, accent: '#A9B9CE', banner: '#3A4A60' },
  '#2F5D50': { ...DARK_ROLE, accent: '#9FCBBC', banner: '#5C4A28' },
  '#4F6F57': { ...DARK_ROLE, accent: sticker.dark.teal, banner: '#3E5A48' },
  '#1B7A43': { ...DARK_ROLE, accent: '#E05C80', banner: '#6B3A4C' },
  '#B8A4FF': { ...DARK_ROLE, accent: '#C4B5FD', banner: '#5A4480' },
  '#FFD23F': { ...DARK_ROLE, accent: '#D9B866', banner: '#6A5420' },
  '#B45348': { ...DARK_ROLE, accent: '#F0B2A6', banner: '#6B4538' },
};

function mixChannel(parts: Array<[string, number]>, index: number): string {
  const value = parts.reduce((sum, [hex, weight]) => {
    return sum + parseInt(hex.slice(1 + index * 2, 3 + index * 2), 16) * weight;
  }, 0);
  return Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, '0');
}

/** A dark seasonal band: the holiday hue stays, and light text still clears it. */
export function seasonalDarkBanner(banner: string, accent: string): string {
  const parts: Array<[string, number]> = [
    [DARK.background, 0.62],
    [banner, 0.22],
    [accent, 0.16],
  ];
  return `#${mixChannel(parts, 0)}${mixChannel(parts, 1)}${mixChannel(parts, 2)}`.toUpperCase();
}

function rgb(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

function mixHex(from: string, to: string, amount: number): string {
  const [ar, ag, ab] = rgb(from);
  const [br, bg, bb] = rgb(to);
  const channel = (a: number, b: number) => Math.max(0, Math.min(255, Math.round(a + (b - a) * amount))).toString(16).padStart(2, '0');
  return `#${channel(ar, br)}${channel(ag, bg)}${channel(ab, bb)}`.toUpperCase();
}

/** Move `color` toward white or black until it clears `min` on every background. */
export function readable(color: string, backgrounds: string[], min = 4.5): string {
  const source = color.toUpperCase();
  if (backgrounds.every(bg => contrastRatio(source, bg) >= min)) {
    return source;
  }
  for (let step = 1; step <= 24; step += 1) {
    const amount = step / 24;
    const light = mixHex(source, '#FFFFFF', amount);
    const dark = mixHex(source, '#14120F', amount);
    if (backgrounds.every(bg => contrastRatio(light, bg) >= min)) {
      return light;
    }
    if (backgrounds.every(bg => contrastRatio(dark, bg) >= min)) {
      return dark;
    }
  }
  const white = '#FFFFFF';
  const ink = '#14120F';
  const score = (candidate: string) => Math.min(...backgrounds.map(bg => contrastRatio(candidate, bg)));
  return score(white) >= score(ink) ? white : ink;
}

function onFill(fill: string, candidates: string[]): string {
  for (const candidate of candidates) {
    if (contrastRatio(candidate, fill) >= 4.5) {
      return candidate.toUpperCase();
    }
  }
  return readable('#FFFFFF', [fill]);
}

function strongerBorder(border: string, surface: string, ink: string): string {
  if (contrastRatio(border, surface) >= 3) {
    return border.toUpperCase();
  }
  for (let step = 1; step <= 20; step += 1) {
    const next = mixHex(border, ink, step / 20);
    if (contrastRatio(next, surface) >= 3) {
      return next;
    }
  }
  return ink.toUpperCase();
}

export function resolveColors(colors: ThemeColors): ResolvedColors {
  const text = readable(colors.text, [colors.background, colors.surface, colors.banner]);
  const muted = readable(colors.muted, [colors.background, colors.surface]);
  const night = relativeLuminance(colors.background) < 0.2;
  const brand = night ? sticker.dark : sticker.light;
  const warningFill = brand.warning;
  const infoFill = brand.info;
  const secondaryFill = brand.teal;
  const highlightFill = brand.sunshine;
  const onAccent = onFill(colors.accent, [colors.accentText, text, '#FFFFFF']);
  // Buttons, links, and the tab tint follow the skin. Base stays rose; winter and the rest do not.
  const button = colors.accent;
  const onButton = onAccent;
  const ink = night ? mixHex(sticker.dark.surface, sticker.dark.text, 0.85) : sticker.light.ink;
  const onInk = night ? sticker.dark.onFill : '#FFFFFF';
  const pink = colors.accent;
  const teal = brand.teal;
  const sunshine = brand.sunshine;
  const lilac = brand.lilac;
  const onBright = night ? sticker.dark.onFill : sticker.light.ink;
  return {
    ...colors,
    text,
    muted,
    accentForeground: readable(colors.accent, [colors.background, colors.surface]),
    dangerText: readable(colors.danger, [colors.background, colors.surface]),
    borderStrong: strongerBorder(colors.border, colors.surface, text),
    onAccent,
    onDanger: onFill(colors.danger, [colors.accentText, '#FFFFFF', text, onBright]),
    onSuccess: onFill(colors.success, [colors.accentText, '#FFFFFF', text, onBright]),
    primary: button,
    onPrimary: onButton,
    primaryText: readable(button, [colors.background, colors.surface]),
    secondary: secondaryFill,
    onSecondary: onFill(secondaryFill, [onBright, text, '#FFFFFF']),
    highlight: highlightFill,
    onHighlight: onFill(highlightFill, [onBright, text, '#FFFFFF']),
    warning: readable(warningFill, [colors.background, colors.surface]),
    info: readable(infoFill, [colors.background, colors.surface]),
    onWarning: onFill(warningFill, [onBright, text, '#FFFFFF']),
    onInfo: onFill(infoFill, ['#FFFFFF', text, onBright]),
    ink,
    onInk,
    button,
    onButton,
    pink,
    onPink: onAccent,
    teal,
    onTeal: onFill(teal, [onBright, text, '#FFFFFF']),
    sunshine,
    onSunshine: onFill(sunshine, [onBright, text, '#FFFFFF']),
    lilac,
    onLilac: onFill(lilac, [onBright, text, '#FFFFFF']),
    surfaceAlt: night ? sticker.dark.surfaceAlt : sticker.light.surfaceAlt,
    outline: strongerBorder(ink, colors.surface, text),
    shadow: night ? '#000000' : sticker.light.ink,
  };
}

/** Light skins keep their fills. Dark mode uses plum paper and a brighter seasonal accent. */
export function withColorScheme(colors: ThemeColors, scheme: 'light' | 'dark' | null | undefined): ResolvedColors {
  if (scheme !== 'dark') {
    return resolveColors(colors);
  }
  const fills = DARK_FILLS[colors.accent.toUpperCase()];
  return resolveColors({
    ...colors,
    ...DARK,
    ...(fills ?? {
      banner: seasonalDarkBanner(colors.banner, colors.accent),
    }),
  });
}

export function contrastRatio(foreground: string, background: string): number {
  const first = relativeLuminance(foreground);
  const second = relativeLuminance(background);
  const lighter = Math.max(first, second);
  const darker = Math.min(first, second);
  return (lighter + 0.05) / (darker + 0.05);
}

export function parseSkin(value: unknown): ThemeColors | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const record = value as Record<string, unknown>;
  const colors = (record.colors ?? record) as Record<string, unknown>;
  const theme = {} as ThemeColors;
  for (const key of COLOR_KEYS) {
    const entry = colors[key];
    if (typeof entry !== 'string' || !/^#([0-9a-fA-F]{6})$/.test(entry)) {
      return null;
    }
    theme[key] = entry;
  }
  return theme;
}
