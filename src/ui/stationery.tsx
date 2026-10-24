import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { fairnessView } from '../domain/fairnessView';
import type { FairnessRow } from '../domain/logic';
import { monogramIndex, monogramLetters, MONOGRAM_SWATCHES } from '../domain/monogram';
import { SEAL_PAINT, type SealState } from '../domain/seal';
import { t } from '../i18n';
import { useTheme } from '../theme/useTheme';
import { space, touch } from '../theme/tokens';
import { Icon, type IconName } from './icons';

const SEAL_ICON: Record<SealState, IconName> = {
  'not-started': 'calendar',
  'idea-saved': 'heart',
  purchased: 'gift',
  claimed: 'check',
  logged: 'check',
  balanced: 'scale',
};

export function BowMark({ color, size = 18 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size * 0.62} viewBox="0 0 18 11" accessibilityElementsHidden>
      <Path
        d="M9 5.5C6.2 5.5 3.4 2 1 2c2.2 2 2.4 4.2.2 5.2C3.6 8 6.2 5.5 9 5.5zM9 5.5c2.8 0 5.6-3.5 8-3.5-2.2 2-2.4 4.2-.2 5.2C14.4 8 11.8 5.5 9 5.5z"
        fill={color}
      />
    </Svg>
  );
}

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
  const { type, typeScale } = useTheme();
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
  const frame = Math.round(size * 1.35);
  return (
    <View accessibilityElementsHidden style={{ width: frame, height: frame, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={frame} height={frame} viewBox="0 0 64 64" style={StyleSheet.absoluteFill}>
        <Path
          d="M32 6c8 6 14 8 22 8-2 14-6 24-22 32C16 38 12 28 10 14c8 0 14-2 22-8z"
          stroke={swatch.fill}
          strokeWidth={1.5}
          fill="none"
        />
      </Svg>
      {face}
      <View style={styles.crestBow}>
        <BowMark color={swatch.fill} size={16} />
      </View>
    </View>
  );
}

export function WaxSeal({ state, size = 28 }: { state: SealState; size?: number }) {
  const { scheme, type, typeScale } = useTheme();
  const paint = SEAL_PAINT[scheme][state];
  const label = t(`seal.${state}`);
  return (
    <View style={styles.seal} accessibilityLabel={label}>
      <View
        style={[
          styles.sealFace,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: paint.fill,
            borderColor: paint.ring,
          },
        ]}>
        <Icon name={SEAL_ICON[state]} color={paint.ink} size={Math.max(14, size * 0.5)} />
      </View>
      <Text maxFontSizeMultiplier={typeScale.caption} style={[type.caption, { color: paint.ink }]}>{label}</Text>
    </View>
  );
}

/** One ribbon per screen. It can bleed to the screen edge and never sits under text. */
export function RibbonDivider() {
  const { colors, scheme } = useTheme();
  return (
    <View accessibilityElementsHidden style={[styles.ribbonRow, scheme === 'dark' ? styles.ribbonQuiet : null]}>
      <BowMark color={colors.pink} />
      <View style={[styles.ribbon, { backgroundColor: colors.pink }]} />
    </View>
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
  const { colors, type, typeScale, radius } = useTheme();
  const amount = progress == null ? 0 : Math.max(0, Math.min(1, progress));
  return (
    <View style={[styles.tag, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.card }]}>
      <View style={styles.holeWrap} accessibilityElementsHidden>
        <View style={[styles.string, { backgroundColor: colors.muted }]} />
        <View style={[styles.hole, { backgroundColor: colors.background, borderColor: colors.border }]} />
      </View>
      <View style={styles.faintBow} accessibilityElementsHidden>
        <BowMark color={colors.pink} size={28} />
      </View>
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
          <View style={[styles.track, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
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
              style={[styles.track, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
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
  crestBow: { position: 'absolute', bottom: 0 },
  seal: { flexDirection: 'row', alignItems: 'center', gap: space.xs, minHeight: touch.minTarget },
  sealFace: { borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  ribbonRow: { flexDirection: 'row', alignItems: 'center', marginHorizontal: -space.md, gap: space.xs },
  ribbonQuiet: { opacity: 0.55 },
  ribbon: { flex: 1, height: 3, borderRadius: 2 },
  tag: {
    borderWidth: 1,
    padding: space.md,
    gap: space.sm,
    shadowColor: '#2B2522',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  holeWrap: { position: 'absolute', top: 10, left: 10, width: 18, height: 28 },
  string: { position: 'absolute', top: 0, left: 7, width: 1, height: 16 },
  hole: { position: 'absolute', top: 12, width: 14, height: 14, borderRadius: 7, borderWidth: 1 },
  faintBow: { position: 'absolute', top: 8, right: 10, opacity: 0.35 },
  tagBody: { flexDirection: 'row', gap: space.sm, paddingTop: space.sm },
  copy: { flex: 1, gap: space.xxs },
  track: { height: 10, borderRadius: 999, borderWidth: 1, overflow: 'hidden' },
  bar: { height: '100%' },
  fairHead: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  fairRow: { gap: space.xxs },
  fairName: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
});
