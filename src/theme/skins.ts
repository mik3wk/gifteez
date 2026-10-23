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
  const text = readable(colors.text, [colors.background, colors.surface]);
  const muted = readable(colors.muted, [colors.background, colors.surface]);
  return {
    ...colors,
    text,
    muted,
    accentForeground: readable(colors.accent, [colors.background, colors.surface]),
    dangerText: readable(colors.danger, [colors.background, colors.surface]),
    borderStrong: strongerBorder(colors.border, colors.surface, text),
    onAccent: onFill(colors.accent, [colors.accentText, '#FFFFFF', text]),
    onDanger: onFill(colors.danger, [colors.accentText, '#FFFFFF', text]),
    onSuccess: onFill(colors.success, [colors.accentText, '#FFFFFF', text]),
  };
}

/** Light skins keep their fills. Dark mode swaps the paper and keeps a seasonal banner. */
export function withColorScheme(colors: ThemeColors, scheme: 'light' | 'dark' | null | undefined): ResolvedColors {
  if (scheme !== 'dark') {
    return resolveColors(colors);
  }
  return resolveColors({
    ...colors,
    ...DARK,
    banner: seasonalDarkBanner(colors.banner, colors.accent),
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
