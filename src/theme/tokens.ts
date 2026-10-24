import { Platform, type TextStyle, type ViewStyle } from 'react-native';

/**
 * Sticker tokens. Screens read these through useTheme(), not as raw hexes.
 * Occasion art is the PNG set in src/assets/art. To add a skin, add an ArtName,
 * drop emblem-<name>.png at @1x/@2x/@3x, and point the preset at it in OCCASION_LOOK.
 */

/**
 * Gift-wrap stationery. Rose is the primary fill. Sage and gold text colors
 * clear 4.5:1; the brighter sage and gold fills are decorative only.
 * Chip tint names stay pink, teal, sunshine, and lilac so existing art maps
 * keep working. They now resolve to rose, sage, gold, and dusty blue.
 */
export const sticker = {
  light: {
    background: '#FBF8F3',
    surface: '#FFFFFF',
    surfaceAlt: '#F6E7E8',
    ink: '#2B2522',
    text: '#2B2522',
    muted: '#6F6660',
    hairline: '#E7DFD6',
    pink: '#A93F55',
    teal: '#4F6F57',
    sunshine: '#8A6A22',
    lilac: '#5D7290',
    plum: '#6E4A6B',
    danger: '#C62828',
    success: '#4F6F57',
    warning: '#8A6A22',
    info: '#5D7290',
  },
  dark: {
    background: '#1C1816',
    surface: '#26201D',
    surfaceAlt: '#322824',
    ink: '#F2EBE3',
    text: '#F2EBE3',
    muted: '#B3A79E',
    hairline: '#3A332E',
    pink: '#E58A9C',
    teal: '#8FB497',
    sunshine: '#D9B866',
    lilac: '#A9B9CE',
    plum: '#C9A3C4',
    danger: '#FF8A80',
    success: '#8FB497',
    warning: '#D9B866',
    info: '#A9B9CE',
    /** Dark text on the bright rose, sage, and gold fills. */
    onFill: '#1C1816',
  },
} as const;

export const space = { xxs: 4, xs: 8, sm: 12, md: 16, lg: 24, xl: 32 } as const;
export const radius = { chip: 999, card: 14, button: 10, pill: 999 } as const;
export const stroke = { card: 1, control: 1, inner: 1 } as const;
/** Press travel. Motion still reads this. The painted shadow is soft and separate. */
export const shadowOffset = 4;
export const touch = { minTarget: 48 } as const;
export const layout = { maxContent: 640, tabBar: 96, toastGap: 200 } as const;

/** Dialog and sheet backdrops. Black in both schemes so dark mode does not wash out. */
export const scrim = 'rgba(0,0,0,0.6)';

/**
 * Icon ink on a white or plum surface. Chip fills stay the brighter sticker
 * colors; these are only for the glyph, so light mode can clear 3:1.
 */
export const iconOnSurface = {
  light: { teal: sticker.light.teal, lilac: sticker.light.lilac },
  dark: { teal: sticker.dark.teal, lilac: sticker.dark.lilac },
} as const;

/**
 * System serif for titles, names, card titles, and big numbers.
 * System sans for everything else, including every button label.
 * Bundled font files wait so the Xcode project stays untouched.
 */
export const fonts = {
  display: Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia' }),
  body: Platform.select({ ios: undefined, android: 'sans-serif', default: undefined }),
};

function weight(role: 'body' | 'medium' | 'bold'): TextStyle['fontWeight'] {
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
  return fonts.body;
}

export const type = {
  display: { fontFamily: family('display'), fontSize: 34, fontWeight: '400' as const },
  title: { fontFamily: family('display'), fontSize: 24, fontWeight: '400' as const },
  heading: { fontFamily: family('display'), fontSize: 18, fontWeight: '400' as const },
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

/** Soft stationery shadow. Press travel still uses shadowOffset and is unchanged. */
export const elevation = {
  card: {
    shadowColor: '#2B2522',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
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
  | 'gift'
  | 'crescent'
  | 'lantern'
  | 'harvest'
  | 'toast'
  | 'bloom';

export type ChipTint = 'pink' | 'teal' | 'sunshine' | 'lilac';

export type OccasionLook = { art: ArtName; emoji: string; chip: ChipTint };

const GIFT: OccasionLook = { art: 'gift', emoji: '', chip: 'pink' };

/** Every preset maps to a line-art emblem. Unmapped ids, including custom, use the gift. */
export const OCCASION_LOOK: Record<string, OccasionLook> = {
  birthday: { art: 'birthday', emoji: '', chip: 'pink' },
  christmas: { art: 'holiday', emoji: '', chip: 'teal' },
  anniversary: { art: 'anniversary', emoji: '', chip: 'lilac' },
  valentines: { art: 'valentine', emoji: '', chip: 'pink' },
  'mothers-day': { art: 'mother', emoji: '', chip: 'pink' },
  'fathers-day': { art: 'father', emoji: '', chip: 'teal' },
  hanukkah: { art: 'hanukkah', emoji: '', chip: 'sunshine' },
  thanksgiving: { art: 'harvest', emoji: '', chip: 'sunshine' },
  'new-year': { art: 'toast', emoji: '', chip: 'lilac' },
  wedding: { art: 'wedding', emoji: '', chip: 'lilac' },
  graduation: { art: 'graduation', emoji: '', chip: 'sunshine' },
  'just-because': GIFT,
  easter: { art: 'bloom', emoji: '', chip: 'lilac' },
  'lunar-new-year': { art: 'lantern', emoji: '', chip: 'sunshine' },
  diwali: { art: 'diwali', emoji: '', chip: 'sunshine' },
  'eid-fitr': { art: 'crescent', emoji: '', chip: 'teal' },
  'eid-adha': { art: 'crescent', emoji: '', chip: 'teal' },
  halloween: { art: 'harvest', emoji: '', chip: 'sunshine' },
  'independence-day': { art: 'gift', emoji: '', chip: 'pink' },
  'st-patricks': { art: 'gift', emoji: '', chip: 'teal' },
  kwanzaa: { art: 'gift', emoji: '', chip: 'sunshine' },
  teacher: { art: 'gift', emoji: '', chip: 'pink' },
  'secret-santa': { art: 'gift', emoji: '', chip: 'teal' },
  engagement: { art: 'anniversary', emoji: '', chip: 'lilac' },
  'bridal-shower': { art: 'wedding', emoji: '', chip: 'lilac' },
  'baby-shower': { art: 'baby', emoji: '', chip: 'pink' },
  birth: { art: 'baby', emoji: '', chip: 'pink' },
  housewarming: { art: 'house', emoji: '', chip: 'teal' },
  'bar-mitzvah': { art: 'gift', emoji: '', chip: 'lilac' },
  quinceanera: { art: 'gift', emoji: '', chip: 'pink' },
  communion: { art: 'bloom', emoji: '', chip: 'lilac' },
  retirement: { art: 'toast', emoji: '', chip: 'teal' },
  promotion: { art: 'toast', emoji: '', chip: 'sunshine' },
  'get-well': { art: 'bloom', emoji: '', chip: 'teal' },
  sympathy: { art: 'bloom', emoji: '', chip: 'lilac' },
  'thank-you': { art: 'gift', emoji: '', chip: 'sunshine' },
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
