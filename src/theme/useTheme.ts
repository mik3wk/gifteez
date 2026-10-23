import { useColorScheme } from 'react-native';
import { useGifteez } from '../state/GifteezContext';
import { withColorScheme, type ResolvedColors, type ThemeColors } from './skins';
import { layout, motion, radius, space, stroke, type, typeScale } from './tokens';

export type Theme = {
  scheme: 'light' | 'dark';
  colors: ResolvedColors;
  space: typeof space;
  radius: typeof radius;
  stroke: typeof stroke;
  type: typeof type;
  typeScale: typeof typeScale;
  motion: typeof motion;
  layout: typeof layout;
};

function ensureResolved(colors: ThemeColors | ResolvedColors, scheme: 'light' | 'dark'): ResolvedColors {
  if ('onPink' in colors && typeof colors.onPink === 'string' && 'button' in colors) {
    return colors;
  }
  return withColorScheme(colors, scheme);
}

/** The only way screens and primitives read color, type, and space. */
export function useTheme(): Theme {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const { colors } = useGifteez();
  return {
    scheme,
    colors: ensureResolved(colors, scheme),
    space,
    radius,
    stroke,
    type,
    typeScale,
    motion,
    layout,
  };
}
