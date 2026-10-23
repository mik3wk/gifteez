import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { t } from '../i18n';
import { useTheme } from '../theme/useTheme';
import { stroke } from '../theme/tokens';

const SKINS = {
  base: require('../assets/skins/base.png'),
  fall: require('../assets/skins/fall.png'),
  winter: require('../assets/skins/winter.png'),
  spring: require('../assets/skins/spring.png'),
  summer: require('../assets/skins/summer.png'),
};

/** Seasonal art sits on the banner color. Step 2 replaces the bitmap with a sticker illustration. */
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
