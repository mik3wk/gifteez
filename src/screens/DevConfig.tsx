import React from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { AppEnv } from '../config/env';
import { t } from '../i18n';
import { space, sticker, type as typeScale } from '../theme/tokens';

const ink = sticker.light;

export function DevConfig({ env }: { env: AppEnv }) {
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: ink.background }]}>
      <ScrollView style={styles.fill} contentContainerStyle={styles.content}>
        <Text style={[typeScale.title, styles.copy, { color: ink.text }]}>{t('dev.title')}</Text>
        <Text style={[typeScale.body, styles.copy, { color: ink.text }]}>{t('dev.body')}</Text>
        <Text style={[typeScale.body, styles.copy, { color: ink.text }]}>{t('dev.missing', { keys: env.missing.join(', ') || 'Firebase config' })}</Text>
        <Text style={[typeScale.body, styles.copy, { color: ink.text }]}>{t('dev.safe')}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  fill: { flex: 1 },
  content: { padding: space.lg, gap: space.sm, flexGrow: 1 },
  copy: { flexShrink: 1 },
});
