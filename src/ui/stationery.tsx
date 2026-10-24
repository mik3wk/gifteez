import React from 'react';
import { Pressable, Image, StyleSheet, Text, View } from 'react-native';
import { budgetFraction, budgetTone, formatSpentOfBudget } from '../domain/budgetBar';
import type { CircleMember, CircleSection } from '../domain/circles';
import { fairnessView } from '../domain/fairnessView';
import type { FairnessRow } from '../domain/logic';
import { monogramIndex, monogramLetters, MONOGRAM_SWATCHES } from '../domain/monogram';
import type { SealState } from '../domain/seal';
import { t } from '../i18n';
import { tint } from '../theme/tint';
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
  const { colors, scheme, type, typeScale } = useTheme();
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
          borderColor: colors.background,
          borderWidth: 2,
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

function sealInk(state: SealState, colors: { pink: string; sunshine: string; muted: string; teal: string }): string {
  if (state === 'idea-saved') {
    return colors.pink;
  }
  if (state === 'purchased') {
    return colors.sunshine;
  }
  if (state === 'balanced' || state === 'logged') {
    return colors.teal;
  }
  return colors.muted;
}

/** Wax seal overlapping a short label pill. The seal stays an image; the words are text. */
export function SealPill({ state, label }: { state: SealState; label?: string }) {
  const { colors, type, typeScale } = useTheme();
  const art = shownSeal(state);
  const text = label ?? t(`seal.${art}`);
  const ink = sealInk(state, colors);
  return (
    <View style={styles.sealPill} accessibilityLabel={text}>
      <Image accessible={false} source={sealSource(art)} resizeMode="contain" style={styles.sealImage} />
      <View style={[styles.sealLabel, { borderColor: ink, backgroundColor: tint(ink, 0.14) }]}>
        <Text maxFontSizeMultiplier={typeScale.caption} numberOfLines={1} style={[type.caption, styles.sealText, { color: colors.text }]}>{text}</Text>
      </View>
    </View>
  );
}

export function WaxSeal({ state, label }: { state: SealState; size?: number; label?: string }) {
  return <SealPill state={state} label={label} />;
}

export function BudgetBar({
  spentCents,
  budgetCents,
  caption,
  fill,
}: {
  spentCents: number;
  budgetCents: number | null;
  caption?: string;
  fill?: string;
}) {
  const { colors, type, typeScale } = useTheme();
  const tone = budgetTone(spentCents, budgetCents);
  const ink = fill ?? (tone === 'over' ? colors.pink : tone === 'near' ? colors.sunshine : colors.teal);
  const width = `${Math.round(budgetFraction(spentCents, budgetCents) * 100)}%`;
  return (
    <View accessible={Boolean(caption)} accessibilityLabel={caption}>
      <View style={[styles.budgetTrack, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
        <View style={[styles.budgetFill, { width, backgroundColor: ink }]} />
      </View>
      {caption ? (
        <Text maxFontSizeMultiplier={typeScale.caption} style={[type.caption, styles.budgetCaption, { color: colors.muted }]}>{caption}</Text>
      ) : null}
    </View>
  );
}

export function RowCard({ children }: { children: React.ReactNode }) {
  const { colors, radius } = useTheme();
  return (
    <View style={[styles.rowCard, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.card }]}>
      {children}
    </View>
  );
}

export function ListRow({
  name,
  personId,
  relationship,
  detail,
  budget,
  seal,
  sealLabel,
  onPress,
  last,
}: {
  name: string;
  personId: string;
  relationship?: string;
  detail: string;
  budget: string;
  seal: SealState;
  sealLabel?: string;
  onPress: () => void;
  last?: boolean;
}) {
  const { colors, type } = useTheme();
  const label = [name, relationship, detail, budget, sealLabel ?? t(`seal.${shownSeal(seal)}`)].filter(Boolean).join(', ');
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={[styles.listRow, { borderBottomColor: colors.border, borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth }]}>
      <MonogramAvatar name={name} personId={personId} size={52} />
      <View style={styles.listCopy}>
        <Text numberOfLines={1} style={[styles.listName, { color: colors.text, fontFamily: type.heading.fontFamily }]}>
          {name}
          {relationship ? <Text style={[styles.listMeta, { color: colors.muted }]}>{` · ${relationship}`}</Text> : null}
        </Text>
        <Text numberOfLines={1} style={[styles.listDetail, { color: colors.text }]}>{detail}</Text>
        <Text numberOfLines={1} style={[styles.listBudget, { color: colors.muted }]}>{budget}</Text>
      </View>
      <SealPill state={seal} label={sealLabel} />
      <Icon name="chevron" color={colors.muted} size={18} />
    </Pressable>
  );
}

function memberAmount(member: CircleMember, money: (cents: number) => string): string {
  return formatSpentOfBudget(member.yearSpentCents, member.budgetCents, money);
}

/** The fairness card used on Home and the Fairness tab. Amounts are dollars, never percents. */
export function CircleFairnessCard({
  section,
  money,
  onOpenFairness,
  onOpenIdeas,
  onEdit,
}: {
  section: CircleSection;
  money: (cents: number) => string;
  onOpenFairness?: () => void;
  onOpenIdeas?: (personId: string) => void;
  onEdit?: () => void;
}) {
  const { colors, type, typeScale, radius } = useTheme();
  const behind = section.behind[0];
  const balanced = section.status !== 'behind';
  const spread = section.members.reduce((max, member) => Math.max(max, member.behindCents), 0);
  const top = section.members.reduce((max, member) => Math.max(max, member.yearSpentCents), 0);
  const members = section.members.slice().sort((a, b) => a.name.localeCompare(b.name));
  const fills = [colors.teal, colors.lilac, colors.sunshine];
  const behindLead = section.status === 'behind' && behind
    ? t('fairness.behindLead', { name: behind.name, amount: money(behind.behindCents) })
    : '';
  const footer = section.status === 'empty'
    ? t('fairness.emptyCircle')
    : behindLead
      ? `${behindLead} ${t('fairness.wantIdeas')}`
      : spread === 0
        ? t('fairness.matchedNice')
        : t('fairness.withinNice', { amount: money(spread) });
  const sealLabel = balanced || !behind
    ? undefined
    : t('fairness.behindSeal', { name: behind.name, amount: money(behind.behindCents) });
  const head = (
    <View style={styles.fairHeadBlock}>
      <View style={styles.fairHead}>
        <Icon name="scale" color={colors.sunshine} size={28} />
        <View style={styles.fairTitle}>
          <Text maxFontSizeMultiplier={typeScale.heading} style={[type.heading, { color: colors.text, fontSize: 22 }]}>{t('fairness.cardTitle')}</Text>
          <Text maxFontSizeMultiplier={typeScale.caption} numberOfLines={1} style={[type.caption, { color: colors.muted }]}>{section.name}</Text>
        </View>
      </View>
      {section.status === 'empty' ? null : <SealPill state={balanced ? 'balanced' : 'purchased'} label={sealLabel} />}
    </View>
  );
  const rows = members.map((member, index) => {
    const barBudget = member.budgetCents != null ? member.budgetCents : top > 0 ? top : null;
    const amount = memberAmount(member, money);
    return (
      <View key={member.personId} style={styles.memberLine}>
        <Text numberOfLines={1} maxFontSizeMultiplier={typeScale.body} style={[styles.memberName, { color: colors.text }]}>{member.name}</Text>
        <View style={styles.memberBar}>
          <BudgetBar spentCents={member.yearSpentCents} budgetCents={barBudget} fill={fills[index % fills.length]} />
        </View>
        <Text numberOfLines={1} maxFontSizeMultiplier={typeScale.caption} style={[styles.memberAmount, { color: colors.text }]}>{amount}</Text>
      </View>
    );
  });
  const body = (
    <View style={styles.fairBody}>
      {head}
      {rows}
    </View>
  );
  const openIdeas = section.status === 'behind' && behind && onOpenIdeas ? () => onOpenIdeas(behind.personId) : null;
  return (
    <View style={[styles.tag, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.card }]}>
      {onOpenFairness ? (
        <Pressable accessibilityRole="button" accessibilityLabel={`${t('fairness.cardTitle')}, ${section.name}`} onPress={onOpenFairness}>
          {body}
        </Pressable>
      ) : body}
      {openIdeas ? (
        <Text maxFontSizeMultiplier={typeScale.body} style={[type.body, { color: colors.text }]}>
          {`${behindLead} `}
          <Text
            accessibilityRole="button"
            accessibilityLabel={t('fairness.wantIdeas')}
            onPress={openIdeas}
            style={{ color: colors.pink }}>
            {t('fairness.wantIdeas')}
          </Text>
        </Text>
      ) : (
        <Text maxFontSizeMultiplier={typeScale.body} style={[type.body, { color: colors.text }]}>{footer}</Text>
      )}
      {onEdit ? (
        <Pressable accessibilityRole="button" accessibilityLabel={t('fairness.edit')} onPress={onEdit}>
          <Text maxFontSizeMultiplier={typeScale.button} style={[type.button, { color: colors.pink }]}>{t('fairness.edit')}</Text>
        </Pressable>
      ) : null}
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
  monogram: { alignItems: 'center', justifyContent: 'center' },
  seal: { flexDirection: 'row', alignItems: 'center', gap: space.xs, minHeight: touch.minTarget },
  sealPill: { flexDirection: 'row', alignItems: 'center', height: 28 },
  sealImage: { width: 28, height: 28, marginRight: -14, zIndex: 1 },
  sealLabel: { height: 28, borderRadius: 14, borderWidth: 1, justifyContent: 'center', paddingLeft: 18, paddingRight: 10, maxWidth: 168 },
  sealText: { fontSize: 13 },
  budgetTrack: { height: 6, borderRadius: 3, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  budgetFill: { height: 6, borderRadius: 3 },
  budgetCaption: { marginTop: 4 },
  rowCard: { borderWidth: 1, overflow: 'hidden' },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs, minHeight: 76, paddingHorizontal: space.sm, paddingVertical: space.xs },
  listCopy: { flex: 1, gap: 2 },
  listName: { fontSize: 20, lineHeight: 24 },
  listMeta: { fontSize: 15, lineHeight: 20 },
  listDetail: { fontSize: 15, lineHeight: 20 },
  listBudget: { fontSize: 13, lineHeight: 16 },
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
  fairHeadBlock: { gap: space.xs },
  fairHead: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  fairTitle: { flex: 1, gap: 2 },
  fairBody: { gap: space.sm },
  memberLine: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  memberName: { width: 88, fontSize: 15, lineHeight: 20 },
  memberBar: { flex: 1 },
  memberAmount: { width: 96, fontSize: 13, lineHeight: 16, textAlign: 'right' },
  fairRow: { gap: space.xxs },
  fairName: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
});
