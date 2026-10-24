import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStack } from '../app/navigation';
import { t } from '../i18n';
import { useGifteez } from '../state/GifteezContext';
import { useTheme } from '../theme/useTheme';
import { space, type ArtName, type EmptyArtName } from '../theme/tokens';
import { crestSource } from '../ui/art';
import { ArtRow, Body, Button, Screen, Title } from '../ui/ui';

const BENEFITS: Array<{ art: ArtName | EmptyArtName; label: string }> = [
  { art: 'birthday', label: t('firstOpen.benefitDates') },
  { art: 'gift', label: t('firstOpen.benefitIdeas') },
  { art: 'fairness', label: t('firstOpen.benefitFair') },
];

export function FirstOpenScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStack>>();
  const { pickBackup } = useGifteez();
  const { colors, scheme, type, typeScale } = useTheme();
  return (
    <Screen
      fill
      footer={(
        <View style={styles.actions}>
          <Button label={t('firstOpen.addFirst')} onPress={() => navigation.navigate('FirstAddPerson')} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('settings.restoreBackup')}
            onPress={() => { pickBackup().catch(() => undefined); }}
            style={styles.restore}>
            <Text maxFontSizeMultiplier={typeScale.button} style={[type.button, { color: colors.pink }]}>{t('settings.restoreBackup')}</Text>
          </Pressable>
        </View>
      )}>
      <View style={styles.welcome}>
        <View style={styles.intro}>
          <Image accessible={false} source={crestSource(scheme)} resizeMode="contain" style={styles.crest} />
          <Title align="center">{t('appName')}</Title>
          <Body align="center">{t('firstOpen.welcomeLead')}</Body>
        </View>
        <View style={styles.benefits}>
          {BENEFITS.map(item => (
            <ArtRow key={item.label} art={item.art} size={44}>
              <Body>{item.label}</Body>
            </ArtRow>
          ))}
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  welcome: { flexGrow: 1, justifyContent: 'space-between', gap: space.lg },
  intro: { gap: space.sm },
  crest: { width: 120, height: 120, alignSelf: 'center' },
  benefits: { gap: space.sm },
  actions: { gap: space.xs },
  restore: { minHeight: 44, justifyContent: 'center', alignSelf: 'center' },
});
