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

export const BUNDLED_SKINS: Record<'base' | 'fall' | 'winter', ThemeColors> = {
  base: {
    background: '#F6F1E7',
    surface: '#FFFCF7',
    text: '#1F2A24',
    muted: '#5E6A62',
    accent: '#1F6B4A',
    accentText: '#F6F1E7',
    border: '#E2D8C8',
    danger: '#9C3B2E',
    success: '#1F6B4A',
    banner: '#E7F0EA',
  },
  fall: {
    background: '#F3E6D4',
    surface: '#FFF8EF',
    text: '#2C2118',
    muted: '#6E5844',
    accent: '#A24C22',
    accentText: '#FFF8EF',
    border: '#E4CDB4',
    danger: '#9C3B2E',
    success: '#6B8F3C',
    banner: '#F8E2CC',
  },
  winter: {
    background: '#F3F6F8',
    surface: '#FFFFFF',
    text: '#1C2A33',
    muted: '#5C6E7A',
    accent: '#1E4D6B',
    accentText: '#F3F6F8',
    border: '#D5E0E7',
    danger: '#8E3A3A',
    success: '#2F6F62',
    banner: '#E4EEF4',
  },
};

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
const DARK: Pick<ThemeColors, 'background' | 'surface' | 'text' | 'muted' | 'border' | 'banner'> = {
  background: '#141816',
  surface: '#1E2622',
  text: '#F6F1E7',
  muted: '#C5D0C8',
  border: '#314038',
  banner: '#24352C',
};

/** Light skins stay as authored. Dark mode keeps the accent and swaps the paper colors. */
export function withColorScheme(colors: ThemeColors, scheme: 'light' | 'dark' | null | undefined): ThemeColors {
  if (scheme !== 'dark') {
    return colors;
  }
  return { ...colors, ...DARK };
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
