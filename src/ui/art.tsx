import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { t } from '../i18n';
import { useGifteez } from '../state/GifteezContext';

const SKINS = {
  base: require('../assets/skins/base.png'),
  fall: require('../assets/skins/fall.png'),
  winter: require('../assets/skins/winter.png'),
  spring: require('../assets/skins/spring.png'),
  summer: require('../assets/skins/summer.png'),
};

const EMPTY = {
  people: require('../assets/empty-people.png'),
  fairness: require('../assets/empty-fairness.png'),
};

export function SkinBanner({ skinId }: { skinId: string }) {
  const { colors } = useGifteez();
  const source = SKINS[skinId as keyof typeof SKINS] ?? SKINS.base;
  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={t('people.seasonBanner')}
      style={[styles.frame, { backgroundColor: colors.banner, borderColor: colors.border, borderWidth: StyleSheet.hairlineWidth }]}>
      <Image source={source} style={styles.banner} resizeMode="cover" accessibilityIgnoresInvertColors />
    </View>
  );
}

export function EmptyArt({ kind }: { kind: 'people' | 'fairness' }) {
  return <Image source={EMPTY[kind]} style={styles.empty} resizeMode="contain" accessibilityIgnoresInvertColors />;
}

const styles = StyleSheet.create({
  frame: { borderRadius: 16, overflow: 'hidden' },
  banner: { width: '100%', height: 96, borderRadius: 12 },
  empty: { width: '100%', height: 160 },
});
