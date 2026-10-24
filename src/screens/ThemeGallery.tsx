import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { t } from '../i18n';
import { BUNDLED_SKINS, contrastRatio, withColorScheme, type ThemeColors } from '../theme/skins';
import { chrome, space } from '../theme/tokens';
import { useTheme } from '../theme/useTheme';
import { BudgetBar, ListRow, RowCard, SealPill } from '../ui/stationery';
import { Body, Button, Caption, Chip, Cluster, EmptyState, Heading, Screen, Toggle } from '../ui/ui';

const spring = require('../../skins/spring.json').colors as ThemeColors;
const summer = require('../../skins/summer.json').colors as ThemeColors;

export function ThemeGalleryScreen() {
  const { scheme, type } = useTheme();
  const [on, setOn] = useState(true);
  const samples: Array<{ name: string; colors: ThemeColors }> = [
    { name: t('settings.skinBase'), colors: BUNDLED_SKINS.base },
    { name: t('settings.skinFall'), colors: BUNDLED_SKINS.fall },
    { name: t('settings.skinWinter'), colors: BUNDLED_SKINS.winter },
    { name: t('settings.skinSpring'), colors: spring },
    { name: t('settings.skinSummer'), colors: summer },
  ];
  return (
    <Screen>
      <Heading>{t('settings.galleryLive')}</Heading>
      <Caption tone="text">{t('settings.galleryHint')}</Caption>
      <Body>{scheme === 'dark' ? t('settings.appearanceDark') : t('settings.appearanceLight')}</Body>
      <Cluster>
        <Button label={t('person.save')} onPress={() => undefined} />
        <Button label={t('settings.appearance')} tone="secondary" onPress={() => undefined} />
        <Button label={t('common.cancel')} tone="ghost" onPress={() => undefined} />
      </Cluster>
      <Cluster>
        <Chip label={t('settings.skinFall')} selected onPress={() => undefined} />
        <Chip label={t('settings.skinBase')} onPress={() => undefined} />
      </Cluster>
      <Cluster>
        <SealPill state="not-started" />
        <SealPill state="idea-saved" />
        <SealPill state="purchased" />
        <SealPill state="logged" />
      </Cluster>
      <BudgetBar spentCents={4000} budgetCents={10000} caption={t('people.budgetYear', { used: '$40', budget: '$100' })} />
      <RowCard>
        <ListRow
          name="Marie"
          personId="gallery"
          detail={t('person.birthday')}
          budget={t('people.budgetYear', { used: '$40', budget: '$100' })}
          seal="idea-saved"
          onPress={() => undefined}
          last
        />
      </RowCard>
      <Toggle label={t('settings.reminders')} value={on} onValueChange={setOn} />
      <EmptyState kind="ideas" text={t('person.ideasNeedInterests')} />
      <Heading>{t('settings.gallerySchemes')}</Heading>
      {samples.map(sample => (
        <View key={sample.name} style={styles.sample}>
          <Caption tone="text">{sample.name}</Caption>
          <SchemeStrip label={t('settings.appearanceLight')} colors={withColorScheme(sample.colors, 'light')} fontFamily={type.caption.fontFamily} />
          <SchemeStrip label={t('settings.appearanceDark')} colors={withColorScheme(sample.colors, 'dark')} fontFamily={type.caption.fontFamily} />
          <Caption tone="text">{`${contrastRatio(chrome.white, sample.colors.accent).toFixed(1)} : 1`}</Caption>
        </View>
      ))}
    </Screen>
  );
}

function SchemeStrip({
  label,
  colors,
  fontFamily,
}: {
  label: string;
  colors: { background: string; text: string; accent: string; banner: string; accentText: string };
  fontFamily: string | undefined;
}) {
  return (
    <View style={[styles.strip, { backgroundColor: colors.background }]}>
      <View style={[styles.swatch, { backgroundColor: colors.accent }]}>
        <Text style={{ color: colors.accentText }}>{label.slice(0, 1)}</Text>
      </View>
      <View style={[styles.banner, { backgroundColor: colors.banner }]}>
        <Text style={[styles.bannerText, { color: colors.text, fontFamily }]}>{label}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sample: { gap: space.xs },
  strip: { flexDirection: 'row', alignItems: 'center', gap: space.xs, padding: space.xs, borderRadius: 10 },
  swatch: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  banner: { flex: 1, paddingVertical: space.xs, paddingHorizontal: space.sm, borderRadius: 8 },
  bannerText: { fontSize: 13 },
});
