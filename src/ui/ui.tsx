import React, { useContext, useEffect, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  useColorScheme,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { HeaderHeightContext } from '@react-navigation/elements';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { RootStack } from '../app/navigation';
import { getEnv } from '../config/env';
import { formatMoney, t } from '../i18n';
import { useGifteez } from '../state/GifteezContext';
import { readable } from '../theme/skins';
import { useTheme } from '../theme/useTheme';
import { layout, shadowOffset, space, stroke, touch } from '../theme/tokens';
import { EMPTY_LOOK, occasionLook, type ArtName, type ChipTint, type EmptyArtName } from '../theme/tokens';
import { Icon, type IconName } from './icons';

/** A stack header already includes the status bar, so a second top inset doubles the gap. */
export function screenTopInset(headerHeight: number | undefined, topInset: number): number {
  return headerHeight ? 0 : topInset;
}

function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduce).catch(() => undefined);
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => subscription.remove();
  }, []);
  return reduce;
}

function StickerBox({
  children,
  fill,
  radius,
  borderWidth,
  pressed,
  dashed,
  shadow = true,
  style,
}: {
  children: React.ReactNode;
  fill: string;
  radius: number;
  borderWidth: number;
  pressed?: boolean;
  dashed?: boolean;
  shadow?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const reduce = useReduceMotion();
  const shift = Boolean(pressed) && !reduce && shadow;
  return (
    <View style={[styles.stickerWrap, style]}>
      {shadow && !shift ? (
        <View pointerEvents="none" style={[styles.stickerShadow, { backgroundColor: colors.shadow, borderRadius: radius }]} />
      ) : null}
      <View
        style={{
          backgroundColor: fill,
          borderColor: colors.outline,
          borderWidth,
          borderStyle: dashed ? 'dashed' : 'solid',
          borderRadius: radius,
          transform: shift ? [{ translateX: shadowOffset }, { translateY: shadowOffset }] : [],
        }}>
        {children}
      </View>
    </View>
  );
}

export type TabId = 'people' | 'fairness' | 'group' | 'settings';

export function Screen({
  children,
  footer,
  centered,
  tab,
}: {
  children: React.ReactNode;
  footer?: React.ReactNode;
  centered?: boolean;
  tab?: TabId;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const headerHeight = useContext(HeaderHeightContext);
  const bar = tab ? <TabBar active={tab} /> : footer;
  return (
    <KeyboardAvoidingView
      style={[styles.screen, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={headerHeight ?? 0}>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={[
          styles.content,
          centered ? styles.centered : null,
          {
            paddingTop: screenTopInset(headerHeight, insets.top) + space.sm,
            paddingBottom: (bar ? space.sm : insets.bottom + space.lg) + layout.toastGap,
          },
        ]}
        keyboardShouldPersistTaps="handled">
        <View style={styles.column}>{children}</View>
      </ScrollView>
      {bar ? (
        <View style={[styles.footer, { backgroundColor: colors.background, paddingBottom: insets.bottom + space.xs }]}>
          {bar}
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}

export function Stack({ children }: { children: React.ReactNode }) {
  return <View style={styles.stack}>{children}</View>;
}

export function Cluster({ children }: { children: React.ReactNode }) {
  return <View style={styles.cluster}>{children}</View>;
}

export function Split({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.split}>
      {React.Children.map(children, child => <View style={styles.splitItem}>{child}</View>)}
    </View>
  );
}

export function Progress({ step, total }: { step: number; total: number }) {
  const { colors } = useTheme();
  return (
    <View accessibilityLabel={t('firstOpen.progress', { step, total })} style={styles.progress}>
      {Array.from({ length: total }, (_, index) => (
        <View
          key={index}
          style={[styles.progressDot, { backgroundColor: index < step ? colors.ink : colors.surfaceAlt, borderColor: colors.outline }]}
        />
      ))}
    </View>
  );
}

export function Title({ children, accessibilityLabel }: { children: string; accessibilityLabel?: string }) {
  const { colors, type, typeScale } = useTheme();
  return (
    <Text
      accessibilityRole="header"
      accessibilityLabel={accessibilityLabel ?? children}
      maxFontSizeMultiplier={typeScale.title}
      style={[type.title, styles.ink, { color: colors.text }]}>
      {children}
    </Text>
  );
}

export function Heading({ children }: { children: string }) {
  const { colors, type, typeScale } = useTheme();
  return (
    <Text accessibilityRole="header" maxFontSizeMultiplier={typeScale.heading} style={[type.heading, styles.ink, { color: colors.text }]}>
      {children}
    </Text>
  );
}

export function Body({ children, strong, accessibilityLabel }: { children: string; strong?: boolean; accessibilityLabel?: string }) {
  const { colors, type, typeScale } = useTheme();
  return (
    <Text accessibilityLabel={accessibilityLabel} maxFontSizeMultiplier={typeScale.body} style={[strong ? type.heading : type.body, styles.ink, { color: colors.text }]}>
      {children}
    </Text>
  );
}

export function Caption({ children, tone = 'muted' }: { children: string; tone?: 'muted' | 'danger' | 'text' }) {
  const { colors, type, typeScale } = useTheme();
  const color = tone === 'danger' ? colors.dangerText : tone === 'text' ? colors.text : colors.muted;
  return (
    <Text maxFontSizeMultiplier={typeScale.caption} style={[type.caption, styles.ink, { color }]}>
      {children}
    </Text>
  );
}

export function Display({ children }: { children: string }) {
  const { colors, type, typeScale } = useTheme();
  return (
    <Text maxFontSizeMultiplier={typeScale.display} style={[type.display, styles.ink, { color: colors.text }]}>
      {children}
    </Text>
  );
}

type ConfirmRequest = {
  title: string;
  message: string;
  confirmLabel: string;
  resolve: (value: boolean) => void;
};

let confirmListener: ((request: ConfirmRequest | null) => void) | null = null;

export function confirmDestructive(title: string, message: string, confirmLabel: string): Promise<boolean> {
  return new Promise(resolve => {
    if (!confirmListener) {
      let settled = false;
      const finish = (value: boolean) => {
        if (settled) {
          return;
        }
        settled = true;
        resolve(value);
      };
      Alert.alert(title, message, [
        { text: t('common.cancel'), style: 'cancel', onPress: () => finish(false) },
        { text: confirmLabel, style: 'destructive', onPress: () => finish(true) },
      ], { cancelable: true, onDismiss: () => finish(false) });
      return;
    }
    confirmListener({ title, message, confirmLabel, resolve });
  });
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.scrim} accessibilityViewIsModal>
      <View style={[styles.scrimFill, { backgroundColor: colors.ink }]} />
      <View style={styles.dialog}>
        <Card>
          <Heading>{title}</Heading>
          <Body>{message}</Body>
          <Button label={confirmLabel} tone="danger" onPress={onConfirm} />
          <Button label={t('common.cancel')} tone="secondary" onPress={onCancel} />
        </Card>
      </View>
    </View>
  );
}

export function ConfirmHost() {
  const [request, setRequest] = useState<ConfirmRequest | null>(null);
  useEffect(() => {
    confirmListener = setRequest;
    return () => {
      if (confirmListener === setRequest) {
        confirmListener = null;
      }
    };
  }, []);
  if (!request) {
    return null;
  }
  const finish = (value: boolean) => {
    request.resolve(value);
    setRequest(null);
  };
  return (
    <ConfirmDialog
      title={request.title}
      message={request.message}
      confirmLabel={request.confirmLabel}
      onConfirm={() => finish(true)}
      onCancel={() => finish(false)}
    />
  );
}

export function Button({
  label,
  onPress,
  tone = 'primary',
  disabled,
  busy,
  flex,
  compact,
  icon,
  accessibilityLabel,
}: {
  label: string;
  onPress: () => void | Promise<unknown>;
  tone?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'danger-quiet';
  disabled?: boolean;
  busy?: boolean;
  flex?: boolean;
  compact?: boolean;
  icon?: IconName;
  accessibilityLabel?: string;
}) {
  const { colors, type, typeScale } = useTheme();
  const [pending, setPending] = useState(false);
  const working = pending || Boolean(busy);
  const blocked = Boolean(disabled) || working;
  const quiet = Boolean(disabled) && !working;
  const danger = tone === 'danger' || tone === 'danger-quiet';
  const ghost = tone === 'ghost';
  const fill = quiet ? colors.surfaceAlt : tone === 'primary' ? colors.button : colors.surface;
  const text = quiet ? colors.muted : tone === 'primary' ? colors.onButton : danger ? colors.dangerText : colors.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: blocked, busy: working }}
      disabled={blocked}
      onPress={() => {
        const result = onPress();
        if (!result || typeof (result as Promise<unknown>).then !== 'function') {
          return;
        }
        const timer = setTimeout(() => setPending(true), 0);
        Promise.resolve(result).finally(() => {
          clearTimeout(timer);
          setPending(false);
        });
      }}
      style={[flex ? styles.buttonFlex : null, compact ? styles.compact : null]}>
      {({ pressed }) => (
        <StickerBox
          fill={ghost ? 'transparent' : fill}
          radius={999}
          borderWidth={ghost ? 0 : stroke.control}
          pressed={pressed && !blocked}
          shadow={!ghost && !quiet}>
          <View style={styles.buttonInner}>
            {working ? <ActivityIndicator color={text} /> : (
              <View style={styles.buttonRow}>
                {icon ? <Icon name={icon} color={text} size={18} /> : null}
                <Text maxFontSizeMultiplier={typeScale.button} style={[type.button, { color: text, textAlign: 'center' }]}>{label}</Text>
              </View>
            )}
          </View>
        </StickerBox>
      )}
    </Pressable>
  );
}

export function Row({
  onPress,
  accessibilityLabel,
  children,
}: {
  onPress: () => void;
  accessibilityLabel: string;
  children: React.ReactNode;
}) {
  const { colors, radius } = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} onPress={onPress}>
      {({ pressed }) => (
        <StickerBox fill={colors.surface} radius={radius.card} borderWidth={stroke.card} pressed={pressed}>
          <View style={styles.rowButton}>{children}</View>
        </StickerBox>
      )}
    </Pressable>
  );
}

export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  accessibilityLabel,
  error,
  invalid,
  returnKeyType,
  textContentType,
  autoComplete,
  onSubmitEditing,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'email-address' | 'phone-pad' | 'number-pad' | 'decimal-pad';
  accessibilityLabel?: string;
  error?: string;
  invalid?: boolean;
  returnKeyType?: 'done' | 'next' | 'go' | 'search';
  textContentType?: 'name' | 'emailAddress' | 'telephoneNumber' | 'oneTimeCode' | 'none';
  autoComplete?: 'name' | 'email' | 'tel' | 'sms-otp' | 'off';
  onSubmitEditing?: () => void;
}) {
  const { colors, type, typeScale, radius } = useTheme();
  const bad = Boolean(error) || Boolean(invalid);
  return (
    <View style={styles.field}>
      <Caption>{label}</Caption>
      <TextInput
        accessibilityLabel={error ? `${accessibilityLabel ?? label}. ${error}` : (accessibilityLabel ?? label)}
        accessibilityHint={error}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        keyboardType={keyboardType}
        autoCapitalize={keyboardType === 'email-address' ? 'none' : 'sentences'}
        autoCorrect={keyboardType === 'email-address' ? false : undefined}
        returnKeyType={returnKeyType}
        textContentType={textContentType}
        autoComplete={autoComplete}
        onSubmitEditing={onSubmitEditing}
        maxFontSizeMultiplier={typeScale.body}
        style={[
          type.body,
          styles.input,
          {
            color: colors.text,
            borderColor: bad ? colors.dangerText : colors.outline,
            backgroundColor: colors.surface,
            borderRadius: radius.card,
          },
        ]}
      />
      {error ? <Caption tone="danger">{error}</Caption> : null}
    </View>
  );
}

export function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ id: string; label: string }>;
  onChange: (id: string) => void;
}) {
  return (
    <Stack>
      <Caption tone="text">{label}</Caption>
      {options.map(option => (
        <Chip
          key={option.id}
          block
          label={option.label}
          selected={option.id === value}
          onPress={() => onChange(option.id)}
        />
      ))}
    </Stack>
  );
}

export function Banner({
  text,
  action,
  onAction,
  onDismiss,
}: {
  text: string;
  action?: string;
  onAction?: () => void;
  onDismiss?: () => void;
}) {
  const { colors, radius } = useTheme();
  return (
    <StickerBox fill={colors.banner} radius={radius.card} borderWidth={stroke.card}>
      <View style={styles.pad}>
        <Body>{text}</Body>
        <Cluster>
          {action && onAction ? <Button compact label={action} tone="secondary" onPress={onAction} /> : null}
          {onDismiss ? <Button compact label={t('people.dismiss')} tone="ghost" onPress={onDismiss} /> : null}
        </Cluster>
      </View>
    </StickerBox>
  );
}

export function Notice({
  text,
  onClose,
  tone = 'success',
  action,
  onAction,
}: {
  text: string;
  onClose: () => void;
  tone?: 'success' | 'danger';
  action?: string;
  onAction?: () => void;
}) {
  const { colors, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const closeRef = React.useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const timer = setTimeout(() => closeRef.current(), 5000);
    return () => clearTimeout(timer);
  }, [text]);
  return (
    <View
      pointerEvents="box-none"
      accessibilityRole={tone === 'danger' ? 'alert' : 'none'}
      accessibilityLiveRegion={tone === 'danger' ? 'assertive' : 'polite'}
      style={[styles.notice, { bottom: insets.bottom + layout.tabBar + space.xs }]}>
      <StickerBox fill={colors.surface} radius={radius.card} borderWidth={stroke.card}>
        <View style={styles.pad}>
          <Caption tone={tone === 'danger' ? 'danger' : 'text'}>{text}</Caption>
          <Cluster>
            {action && onAction ? <Button compact label={action} tone="secondary" onPress={onAction} /> : null}
            <Button compact label={t('common.dismiss')} tone="ghost" onPress={onClose} />
          </Cluster>
        </View>
      </StickerBox>
    </View>
  );
}

export function OfflineBanner({ text }: { text: string }) {
  const { colors, radius } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View accessibilityLiveRegion="polite" pointerEvents="none" style={[styles.offline, { top: insets.top + space.xs }]}>
      <StickerBox fill={colors.surface} radius={radius.card} borderWidth={stroke.inner}>
        <View style={styles.pad}>
          <Caption tone="text">{text}</Caption>
        </View>
      </StickerBox>
    </View>
  );
}

export function Card({
  children,
  variant = 'default',
  style,
}: {
  children: React.ReactNode;
  variant?: 'default' | 'accent' | 'dashed';
  style?: StyleProp<ViewStyle>;
}) {
  const { colors, radius } = useTheme();
  const fill = variant === 'accent' ? colors.sunshine : colors.surface;
  return (
    <StickerBox
      fill={fill}
      radius={radius.card}
      borderWidth={stroke.card}
      dashed={variant === 'dashed'}
      shadow={variant !== 'dashed'}
      style={style}>
      <View style={styles.pad}>{children}</View>
    </StickerBox>
  );
}

export function ArtSlot({ name, size = 88 }: { name: ArtName | EmptyArtName; size?: number }) {
  const { colors, radius } = useTheme();
  const look = name in EMPTY_LOOK ? EMPTY_LOOK[name as EmptyArtName] : { art: name as ArtName, emoji: occasionLook(name).emoji };
  const tint = colors.sunshine;
  return (
    <View
      accessibilityElementsHidden
      style={{ width: size, height: size, transform: [{ rotate: '-3deg' }] }}>
      <StickerBox fill={tint} radius={radius.card} borderWidth={stroke.card}>
        <View style={[styles.art, { height: size - shadowOffset }]}>
          <Text style={{ fontSize: Math.round(size * 0.42) }}>{look.emoji}</Text>
        </View>
      </StickerBox>
    </View>
  );
}

export function EmptyState({
  kind,
  text,
  action,
  onAction,
}: {
  kind: EmptyArtName;
  text: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <Card variant="dashed">
      <View style={styles.empty}>
        <ArtSlot name={kind} />
        <Body>{text}</Body>
        {action && onAction ? <Button label={action} onPress={onAction} /> : null}
      </View>
    </Card>
  );
}

export function BrandedLoading() {
  return (
    <View style={styles.empty}>
      <ArtSlot name="gift" size={120} />
      <Title>{t('appName')}</Title>
      <Body>{t('common.loading')}</Body>
    </View>
  );
}

export function Avatar({
  initials,
  hue,
}: {
  initials: string;
  hue?: string;
}) {
  const { colors, type, typeScale } = useTheme();
  const fill = hue || colors.pink;
  const ink = readable(colors.text, [fill]);
  return (
    <View style={[styles.avatar, { backgroundColor: fill, borderColor: colors.outline }]}>
      <Text maxFontSizeMultiplier={typeScale.heading} style={[type.heading, { color: ink }]}>{initials.slice(0, 1).toUpperCase()}</Text>
    </View>
  );
}

export function ProgressBar({ value }: { value: number | null }) {
  const { colors, radius } = useTheme();
  const amount = value == null ? 0 : Math.max(0, Math.min(1, value));
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(amount * 100) }}
      style={[styles.track, { borderColor: colors.outline, backgroundColor: colors.surfaceAlt, borderRadius: radius.pill }]}>
      {amount > 0 ? (
        <View style={[styles.bar, { width: `${Math.round(amount * 100)}%`, backgroundColor: colors.teal, borderRadius: radius.pill }]} />
      ) : null}
    </View>
  );
}

export function OccasionChip({
  occasionId,
  label,
  trailing,
}: {
  occasionId: string;
  label: string;
  trailing?: string;
}) {
  const { colors, type, typeScale } = useTheme();
  const look = occasionLook(occasionId);
  const fill = colors[look.chip];
  const ink = colors[`on${look.chip[0].toUpperCase()}${look.chip.slice(1)}` as 'onPink'];
  const text = trailing ? `${look.emoji} ${label} ${trailing}` : `${look.emoji} ${label}`;
  return (
    <View style={[styles.chip, { backgroundColor: fill, borderColor: colors.outline, alignSelf: 'flex-start' }]}>
      <Text maxFontSizeMultiplier={typeScale.caption} style={[type.caption, { color: ink }]}>{text}</Text>
    </View>
  );
}

export function SectionHeader({
  title,
  action,
  onAction,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.sectionHeader}>
      <Heading>{title}</Heading>
      {action && onAction ? <Button compact icon="plus" label={action} tone="secondary" onPress={onAction} /> : null}
    </View>
  );
}

export function HeroCard({
  kicker,
  title,
  figure,
  unit,
  detail,
  action,
  onAction,
  art,
}: {
  kicker: string;
  title: string;
  figure: string;
  unit?: string;
  detail: string;
  action: string;
  onAction: () => void;
  art: ArtName;
}) {
  const { colors } = useTheme();
  return (
    <StickerBox fill={colors.sunshine} radius={16} borderWidth={stroke.card}>
      <View style={styles.hero}>
        <View style={styles.heroCopy}>
          <Caption tone="text">{kicker}</Caption>
          <Heading>{title}</Heading>
          <Display>{figure}</Display>
          {unit ? <Caption tone="text">{unit}</Caption> : null}
          <Caption tone="text">{detail}</Caption>
          <Button icon="gift" label={action} onPress={onAction} />
        </View>
        <ArtSlot name={art} size={108} />
      </View>
    </StickerBox>
  );
}

export function StatTile({
  value,
  label,
  icon,
  tint,
  onPress,
}: {
  value: string;
  label: string;
  icon: IconName;
  tint: ChipTint;
  onPress?: () => void;
}) {
  const { colors, type, typeScale } = useTheme();
  const iconColor = colors[tint];
  const body = (
    <StickerBox fill={colors.surface} radius={16} borderWidth={stroke.card}>
      <View style={styles.stat}>
        <Icon name={icon} color={iconColor} />
        <Text maxFontSizeMultiplier={typeScale.title} style={[type.title, { color: colors.text }]}>{value}</Text>
        <Caption>{label}</Caption>
      </View>
    </StickerBox>
  );
  if (!onPress) {
    return <View style={styles.statFlex}>{body}</View>;
  }
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${value} ${label}`} onPress={onPress} style={styles.statFlex}>
      {body}
    </Pressable>
  );
}

export function StatRow({ children }: { children: React.ReactNode }) {
  return <View style={styles.statRow}>{children}</View>;
}

export function PersonRow({
  name,
  initials,
  hue,
  occasionId,
  occasionLabel,
  trailing,
  budget,
  progress,
  note,
  onPress,
  accessibilityLabel,
}: {
  name: string;
  initials: string;
  hue: string;
  occasionId?: string;
  occasionLabel?: string;
  trailing?: string;
  budget: string;
  progress: number | null;
  note?: string;
  onPress: () => void;
  accessibilityLabel: string;
}) {
  const { colors } = useTheme();
  return (
    <Row accessibilityLabel={accessibilityLabel} onPress={onPress}>
      <View style={styles.person}>
        <Avatar initials={initials} hue={hue} />
        <View style={styles.personCopy}>
          <Body strong>{name}</Body>
          {occasionId && occasionLabel ? (
            <OccasionChip occasionId={occasionId} label={occasionLabel} trailing={trailing} />
          ) : (
            <Caption>{note || ''}</Caption>
          )}
          {budget ? <Caption tone="text">{budget}</Caption> : null}
          <ProgressBar value={progress} />
        </View>
        <Icon name="chevron" color={colors.text} />
      </View>
    </Row>
  );
}

export function AppHeader({ title, greeting }: { title: string; greeting?: string }) {
  const { snapshot, setReminders } = useGifteez();
  const [open, setOpen] = useState(false);
  const on = snapshot.profile.reminders === 'on';
  return (
    <View style={styles.header}>
      <View style={styles.headerCopy}>
        <ArtSlot name="gift" size={56} />
        <View style={styles.personCopy}>
          {greeting ? <Caption>{greeting}</Caption> : null}
          <Title>{title}</Title>
        </View>
      </View>
      <IconButton label={t('person.remindTitle')} name="bell" onPress={() => setOpen(true)} />
      <Sheet visible={open} onClose={() => setOpen(false)}>
        <Heading>{t('person.remindTitle')}</Heading>
        <Body>{on ? t('people.remindersOn') : t('person.remindBody')}</Body>
        {on ? (
          <Button label={t('person.remindNo')} tone="secondary" onPress={() => { setReminders(false).catch(() => undefined); setOpen(false); }} />
        ) : (
          <Button label={t('person.remindYes')} onPress={() => { setReminders(true).catch(() => undefined); setOpen(false); }} />
        )}
      </Sheet>
    </View>
  );
}

const TABS: Array<{ id: TabId; icon: IconName; label: string; route: 'People' | 'Fairness' | 'Group' | 'Settings' }> = [
  { id: 'people', icon: 'people', label: t('people.title'), route: 'People' },
  { id: 'fairness', icon: 'scale', label: t('people.fairness'), route: 'Fairness' },
  { id: 'group', icon: 'gift', label: t('people.group'), route: 'Group' },
  { id: 'settings', icon: 'gear', label: t('people.settings'), route: 'Settings' },
];

export function TabBar({ active }: { active: TabId }) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStack>>();
  const { colors, type, typeScale, radius } = useTheme();
  return (
    <StickerBox fill={colors.surface} radius={radius.card} borderWidth={stroke.card}>
      <View style={styles.tabs}>
        {TABS.map(tab => {
          const selected = tab.id === active;
          const ink = selected ? colors.onPink : colors.text;
          return (
            <Pressable
              key={tab.id}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              accessibilityLabel={tab.label}
              onPress={() => navigation.navigate(tab.route)}
              style={styles.tab}>
              <View style={[styles.tabIcon, selected ? { backgroundColor: colors.pink, borderRadius: radius.pill } : null]}>
                <Icon name={tab.icon} color={ink} size={20} />
              </View>
              <Text maxFontSizeMultiplier={typeScale.caption} style={[type.caption, { color: colors.text }]}>{tab.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </StickerBox>
  );
}

export function IconButton({
  label,
  name,
  onPress,
  color,
  filled,
}: {
  label: string;
  name: IconName;
  onPress: () => void;
  color?: string;
  filled?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={styles.iconButton}>
      <Icon name={name} color={color || colors.text} filled={filled} />
    </Pressable>
  );
}

export function HeaderTextButton({ label, onPress }: { label: string; onPress: () => void }) {
  const { colors, type, typeScale } = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={styles.iconButton}>
      <Text maxFontSizeMultiplier={typeScale.button} style={[type.button, { color: colors.text }]}>{label}</Text>
    </Pressable>
  );
}

export function HueDot({ color }: { color: string }) {
  const { colors } = useTheme();
  return <View accessibilityElementsHidden style={[styles.hue, { backgroundColor: color, borderColor: colors.outline }]} />;
}

export function CheckRow({
  label,
  checked,
  onPress,
}: {
  label: string;
  checked: boolean;
  onPress: () => void;
}) {
  const { colors, type, typeScale } = useTheme();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked }}
      onPress={onPress}
      style={styles.checkRow}>
      <View style={[styles.box, { borderColor: colors.outline, backgroundColor: checked ? colors.button : colors.surface }]}>
        {checked ? <Icon name="check" color={colors.onButton} size={16} /> : null}
      </View>
      <Text maxFontSizeMultiplier={typeScale.body} style={[type.body, styles.ink, { color: colors.text }]}>{label}</Text>
    </Pressable>
  );
}

export function Sheet({
  visible,
  onClose,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme();
  return (
    <Modal key={scheme ?? 'light'} visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.screen, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <IconButton label={t('common.close')} name="close" onPress={onClose} />
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + layout.toastGap }]} keyboardShouldPersistTaps="handled">
          <View style={styles.column}>{children}</View>
        </ScrollView>
      </View>
    </Modal>
  );
}

export function UnlockSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { buy, restorePurchases, storeProduct, storeReady } = useGifteez();
  const price = storeProduct?.displayPrice || formatMoney(Math.round(getEnv().iapPriceUsd * 100));
  return (
    <Sheet visible={visible} onClose={onClose}>
      <Title>{t('settings.unlock')}</Title>
      <Body>{t('groupScreen.oneList')}</Body>
      <Body>{t('settings.unlockPrice', { price })}</Body>
      {storeReady ? null : <Body>{t('settings.storeMissing')}</Body>}
      <Button label={t('settings.unlock')} onPress={buy} />
      <Button label={t('settings.restore')} tone="secondary" onPress={restorePurchases} />
    </Sheet>
  );
}

export function AccountSheet({
  visible,
  allowName,
  showCreate,
  onCreate,
  onClose,
}: {
  visible: boolean;
  allowName: boolean;
  showCreate: boolean;
  onCreate?: (name: string, groupName: string) => void;
  onClose: () => void;
}) {
  const { snapshot, sendEmail, finishEmail, sendPhone, confirmPhone } = useGifteez();
  const [name, setName] = useState(snapshot.profile.displayName);
  const [groupName, setGroupName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [link, setLink] = useState('');
  const [sms, setSms] = useState(false);
  const [emailError, setEmailError] = useState('');
  return (
    <Sheet visible={visible} onClose={onClose}>
      <Title>{showCreate ? t('groupCreate.title') : t('settings.account')}</Title>
      <Body>{showCreate ? t('groupCreate.body') : t('settings.anonymous')}</Body>
      {allowName ? (
        <Field label={t('groupCreate.name')} value={name} onChangeText={setName} textContentType="name" autoComplete="name" />
      ) : null}
      {showCreate ? (
        <>
          <Field label={t('groupCreate.listName')} value={groupName} onChangeText={setGroupName} />
          <Body>{t('groupCreate.listNameHint')}</Body>
        </>
      ) : null}
      {showCreate && onCreate ? <Button label={t('groupCreate.create')} onPress={() => onCreate(name, groupName)} /> : null}
      <Heading>{t('groupCreate.secureTitle')}</Heading>
      <Body>{t('groupCreate.secureBody')}</Body>
      <Body>{t('groupCreate.emailWhy')}</Body>
      <Field
        label={t('groupCreate.email')}
        value={email}
        error={emailError}
        onChangeText={value => {
          setEmail(value);
          setEmailError('');
        }}
        keyboardType="email-address"
        textContentType="emailAddress"
        autoComplete="email"
      />
      <Button
        label={t('groupCreate.sendLink')}
        tone={showCreate ? 'secondary' : 'primary'}
        onPress={() => {
          if (!email.includes('@')) {
            setEmailError(t('errors.email'));
            return;
          }
          return sendEmail(email);
        }}
        disabled={!email.trim()}
      />
      <Field label={t('groupCreate.pasteLink')} value={link} onChangeText={setLink} />
      <Button label={t('groupCreate.finishLink')} tone="secondary" onPress={() => finishEmail(link)} disabled={!link.trim()} />
      <Button label={t('groupCreate.useSms')} onPress={() => setSms(true)} tone="secondary" />
      {sms ? (
        <>
          <Body>{t('groupCreate.smsRegion')}</Body>
          <Field label={t('groupCreate.phone')} value={phone} onChangeText={setPhone} keyboardType="phone-pad" textContentType="telephoneNumber" autoComplete="tel" />
          <Button label={t('groupCreate.sendCode')} tone="secondary" onPress={() => sendPhone(phone)} disabled={!phone.trim()} />
          <Field label={t('groupCreate.code')} value={code} onChangeText={setCode} keyboardType="number-pad" textContentType="oneTimeCode" autoComplete="sms-otp" />
          <Button label={t('groupCreate.confirmCode')} tone="secondary" onPress={() => confirmPhone(code)} disabled={!code.trim()} />
        </>
      ) : null}
      <Button label={showCreate ? t('groupCreate.skip') : t('common.close')} onPress={onClose} tone="ghost" />
    </Sheet>
  );
}

export function Segment({
  value,
  options,
  onChange,
}: {
  value: string;
  options: Array<{ id: string; label: string }>;
  onChange: (id: string) => void;
}) {
  const { colors, type, typeScale } = useTheme();
  return (
    <View style={[styles.segment, { backgroundColor: colors.surface, borderColor: colors.outline }]}>
      {options.map(option => {
        const selected = option.id === value;
        return (
          <Pressable
            key={option.id}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={option.label}
            onPress={() => onChange(option.id)}
            style={[styles.segmentItem, { backgroundColor: selected ? colors.pink : 'transparent' }]}>
            <Text maxFontSizeMultiplier={typeScale.button} style={[type.button, { color: selected ? colors.onPink : colors.text }]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Chip({
  label,
  selected,
  onPress,
  block,
}: {
  label: string;
  selected?: boolean;
  onPress: () => void;
  block?: boolean;
}) {
  const { colors, type, typeScale } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: Boolean(selected) }}
      onPress={onPress}
      style={block ? styles.blockChip : null}>
      {({ pressed }) => (
        <StickerBox
          fill={selected ? colors.pink : colors.surface}
          radius={block ? 16 : 12}
          borderWidth={stroke.inner}
          pressed={pressed}
          shadow={false}>
          <View style={[styles.chip, block ? styles.chipBlock : null]}>
            <Text maxFontSizeMultiplier={typeScale.caption} style={[type.caption, { color: selected ? colors.onPink : colors.text }]}>{label}</Text>
          </View>
        </StickerBox>
      )}
    </Pressable>
  );
}

export function Toggle({
  label,
  value,
  onValueChange,
}: {
  label: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}) {
  const { colors, type, typeScale } = useTheme();
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value }}
      onPress={() => onValueChange(!value)}
      style={styles.toggle}>
      <Text maxFontSizeMultiplier={typeScale.body} style={[type.body, styles.ink, { color: colors.text, flex: 1 }]}>{label}</Text>
      <Switch
        pointerEvents="none"
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: colors.surfaceAlt, true: colors.pink }}
        thumbColor={value ? colors.onPink : colors.surface}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: space.md, flexGrow: 1, width: '100%', maxWidth: layout.maxContent, alignSelf: 'center' },
  column: { gap: space.sm },
  centered: { justifyContent: 'center' },
  footer: { paddingHorizontal: space.md, paddingTop: space.xs },
  stack: { gap: space.sm },
  cluster: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs, alignItems: 'center' },
  split: { flexDirection: 'row', gap: space.xs },
  splitItem: { flex: 1 },
  ink: { flexShrink: 1 },
  stickerWrap: { marginRight: shadowOffset, marginBottom: shadowOffset },
  stickerShadow: { position: 'absolute', left: shadowOffset, top: shadowOffset, right: -shadowOffset, bottom: -shadowOffset },
  pad: { padding: space.md, gap: space.xs },
  buttonInner: { minHeight: touch.minTarget, paddingHorizontal: space.md, alignItems: 'center', justifyContent: 'center' },
  buttonRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  buttonFlex: { flexGrow: 1 },
  compact: { alignSelf: 'flex-start' },
  rowButton: { padding: space.md },
  field: { gap: space.xxs },
  input: {
    borderWidth: stroke.inner,
    minHeight: touch.minTarget,
    paddingHorizontal: space.sm,
    paddingVertical: space.xs,
  },
  notice: { position: 'absolute', left: space.md, right: space.md },
  offline: { position: 'absolute', left: space.md, right: space.md },
  empty: { gap: space.sm, alignItems: 'center' },
  art: { alignItems: 'center', justifyContent: 'center' },
  progress: { flexDirection: 'row', gap: space.xxs },
  progressDot: { flex: 1, height: 8, borderRadius: 4, borderWidth: stroke.inner },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: stroke.inner,
    alignItems: 'center',
    justifyContent: 'center',
  },
  track: { height: 14, borderWidth: stroke.inner, overflow: 'hidden', justifyContent: 'center' },
  bar: { height: 10, marginHorizontal: 1 },
  chip: { borderWidth: stroke.inner, borderRadius: 12, minHeight: 32, paddingHorizontal: space.xs, paddingVertical: space.xxs, justifyContent: 'center' },
  chipBlock: { minHeight: touch.minTarget, alignItems: 'flex-start' },
  blockChip: { alignSelf: 'stretch' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.xs },
  hero: { flexDirection: 'row', alignItems: 'center', padding: space.md, gap: space.xs },
  heroCopy: { flex: 1, gap: space.xxs },
  statRow: { flexDirection: 'row', alignItems: 'stretch', gap: space.xxs },
  statFlex: { flex: 1 },
  stat: { padding: space.sm, gap: space.xxs, minHeight: 96 },
  person: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  personCopy: { flex: 1, gap: space.xxs },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.xs },
  headerCopy: { flexDirection: 'row', alignItems: 'center', gap: space.xs, flex: 1 },
  tabs: { flexDirection: 'row', paddingVertical: space.xs, paddingHorizontal: space.xxs },
  tab: { flex: 1, minHeight: touch.minTarget, alignItems: 'center', justifyContent: 'center', gap: 2 },
  tabIcon: { minWidth: 44, minHeight: 28, alignItems: 'center', justifyContent: 'center' },
  iconButton: { minWidth: touch.minTarget, minHeight: touch.minTarget, alignItems: 'center', justifyContent: 'center' },
  hue: { width: 16, height: 16, borderRadius: 8, borderWidth: stroke.inner },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: touch.minTarget },
  box: { width: 28, height: 28, borderWidth: stroke.inner, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  segment: { flexDirection: 'row', borderWidth: stroke.inner, borderRadius: 999, padding: space.xxs, gap: space.xxs },
  segmentItem: { flex: 1, minHeight: touch.minTarget, borderRadius: 999, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.xxs },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: touch.minTarget },
  scrim: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, justifyContent: 'center', padding: space.lg },
  scrimFill: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, opacity: 0.45 },
  dialog: { width: '100%', maxWidth: layout.maxContent, alignSelf: 'center' },
});
