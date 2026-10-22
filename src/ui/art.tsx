import React from 'react';
import { Image, StyleSheet } from 'react-native';

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
  const source = SKINS[skinId as keyof typeof SKINS] ?? SKINS.base;
  return <Image source={source} style={styles.banner} resizeMode="cover" accessibilityIgnoresInvertColors />;
}

export function EmptyArt({ kind }: { kind: 'people' | 'fairness' }) {
  return <Image source={EMPTY[kind]} style={styles.empty} resizeMode="contain" accessibilityIgnoresInvertColors />;
}

const styles = StyleSheet.create({
  banner: { width: '100%', height: 96, borderRadius: 14 },
  empty: { width: '100%', height: 160 },
});
