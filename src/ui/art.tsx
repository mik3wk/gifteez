import React from 'react';
import { Image, StyleSheet, useColorScheme, View } from 'react-native';
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
  const scheme = useColorScheme();
  const { colors } = useGifteez();
  const source = SKINS[skinId as keyof typeof SKINS] ?? SKINS.base;
  const dark = scheme === 'dark';
  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={t('people.seasonBanner')}
      style={[
        styles.frame,
        {
          backgroundColor: dark ? colors.banner : 'transparent',
          borderColor: dark ? colors.accent : colors.border,
          borderWidth: dark ? 2 : StyleSheet.hairlineWidth,
          padding: dark ? 8 : 0,
        },
      ]}>
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
