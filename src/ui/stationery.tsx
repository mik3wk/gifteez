import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { fairnessView } from '../domain/fairnessView';
import type { FairnessRow } from '../domain/logic';
import { monogramIndex, monogramLetters, MONOGRAM_SWATCHES } from '../domain/monogram';
import type { SealState } from '../domain/seal';
import { t } from '../i18n';
import { useTheme } from '../theme/useTheme';
import { space, touch } from '../theme/tokens';
import { bowSource, crestSource, dividerSource, sealSource, type SealArtName } from './art';
import { Icon } from './icons';

export function MonogramAvatar({
  name,
  personId,
  size = 48,
  crest = false,
}: {
  name: string;
  personId: string;
  size?: number;
  crest?: boolean;
}) {
  const { scheme, type, typeScale } = useTheme();
  const swatch = MONOGRAM_SWATCHES[monogramIndex(personId || name || 'gifteez')];
  const letters = monogramLetters(name) || 'G';
  const face = (
    <View
      accessibilityElementsHidden
      style={[
        styles.monogram,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: swatch.fill,
          borderColor: 'rgba(255,255,255,0.7)',
        },
      ]}>
      <Text
        maxFontSizeMultiplier={typeScale.heading}
        style={[type.heading, { color: swatch.ink, fontSize: Math.max(16, size * 0.38) }]}>
        {letters}
      </Text>
    </View>
  );
  if (!crest) {
    return face;
  }
  const frame = Math.round(size * 1.8);
  return (
    <View accessibilityElementsHidden style={{ width: frame, height: frame, alignItems: 'center', justifyContent: 'center' }}>
      <Image accessible={false} source={crestSource(scheme)} resizeMode="contain" style={{ width: frame, height: frame, position: 'absolute' }} />
      {face}
    </View>
  );
}

function shownSeal(state: SealState): SealArtName {
  return state === 'claimed' ? 'not-started' : state;
}

export function WaxSeal({ state, size = 36, label }: { state: SealState; size?: number; label?: string }) {
  const { colors, type, typeScale } = useTheme();
  const art = shownSeal(state);
  const text = label ?? t(`seal.${art}`);
  return (
    <View style={styles.seal} accessibilityLabel={text}>
      <Image accessible={false} source={sealSource(art)} resizeMode="contain" style={{ width: size, height: size }} />
      <Text maxFontSizeMultiplier={typeScale.caption} style={[type.caption, { color: colors.text }]}>{text}</Text>
    </View>
  );
}

/** One ribbon image per screen. It can bleed to the screen edge and never sits under text. */
export function RibbonDivider() {
  const { scheme } = useTheme();
  return (
    <Image
      accessible={false}
      source={dividerSource(scheme)}
      resizeMode="stretch"
      style={styles.ribbonImage}
    />
  );
}

export function GiftTagCard({
  personId,
  name,
  title,
  when,
  countdown,
  budgetLabel,
  progress,
  seal,
  action,
}: {
  personId: string;
  name: string;
  title: string;
  when: string;
  countdown: string;
  budgetLabel?: string;
  progress: number | null;
  seal?: SealState;
  action?: React.ReactNode;
}) {
  const { colors, scheme, type, typeScale, radius } = useTheme();
  const amount = progress == null ? 0 : Math.max(0, Math.min(1, progress));
  return (
    <View style={[styles.tag, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.card }]}>
      <Image
        accessible={false}
        source={bowSource(scheme)}
        resizeMode="contain"
        style={styles.bow}
      />
      <View style={styles.tagBody}>
        <MonogramAvatar name={name} personId={personId} />
        <View style={styles.copy}>
          <Text maxFontSizeMultiplier={typeScale.caption} style={[type.caption, { color: colors.muted }]}>{t('people.comingUp')}</Text>
          <Text maxFontSizeMultiplier={typeScale.heading} style={[type.heading, { color: colors.text }]}>{title}</Text>
          <Text maxFontSizeMultiplier={typeScale.body} style={[type.body, { color: colors.text }]}>{when}</Text>
          <Text maxFontSizeMultiplier={typeScale.display} style={[type.display, { color: colors.text }]}>{countdown}</Text>
          {budgetLabel ? (
            <Text maxFontSizeMultiplier={typeScale.caption} style={[type.caption, { color: colors.text }]}>{budgetLabel}</Text>
          ) : null}
          <View style={[styles.track, { backgroundColor: colors.surfaceAlt, borderColor: colors.border, borderWidth: StyleSheet.hairlineWidth }]}>
            {amount > 0 ? <View style={[styles.bar, { width: `${Math.round(amount * 100)}%`, backgroundColor: colors.teal }]} /> : null}
          </View>
          {seal ? <WaxSeal state={seal} /> : null}
          {action}
        </View>
      </View>
    </View>
  );
}

export function FairnessCard({
  rows,
  money,
}: {
  rows: FairnessRow[];
  money: (cents: number) => string;
}) {
  const { colors, type, typeScale, radius } = useTheme();
  const view = fairnessView(rows);
  const summary = view.bars.length === 0
    ? t('fairness.empty')
    : view.balanced
      ? t('fairness.even')
      : t('fairness.within', { amount: money(view.spread) });
  const overall = view.budgetCents == null
    ? t('fairness.overallOpen', { used: money(view.spentCents) })
    : t('fairness.overall', { used: money(view.spentCents), budget: money(view.budgetCents) });
  return (
    <View style={[styles.tag, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.card }]}>
      <View style={styles.fairHead}>
        <Icon name="scale" color={colors.teal} />
        <Text maxFontSizeMultiplier={typeScale.heading} style={[type.heading, { color: colors.text, flex: 1 }]}>{t('fairness.cardTitle')}</Text>
        {view.balanced ? <WaxSeal state="balanced" /> : null}
      </View>
      <Text maxFontSizeMultiplier={typeScale.body} style={[type.body, { color: colors.text }]}>{summary}</Text>
      {view.bars.length > 0 ? (
        <Text maxFontSizeMultiplier={typeScale.caption} style={[type.caption, { color: colors.muted }]}>{overall}</Text>
      ) : null}
      {view.bars.map(bar => {
        const label = bar.budgetCents == null
          ? t('fairness.year', { amount: money(bar.yearSpentCents) })
          : t('people.budgetYear', { used: money(bar.yearSpentCents), budget: money(bar.budgetCents) });
        return (
          <View key={bar.personId} style={styles.fairRow}>
            <View style={styles.fairName}>
              <MonogramAvatar name={bar.name} personId={bar.personId} size={36} />
              <Text maxFontSizeMultiplier={typeScale.body} style={[type.body, { color: colors.text, flex: 1 }]}>{bar.name}</Text>
            </View>
            <View
              accessibilityRole="progressbar"
              accessibilityLabel={label}
              style={[styles.track, { backgroundColor: colors.surfaceAlt, borderColor: colors.border, borderWidth: StyleSheet.hairlineWidth }]}>
              {bar.fraction > 0 ? (
                <View style={[styles.bar, { width: `${Math.round(bar.fraction * 100)}%`, backgroundColor: colors.teal }]} />
              ) : null}
            </View>
            <Text maxFontSizeMultiplier={typeScale.caption} style={[type.caption, { color: colors.text }]}>{label}</Text>
            {bar.behindCents > 0 ? (
              <Text maxFontSizeMultiplier={typeScale.caption} style={[type.caption, { color: colors.muted }]}>
                {t('fairness.behind', { amount: money(bar.behindCents) })}
              </Text>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  monogram: { borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  seal: { flexDirection: 'row', alignItems: 'center', gap: space.xs, minHeight: touch.minTarget },
  ribbonImage: { width: '100%', height: 22, marginHorizontal: -space.md },
  tag: {
    borderWidth: 1,
    padding: space.md,
    gap: space.sm,
    overflow: 'visible',
    shadowColor: '#2B2522',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  bow: { position: 'absolute', top: -10, right: -8, width: 44, height: 36 },
  tagBody: { flexDirection: 'row', gap: space.sm },
  copy: { flex: 1, gap: space.xxs },
  track: { height: 10, borderRadius: 999, overflow: 'hidden' },
  bar: { height: '100%' },
  fairHead: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  fairRow: { gap: space.xxs },
  fairName: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
});
