import React from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { AppEnv } from '../config/env';
import { t } from '../i18n';

export function DevConfig({ env }: { env: AppEnv }) {
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView style={styles.fill} contentContainerStyle={styles.content}>
        <Text style={styles.title}>{t('dev.title')}</Text>
        <Text style={styles.body}>{t('dev.body')}</Text>
        <Text style={styles.body}>{t('dev.missing', { keys: env.missing.join(', ') || 'Firebase config' })}</Text>
        <Text style={styles.body}>{t('dev.safe')}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F6F1E7' },
  fill: { flex: 1 },
  content: { padding: 24, gap: 14, flexGrow: 1 },
  title: { fontSize: 28, fontWeight: '700', color: '#1F2A24' },
  body: { fontSize: 17, lineHeight: 24, color: '#1F2A24' },
});
