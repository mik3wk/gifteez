import { Platform, type TextStyle, type ViewStyle } from 'react-native';

/**
 * Sticker tokens. Screens read these through useTheme(), not as raw hexes.
 * Occasion art is the PNG set in src/assets/art. To add a skin, add an ArtName,
 * drop skin-<name>.png at @1x/@2x/@3x, and point the preset at it in OCCASION_LOOK.
 */

export const sticker = {
  light: {
    background: '#FFF6E9',
    surface: '#FFFFFF',
    surfaceAlt: '#FFF6E9',
    ink: '#1A1420',
    text: '#1A1420',
    muted: '#5C5266',
    pink: '#FF4F8B',
    teal: '#00B8A9',
    sunshine: '#FFD23F',
    lilac: '#B8A4FF',
    danger: '#C62828',
    success: '#15803D',
    warning: '#B45309',
    info: '#1D4ED8',
  },
  dark: {
    background: '#17121C',
    surface: '#221A29',
    surfaceAlt: '#2C2234',
    ink: '#FFF8F1',
    text: '#FFF8F1',
    muted: '#B9AEC4',
    pink: '#FF6FA3',
    teal: '#5EEAD4',
    sunshine: '#FFC24D',
    lilac: '#C4B5FD',
    danger: '#FF8A80',
    success: '#4ADE80',
    warning: '#FBBF24',
    info: '#93C5FD',
    /** Text on bright fills stays ink, including in dark mode. */
    onFill: '#1A1420',
  },
} as const;

export const space = { xxs: 4, xs: 8, sm: 12, md: 16, lg: 24, xl: 32 } as const;
export const radius = { chip: 12, card: 16, button: 999, pill: 999 } as const;
export const stroke = { card: 2.5, control: 2.5, inner: 2 } as const;
export const shadowOffset = 4;
export const touch = { minTarget: 48 } as const;
export const layout = { maxContent: 640, tabBar: 76, toastGap: 200 } as const;

/** Dialog and sheet backdrops. Black in both schemes so dark mode does not wash out. */
export const scrim = 'rgba(0,0,0,0.6)';

/**
 * Icon ink on a white or plum surface. Chip fills stay the brighter sticker
 * colors; these are only for the glyph, so light mode can clear 3:1.
 */
export const iconOnSurface = {
  light: { teal: '#00897D', lilac: '#7B61D9' },
  dark: { teal: sticker.dark.teal, lilac: sticker.dark.lilac },
} as const;

/** Archivo Black is already heavy, so display stays at weight 400. Android picks the file name. */
export const fonts = {
  display: Platform.select({ ios: 'Archivo Black', android: 'ArchivoBlack-Regular', default: undefined }),
  body: Platform.select({ ios: 'Space Grotesk', android: 'SpaceGrotesk-Regular', default: undefined }),
  medium: Platform.select({ ios: 'Space Grotesk', android: 'SpaceGrotesk-Medium', default: undefined }),
  bold: Platform.select({ ios: 'Space Grotesk', android: 'SpaceGrotesk-Bold', default: undefined }),
};

function weight(role: 'body' | 'medium' | 'bold'): TextStyle['fontWeight'] {
  if (Platform.OS === 'android') {
    return '400';
  }
  if (role === 'bold') {
    return '700';
  }
  if (role === 'medium') {
    return '500';
  }
  return '400';
}

function family(role: 'body' | 'medium' | 'bold' | 'display'): TextStyle['fontFamily'] {
  if (role === 'display') {
    return fonts.display;
  }
  if (role === 'bold') {
    return fonts.bold;
  }
  if (role === 'medium') {
    return fonts.medium;
  }
  return fonts.body;
}

export const type = {
  display: { fontFamily: family('display'), fontSize: 40, fontWeight: '400' as const },
  title: { fontFamily: family('bold'), fontSize: 28, fontWeight: weight('bold') },
  heading: { fontFamily: family('bold'), fontSize: 20, fontWeight: weight('bold') },
  body: { fontFamily: family('body'), fontSize: 16, fontWeight: weight('body') },
  caption: { fontFamily: family('medium'), fontSize: 13, fontWeight: weight('medium') },
  button: { fontFamily: family('bold'), fontSize: 16, fontWeight: weight('bold') },
} satisfies Record<string, TextStyle>;

export const typeScale = {
  display: 1.25,
  title: 1.4,
  heading: 1.5,
  body: 1.8,
  caption: 1.6,
  button: 1.4,
} as const;

export const motion = {
  pressedScale: 1,
  pressedOpacity: 1,
  duration: { fast: 120, base: 220, celebrate: 900 },
} as const;

/** Hard sticker shadow. Blur stays 0. The view offset lives in the sticker primitive. */
export const elevation = {
  card: {
    shadowColor: sticker.light.ink,
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: shadowOffset, height: shadowOffset },
    elevation: 0,
  },
} satisfies Record<string, ViewStyle>;

export type ArtName =
  | 'birthday'
  | 'anniversary'
  | 'wedding'
  | 'baby'
  | 'holiday'
  | 'hanukkah'
  | 'diwali'
  | 'valentine'
  | 'mother'
  | 'father'
  | 'graduation'
  | 'house'
  | 'gift';

export type ChipTint = 'pink' | 'teal' | 'sunshine' | 'lilac';

export type OccasionLook = { art: ArtName; emoji: string; chip: ChipTint };

const GIFT: OccasionLook = { art: 'gift', emoji: '🎁', chip: 'pink' };

/** Every preset maps to a skin. Unmapped ids, including custom, use the gift. */
export const OCCASION_LOOK: Record<string, OccasionLook> = {
  birthday: { art: 'birthday', emoji: '🎂', chip: 'pink' },
  christmas: { art: 'holiday', emoji: '🎄', chip: 'teal' },
  anniversary: { art: 'anniversary', emoji: '💍', chip: 'lilac' },
  valentines: { art: 'valentine', emoji: '💝', chip: 'pink' },
  'mothers-day': { art: 'mother', emoji: '🌸', chip: 'pink' },
  'fathers-day': { art: 'father', emoji: '👔', chip: 'teal' },
  hanukkah: { art: 'hanukkah', emoji: '🕎', chip: 'sunshine' },
  thanksgiving: { art: 'holiday', emoji: '🦃', chip: 'sunshine' },
  'new-year': { art: 'holiday', emoji: '🎉', chip: 'lilac' },
  wedding: { art: 'wedding', emoji: '💒', chip: 'lilac' },
  graduation: { art: 'graduation', emoji: '🎓', chip: 'sunshine' },
  'just-because': GIFT,
  easter: { art: 'holiday', emoji: '🐣', chip: 'lilac' },
  'lunar-new-year': { art: 'holiday', emoji: '🧧', chip: 'sunshine' },
  diwali: { art: 'diwali', emoji: '🪔', chip: 'sunshine' },
  'eid-fitr': { art: 'holiday', emoji: '🌙', chip: 'teal' },
  'eid-adha': { art: 'holiday', emoji: '🌙', chip: 'teal' },
  halloween: { art: 'holiday', emoji: '🎃', chip: 'sunshine' },
  'independence-day': { art: 'holiday', emoji: '🎆', chip: 'pink' },
  'st-patricks': { art: 'holiday', emoji: '☘️', chip: 'teal' },
  kwanzaa: { art: 'holiday', emoji: '🕯️', chip: 'sunshine' },
  teacher: { art: 'gift', emoji: '🍎', chip: 'pink' },
  'secret-santa': { art: 'holiday', emoji: '🎅', chip: 'teal' },
  engagement: { art: 'anniversary', emoji: '💍', chip: 'lilac' },
  'bridal-shower': { art: 'wedding', emoji: '💐', chip: 'lilac' },
  'baby-shower': { art: 'baby', emoji: '🍼', chip: 'pink' },
  birth: { art: 'baby', emoji: '👶', chip: 'pink' },
  housewarming: { art: 'house', emoji: '🏠', chip: 'teal' },
  'bar-mitzvah': { art: 'gift', emoji: '✡️', chip: 'lilac' },
  quinceanera: { art: 'gift', emoji: '👑', chip: 'pink' },
  communion: { art: 'gift', emoji: '🕊️', chip: 'lilac' },
  retirement: { art: 'gift', emoji: '🎁', chip: 'teal' },
  promotion: { art: 'gift', emoji: '🎉', chip: 'sunshine' },
  'get-well': { art: 'gift', emoji: '💐', chip: 'teal' },
  sympathy: { art: 'gift', emoji: '🤍', chip: 'lilac' },
  'thank-you': { art: 'gift', emoji: '🙏', chip: 'sunshine' },
  custom: GIFT,
};

export function occasionLook(id: string): OccasionLook {
  return OCCASION_LOOK[id] ?? GIFT;
}

export type EmptyArtName = 'people' | 'fairness' | 'occasions' | 'ideas' | 'group' | 'error' | 'offline';

/** Toast art for claim, save, and purchase. Confetti is a separate burst. */
export type CelebrateName = 'claim' | 'save-idea' | 'purchase';

export const EMPTY_LOOK: Record<EmptyArtName, { art: ArtName; emoji: string }> = {
  people: { art: 'gift', emoji: '🎁' },
  fairness: { art: 'gift', emoji: '⚖️' },
  occasions: { art: 'birthday', emoji: '🎂' },
  ideas: { art: 'gift', emoji: '💡' },
  group: { art: 'gift', emoji: '🎁' },
  error: { art: 'gift', emoji: '🎁' },
  offline: { art: 'gift', emoji: '🎁' },
};
