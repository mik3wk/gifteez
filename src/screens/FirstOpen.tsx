import React from 'react';
import { Image, Pressable, StyleSheet, Text } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStack } from '../app/navigation';
import { t } from '../i18n';
import { useGifteez } from '../state/GifteezContext';
import { useTheme } from '../theme/useTheme';
import { crestSource } from '../ui/art';
import { Body, Button, Screen, Title } from '../ui/ui';

export function FirstOpenScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStack>>();
  const { pickBackup } = useGifteez();
  const { colors, scheme, type, typeScale } = useTheme();
  return (
    <Screen>
      <Image accessible={false} source={crestSource(scheme)} resizeMode="contain" style={styles.crest} />
      <Title>{t('appName')}</Title>
      <Body>{t('firstOpen.welcomeLead')}</Body>
      <Button label={t('firstOpen.addFirst')} onPress={() => navigation.navigate('AddPerson')} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('settings.restoreBackup')}
        onPress={() => { pickBackup().catch(() => undefined); }}
        style={styles.restore}>
        <Text maxFontSizeMultiplier={typeScale.button} style={[type.button, { color: colors.pink }]}>{t('settings.restoreBackup')}</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  crest: { width: 120, height: 120, alignSelf: 'center' },
  restore: { minHeight: 44, justifyContent: 'center', alignSelf: 'center' },
});
