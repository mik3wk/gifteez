import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { t } from '../i18n';
import { stroke, type ArtName, type CelebrateName, type EmptyArtName } from '../theme/tokens';
import { useTheme } from '../theme/useTheme';

const SKINS = {
  base: require('../assets/skins/base.png'),
  fall: require('../assets/skins/fall.png'),
  winter: require('../assets/skins/winter.png'),
  spring: require('../assets/skins/spring.png'),
  summer: require('../assets/skins/summer.png'),
};

type Scheme = 'light' | 'dark';

const EMBLEM: Record<ArtName, { light: number; dark: number }> = {
  birthday: { light: require('../assets/art/emblems/emblem-birthday.png'), dark: require('../assets/art/emblems/emblem-birthday-dark.png') },
  anniversary: { light: require('../assets/art/emblems/emblem-anniversary.png'), dark: require('../assets/art/emblems/emblem-anniversary-dark.png') },
  wedding: { light: require('../assets/art/emblems/emblem-wedding.png'), dark: require('../assets/art/emblems/emblem-wedding-dark.png') },
  baby: { light: require('../assets/art/emblems/emblem-baby.png'), dark: require('../assets/art/emblems/emblem-baby-dark.png') },
  holiday: { light: require('../assets/art/emblems/emblem-holiday.png'), dark: require('../assets/art/emblems/emblem-holiday-dark.png') },
  hanukkah: { light: require('../assets/art/emblems/emblem-hanukkah.png'), dark: require('../assets/art/emblems/emblem-hanukkah-dark.png') },
  diwali: { light: require('../assets/art/emblems/emblem-diwali.png'), dark: require('../assets/art/emblems/emblem-diwali-dark.png') },
  valentine: { light: require('../assets/art/emblems/emblem-valentine.png'), dark: require('../assets/art/emblems/emblem-valentine-dark.png') },
  mother: { light: require('../assets/art/emblems/emblem-mother.png'), dark: require('../assets/art/emblems/emblem-mother-dark.png') },
  father: { light: require('../assets/art/emblems/emblem-father.png'), dark: require('../assets/art/emblems/emblem-father-dark.png') },
  graduation: { light: require('../assets/art/emblems/emblem-graduation.png'), dark: require('../assets/art/emblems/emblem-graduation-dark.png') },
  house: { light: require('../assets/art/emblems/emblem-house.png'), dark: require('../assets/art/emblems/emblem-house-dark.png') },
  gift: { light: require('../assets/art/emblems/emblem-gift.png'), dark: require('../assets/art/emblems/emblem-gift-dark.png') },
  crescent: { light: require('../assets/art/emblems/emblem-crescent.png'), dark: require('../assets/art/emblems/emblem-crescent-dark.png') },
  lantern: { light: require('../assets/art/emblems/emblem-lantern.png'), dark: require('../assets/art/emblems/emblem-lantern-dark.png') },
  harvest: { light: require('../assets/art/emblems/emblem-harvest.png'), dark: require('../assets/art/emblems/emblem-harvest-dark.png') },
  toast: { light: require('../assets/art/emblems/emblem-toast.png'), dark: require('../assets/art/emblems/emblem-toast-dark.png') },
  bloom: { light: require('../assets/art/emblems/emblem-bloom.png'), dark: require('../assets/art/emblems/emblem-bloom-dark.png') },
};

const EMPTY_ART: Record<EmptyArtName, { light: number; dark: number }> = {
  people: { light: require('../assets/art/empty/empty-people.png'), dark: require('../assets/art/empty/empty-people-dark.png') },
  fairness: { light: require('../assets/art/empty/empty-fairness.png'), dark: require('../assets/art/empty/empty-fairness-dark.png') },
  occasions: { light: require('../assets/art/empty/empty-occasions.png'), dark: require('../assets/art/empty/empty-occasions-dark.png') },
  ideas: { light: require('../assets/art/empty/empty-ideas.png'), dark: require('../assets/art/empty/empty-ideas-dark.png') },
  group: { light: require('../assets/art/empty/empty-group.png'), dark: require('../assets/art/empty/empty-group-dark.png') },
  error: { light: require('../assets/art/empty/empty-error.png'), dark: require('../assets/art/empty/empty-error-dark.png') },
  offline: { light: require('../assets/art/empty/empty-offline.png'), dark: require('../assets/art/empty/empty-offline-dark.png') },
};

const CELEBRATE_ART: Record<CelebrateName, number> = {
  claim: require('../assets/art/celebrate/celebrate-claim.png'),
  'save-idea': require('../assets/art/celebrate/celebrate-save-idea.png'),
  purchase: require('../assets/art/celebrate/celebrate-purchase.png'),
};

/** Confetti for the first person added. Metro includes the @2x and @3x siblings. */
export const CONFETTI_BURST = require('../assets/art/celebrate/confetti-burst.png');

function paired(pair: { light: number; dark: number }, scheme: Scheme): number {
  return scheme === 'dark' ? pair.dark : pair.light;
}

/** Line art is already colored. Do not tint these files. */
export function artSource(name: ArtName | EmptyArtName | CelebrateName, scheme: Scheme = 'light'): number {
  if (Object.prototype.hasOwnProperty.call(EMPTY_ART, name)) {
    return paired(EMPTY_ART[name as EmptyArtName], scheme);
  }
  if (Object.prototype.hasOwnProperty.call(CELEBRATE_ART, name)) {
    return CELEBRATE_ART[name as CelebrateName];
  }
  const emblem = EMBLEM[name as ArtName] ?? EMBLEM.gift;
  return paired(emblem, scheme);
}

/** Seasonal banners stay the season bitmaps. Occasion emblems are separate. */
export function SkinBanner({ skinId }: { skinId: string }) {
  const { colors, radius } = useTheme();
  const source = SKINS[skinId as keyof typeof SKINS] ?? SKINS.base;
  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={t('people.seasonBanner')}
      style={[styles.frame, { backgroundColor: colors.banner, borderColor: colors.outline, borderRadius: radius.card }]}>
      <Image source={source} style={styles.banner} resizeMode="contain" accessibilityIgnoresInvertColors />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { borderWidth: stroke.card, overflow: 'hidden', minHeight: 96, justifyContent: 'center' },
  banner: { width: '100%', height: 96 },
});
