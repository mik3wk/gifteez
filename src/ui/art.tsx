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

const SKIN_ART: Record<ArtName, number> = {
  birthday: require('../assets/art/skins/skin-birthday.png'),
  anniversary: require('../assets/art/skins/skin-anniversary.png'),
  wedding: require('../assets/art/skins/skin-wedding.png'),
  baby: require('../assets/art/skins/skin-baby.png'),
  holiday: require('../assets/art/skins/skin-holiday.png'),
  hanukkah: require('../assets/art/skins/skin-hanukkah.png'),
  diwali: require('../assets/art/skins/skin-diwali.png'),
  valentine: require('../assets/art/skins/skin-valentine.png'),
  mother: require('../assets/art/skins/skin-mother.png'),
  father: require('../assets/art/skins/skin-father.png'),
  graduation: require('../assets/art/skins/skin-graduation.png'),
  house: require('../assets/art/skins/skin-house.png'),
  gift: require('../assets/art/skins/skin-gift.png'),
};

const EMPTY_ART: Record<EmptyArtName, number> = {
  people: require('../assets/art/empty/empty-people.png'),
  fairness: require('../assets/art/empty/empty-fairness.png'),
  occasions: require('../assets/art/empty/empty-occasions.png'),
  ideas: require('../assets/art/empty/empty-ideas.png'),
  group: require('../assets/art/empty/empty-group.png'),
  error: require('../assets/art/empty/empty-error.png'),
  offline: require('../assets/art/empty/empty-offline.png'),
};

const CELEBRATE_ART: Record<CelebrateName, number> = {
  claim: require('../assets/art/celebrate/celebrate-claim.png'),
  'save-idea': require('../assets/art/celebrate/celebrate-save-idea.png'),
  purchase: require('../assets/art/celebrate/celebrate-purchase.png'),
};

/** Group list mark. The file is the gift sticker, not a face. */
export const GROUP_AVATAR = require('../assets/art/avatars/group-avatar.png');

/** Confetti for the first person added. Metro includes the @2x and @3x siblings. */
export const CONFETTI_BURST = require('../assets/art/celebrate/confetti-burst.png');

export function artSource(name: ArtName | EmptyArtName | CelebrateName): number {
  if (Object.prototype.hasOwnProperty.call(EMPTY_ART, name)) {
    return EMPTY_ART[name as EmptyArtName];
  }
  if (Object.prototype.hasOwnProperty.call(CELEBRATE_ART, name)) {
    return CELEBRATE_ART[name as CelebrateName];
  }
  return SKIN_ART[name as ArtName] ?? SKIN_ART.gift;
}

/** Seasonal banners stay the season bitmaps. Occasion skins are separate. */
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
