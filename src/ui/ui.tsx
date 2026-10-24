import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
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
import { openTab, type RootStack } from '../app/navigation';
import { getEnv } from '../config/env';
import { t } from '../i18n';
import { hideNativeSplash } from '../platform/splash';
import { useGifteez } from '../state/GifteezContext';
import { useTheme } from '../theme/useTheme';
import { chrome, iconOnSurface, layout, occasionLook, scrim, space, sticker, stroke, touch, type ArtName, type CelebrateName, type ChipTint, type EmptyArtName } from '../theme/tokens';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { artSource, bowSource } from './art';
import { MonogramAvatar } from './stationery';
import { Icon, type IconName } from './icons';
import { CelebrateArt, Settle, useReduceMotion, useStickerMotion } from './motion';

const splashLight = require('../assets/splash/splash-mark.png');
const splashDark = require('../assets/splash/splash-mark-dark.png');
const LAUNCH_MARK = 240;
const LAUNCH_COPY_DELAY = 480;

/** A stack header already includes the status bar, so a second top inset doubles the gap. */
export function screenTopInset(headerHeight: number | undefined, topInset: number): number {
  return headerHeight ? 0 : topInset;
}

function StickerBox({
  children,
  fill,
  radius,
  borderWidth,
  borderColor,
  pressed,
  dashed,
  shadow = true,
  style,
}: {
  children: React.ReactNode;
  fill: string;
  radius: number;
  borderWidth: number;
  borderColor?: string;
  pressed?: boolean;
  dashed?: boolean;
  shadow?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const { face } = useStickerMotion(Boolean(pressed), shadow);
  const soft = shadow
    ? {
        shadowColor: colors.shadow,
        shadowOpacity: 0.06,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
        elevation: 2,
      }
    : null;
  return (
    <View style={style}>
      <Animated.View
        style={[
          face,
          soft,
          {
            backgroundColor: fill,
            borderColor: borderColor ?? colors.border,
            borderWidth,
            borderStyle: dashed ? 'dashed' : 'solid',
            borderRadius: radius,
            overflow: 'visible',
          },
        ]}>
        {children}
      </Animated.View>
    </View>
  );
}

export type TabId = 'home' | 'people' | 'fairness' | 'settings';

export function Screen({
  children,
  footer,
  centered,
  tab,
  pinned,
  tight,
}: {
  children: React.ReactNode;
  footer?: React.ReactNode;
  centered?: boolean;
  tab?: TabId;
  pinned?: React.ReactNode;
  tight?: boolean;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const headerHeight = useContext(HeaderHeightContext);
  const [footerHeight, setFooterHeight] = useState(0);
  const bar = tab ? <TabBar active={tab} /> : footer;
  const coverStatus = Boolean(tab) || !headerHeight;
  const topPad = (coverStatus ? insets.top : 0) + (tight ? 0 : space.sm);
  return (
    <KeyboardAvoidingView
      style={[styles.screen, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={headerHeight ?? 0}>
      {pinned ? (
        <View
          accessibilityRole="header"
          collapsable={false}
          style={[styles.pinned, { paddingTop: topPad, zIndex: 20, elevation: 20, backgroundColor: colors.background }]}>
          {pinned}
        </View>
      ) : null}
      <ScrollView
        style={[styles.screen, { overflow: 'visible' }]}
        contentContainerStyle={[
          styles.content,
          centered ? styles.centered : null,
          {
            paddingTop: pinned ? (tight ? 0 : space.sm) : topPad,
            paddingBottom: bar ? footerHeight : insets.bottom + space.lg,
          },
        ]}
        keyboardShouldPersistTaps="handled">
        <View style={styles.column}>{children}</View>
      </ScrollView>
      {coverStatus ? (
        <View pointerEvents="none" style={[styles.statusBar, styles.statusBarFront, { height: insets.top, backgroundColor: colors.background }]} />
      ) : null}
      {bar ? (
        <View
          onLayout={event => setFooterHeight(event.nativeEvent.layout.height)}
          style={[styles.dock, { backgroundColor: colors.background, paddingBottom: insets.bottom + space.xs }]}>
          <View style={styles.footer}>{bar}</View>
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

export function Title({ children, accessibilityLabel, align }: { children: string; accessibilityLabel?: string; align?: 'center' }) {
  const { colors, type, typeScale } = useTheme();
  return (
    <Text
      accessibilityRole="header"
      accessibilityLabel={accessibilityLabel ?? children}
      maxFontSizeMultiplier={typeScale.title}
      style={[type.title, styles.ink, align === 'center' ? styles.centerText : null, { color: colors.text }]}>
      {children}
    </Text>
  );
}

export function Heading({ children, color }: { children: string; color?: string }) {
  const { colors, type, typeScale } = useTheme();
  return (
    <Text accessibilityRole="header" maxFontSizeMultiplier={typeScale.heading} style={[type.heading, styles.ink, { color: color ?? colors.text }]}>
      {children}
    </Text>
  );
}

export function Body({ children, strong, accessibilityLabel, align }: { children: string; strong?: boolean; accessibilityLabel?: string; align?: 'center' }) {
  const { colors, type, typeScale } = useTheme();
  return (
    <Text accessibilityLabel={accessibilityLabel} maxFontSizeMultiplier={typeScale.body} style={[strong ? type.heading : type.body, styles.ink, align === 'center' ? styles.centerText : null, { color: colors.text }]}>
      {children}
    </Text>
  );
}

export function Caption({ children, tone = 'muted', color }: { children: string; tone?: 'muted' | 'danger' | 'text'; color?: string }) {
  const { colors, type, typeScale } = useTheme();
  const toneColor = tone === 'danger' ? colors.dangerText : tone === 'text' ? colors.text : colors.muted;
  const ink = color ?? toneColor;
  return (
    <Text maxFontSizeMultiplier={typeScale.caption} style={[type.caption, styles.ink, { color: ink }]}>
      {children}
    </Text>
  );
}

export function Display({ children, color, lines }: { children: string; color?: string; lines?: number }) {
  const { colors, type, typeScale } = useTheme();
  return (
    <Text
      accessibilityRole="header"
      numberOfLines={lines}
      adjustsFontSizeToFit={lines === 1}
      minimumFontScale={0.6}
      maxFontSizeMultiplier={typeScale.display}
      style={[type.display, styles.ink, { color: color ?? colors.text }]}>
      {children}
    </Text>
  );
}

type ConfirmRequest = {
  title: string;
  message: string;
  confirmLabel: string;
  confirmAccessibilityLabel?: string;
  /** Replaces Cancel. The primary button stays the first choice. */
  secondaryLabel?: string;
  tone?: 'primary' | 'danger';
  resolve: (value: boolean | 'secondary') => void;
  settled?: boolean;
};

let confirmListener: ((request: ConfirmRequest | null) => void) | null = null;
const sheetConfirmHosts: Array<(request: ConfirmRequest | null) => void> = [];
let openConfirms = 0;
const confirmWatchers = new Set<() => void>();

function noteConfirm(open: boolean) {
  openConfirms += open ? 1 : -1;
  if (openConfirms < 0) {
    openConfirms = 0;
  }
  confirmWatchers.forEach(listener => listener());
}

function settleConfirm(request: ConfirmRequest, value: boolean | 'secondary') {
  if (request.settled) {
    return;
  }
  request.settled = true;
  noteConfirm(false);
  request.resolve(value);
}

export function confirmDestructive(
  title: string,
  message: string,
  confirmLabel: string,
  confirmAccessibilityLabel?: string,
): Promise<boolean> {
  return new Promise(resolve => {
    noteConfirm(true);
    const request: ConfirmRequest = {
      title,
      message,
      confirmLabel,
      confirmAccessibilityLabel,
      tone: 'danger',
      resolve: value => resolve(value === true),
    };
    const sheetHost = sheetConfirmHosts[sheetConfirmHosts.length - 1];
    if (sheetHost) {
      sheetHost(request);
      return;
    }
    if (!confirmListener) {
      Alert.alert(title, message, [
        { text: t('common.cancel'), style: 'cancel', onPress: () => settleConfirm(request, false) },
        { text: confirmLabel, style: 'destructive', onPress: () => settleConfirm(request, true) },
      ], { cancelable: true, onDismiss: () => settleConfirm(request, false) });
      return;
    }
    confirmListener(request);
  });
}

/** Two actions. Dismissing chooses neither. */
export function confirmChoice(
  title: string,
  message: string,
  primaryLabel: string,
  secondaryLabel: string,
): Promise<'primary' | 'secondary' | 'dismiss'> {
  return new Promise(resolve => {
    noteConfirm(true);
    const request: ConfirmRequest = {
      title,
      message,
      confirmLabel: primaryLabel,
      secondaryLabel,
      tone: 'primary',
      resolve: value => {
        if (value === 'secondary') {
          resolve('secondary');
          return;
        }
        resolve(value ? 'primary' : 'dismiss');
      },
    };
    const sheetHost = sheetConfirmHosts[sheetConfirmHosts.length - 1];
    if (sheetHost) {
      sheetHost(request);
      return;
    }
    if (!confirmListener) {
      Alert.alert(title, message, [
        { text: secondaryLabel, onPress: () => settleConfirm(request, 'secondary') },
        { text: primaryLabel, onPress: () => settleConfirm(request, true) },
      ], { cancelable: true, onDismiss: () => settleConfirm(request, false) });
      return;
    }
    confirmListener(request);
  });
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  confirmAccessibilityLabel,
  secondaryLabel,
  tone = 'danger',
  onConfirm,
  onSecondary,
  onCancel,
  nested,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  confirmAccessibilityLabel?: string;
  secondaryLabel?: string;
  tone?: 'primary' | 'danger';
  onConfirm: () => void;
  onSecondary?: () => void;
  onCancel: () => void;
  /** Inside an open sheet. A second Modal on iOS stays invisible and swallows every touch. */
  nested?: boolean;
}) {
  const body = (
    <View style={styles.modalFill} accessibilityViewIsModal>
      <View style={[styles.scrimFill, { backgroundColor: scrim }]} />
      <View style={styles.dialog}>
        <Card>
          <Heading>{title}</Heading>
          {message ? <Body>{message}</Body> : null}
          <Button label={confirmLabel} accessibilityLabel={confirmAccessibilityLabel} tone={tone} onPress={onConfirm} />
          <Button
            label={secondaryLabel ?? t('common.cancel')}
            tone="secondary"
            onPress={secondaryLabel ? (onSecondary ?? onCancel) : onCancel}
          />
        </Card>
      </View>
    </View>
  );
  if (nested) {
    return body;
  }
  return (
    <Modal transparent visible animationType="fade" onRequestClose={onCancel} statusBarTranslucent>
      {body}
    </Modal>
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
  const finish = (value: boolean | 'secondary') => {
    settleConfirm(request, value);
    setRequest(null);
  };
  return (
    <ConfirmDialog
      title={request.title}
      message={request.message}
      confirmLabel={request.confirmLabel}
      confirmAccessibilityLabel={request.confirmAccessibilityLabel}
      secondaryLabel={request.secondaryLabel}
      tone={request.tone ?? 'danger'}
      onConfirm={() => finish(true)}
      onSecondary={() => finish('secondary')}
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
  serif,
  icon,
  accessibilityLabel,
  hint,
}: {
  label: string;
  onPress: () => void | Promise<unknown>;
  tone?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'danger-quiet' | 'hero' | 'soft';
  disabled?: boolean;
  busy?: boolean;
  flex?: boolean;
  compact?: boolean;
  /** Serif label, used for the home hero action. */
  serif?: boolean;
  icon?: IconName;
  accessibilityLabel?: string;
  hint?: string;
}) {
  const { colors, scheme, type, typeScale, radius } = useTheme();
  const [pending, setPending] = useState(false);
  const working = pending || Boolean(busy);
  const blocked = Boolean(disabled) || working;
  const quiet = Boolean(disabled) && !working;
  const danger = tone === 'danger' || tone === 'danger-quiet';
  const ghost = tone === 'ghost';
  const hero = tone === 'hero';
  const soft = tone === 'soft';
  const primary = tone === 'primary' || hero || soft;
  const softFill = scheme === 'dark' ? chrome.softFillDark : chrome.softFill;
  const softInk = scheme === 'dark' ? chrome.softInkDark : chrome.softInk;
  const fill = quiet ? colors.surfaceAlt : soft ? softFill : primary ? colors.button : colors.surface;
  const text = quiet ? colors.muted : soft ? softInk : primary ? colors.onButton : danger ? colors.dangerText : colors.text;
  return (
    <View style={flex ? styles.buttonFlex : compact ? styles.compact : null}>
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={quiet ? hint : undefined}
      accessibilityState={{ disabled: blocked, busy: working }}
      disabled={blocked}
      onPress={() => {
        const result = onPress();
        if (!result || typeof (result as Promise<unknown>).then !== 'function') {
          return;
        }
        let settled = false;
        const showPending = () => {
          if (!settled && openConfirms === 0) {
            setPending(true);
          }
        };
        const timer = setTimeout(showPending, 300);
        const watch = () => {
          if (openConfirms > 0) {
            setPending(false);
            return;
          }
          showPending();
        };
        confirmWatchers.add(watch);
        Promise.resolve(result).finally(() => {
          settled = true;
          clearTimeout(timer);
          confirmWatchers.delete(watch);
          setPending(false);
        });
      }}
      style={flex ? styles.buttonFlex : null}>
      {({ pressed }) => (
        <StickerBox
          fill={ghost ? 'transparent' : fill}
          radius={radius.button}
          borderWidth={ghost ? 0 : stroke.control}
          borderColor={quiet ? colors.outline : soft ? softFill : primary ? colors.button : colors.outline}
          pressed={pressed && !blocked}
          dashed={quiet && !ghost}
          shadow={!ghost && !quiet && !soft}>
          <View style={styles.buttonInner}>
            <View style={styles.buttonRow}>
              {working ? <ActivityIndicator color={text} size="small" /> : icon ? <Icon name={icon} color={text} size={18} /> : null}
              <Text
                maxFontSizeMultiplier={typeScale.button}
                style={[
                  type.button,
                  serif ? { fontFamily: type.display.fontFamily, fontWeight: '400' } : null,
                  { color: text, textAlign: 'center' },
                ]}>
                {label}
              </Text>
            </View>
          </View>
        </StickerBox>
      )}
    </Pressable>
    {quiet && hint ? <Caption>{hint}</Caption> : null}
    </View>
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
  autoCorrect,
  autoCapitalize,
  onSubmitEditing,
  onBlur,
  prefix,
  suffix,
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
  autoCorrect?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  onSubmitEditing?: () => void;
  onBlur?: () => void;
  /** Shown inside the field, before the value. */
  prefix?: string;
  /** Shown on the same line, after the value. */
  suffix?: string;
}) {
  const { colors, type, typeScale, radius } = useTheme();
  const bad = Boolean(error) || Boolean(invalid);
  const adorned = Boolean(prefix || suffix);
  const box = {
    color: colors.text,
    borderColor: bad ? colors.dangerText : colors.outline,
    backgroundColor: colors.surface,
    borderRadius: radius.card,
  };
  const inputProps = {
    accessibilityLabel: error ? `${accessibilityLabel ?? label}. ${error}` : (accessibilityLabel ?? label),
    accessibilityHint: error,
    value,
    onChangeText,
    placeholder,
    placeholderTextColor: colors.muted,
    keyboardType,
    autoCapitalize: autoCapitalize ?? (textContentType === 'name' ? 'words' : keyboardType === 'email-address' ? 'none' : 'sentences'),
    autoCorrect: autoCorrect ?? (textContentType === 'name' || keyboardType === 'email-address' ? false : undefined),
    spellCheck: autoCorrect === false ? false : undefined,
    returnKeyType,
    textContentType,
    autoComplete,
    onSubmitEditing,
    onBlur,
    maxFontSizeMultiplier: typeScale.body,
  };
  return (
    <View style={styles.field}>
      <Caption>{label}</Caption>
      {adorned ? (
        <View style={[styles.input, styles.inputRow, box]}>
          {prefix ? <Text accessibilityElementsHidden style={[type.body, { color: colors.muted }]}>{prefix}</Text> : null}
          <TextInput {...inputProps} style={[type.body, styles.inputFill, { color: colors.text }]} />
          {suffix ? <Text accessibilityElementsHidden style={[type.caption, { color: colors.muted }]}>{suffix}</Text> : null}
        </View>
      ) : (
        <TextInput {...inputProps} style={[type.body, styles.input, box]} />
      )}
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
  art,
  action,
  onAction,
}: {
  text: string;
  onClose: () => void;
  tone?: 'success' | 'danger';
  art?: CelebrateName;
  action?: string;
  onAction?: () => void;
}) {
  const { colors, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const closeRef = React.useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const timer = setTimeout(() => closeRef.current(), action ? 6000 : 2500);
    return () => clearTimeout(timer);
  }, [action, text]);
  return (
    <View
      pointerEvents="box-none"
      accessibilityRole={tone === 'danger' ? 'alert' : undefined}
      accessibilityLiveRegion={tone === 'danger' ? 'assertive' : 'polite'}
      style={[styles.floater, { bottom: insets.bottom + layout.tabBar + space.sm }]}>
      <View style={styles.floaterCard}>
      <Settle distance={20}>
      <StickerBox fill={colors.surface} radius={radius.card} borderWidth={stroke.card}>
        <View style={styles.pad}>
          <View style={styles.artRow}>
            {art ? (
              <CelebrateArt
                name={art}
                kind={art === 'purchase' ? 'wrap' : art === 'claim' ? 'claim' : 'still'}
                size={72}
              />
            ) : null}
            <View style={styles.personCopy}>
              <Caption tone={tone === 'danger' ? 'danger' : 'text'}>{text}</Caption>
              <Cluster>
                {action && onAction ? <Button compact label={action} tone="secondary" onPress={onAction} /> : null}
                <Button compact label={t('common.dismiss')} tone="ghost" onPress={onClose} />
              </Cluster>
            </View>
          </View>
        </View>
      </StickerBox>
      </Settle>
      </View>
    </View>
  );
}

export function OfflineBanner({ text }: { text: string }) {
  const { colors, radius } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View accessibilityLiveRegion="polite" pointerEvents="none" style={[styles.floater, { top: insets.top + space.xs }]}>
      <View style={styles.floaterCard}>
      <Settle distance={12}>
      <StickerBox fill={colors.surface} radius={radius.card} borderWidth={stroke.inner}>
        <View style={styles.pad}>
          <View style={styles.artRow}>
            <ArtSlot name="offline" size={64} />
            <View style={styles.personCopy}>
              <Caption tone="text">{text}</Caption>
            </View>
          </View>
        </View>
      </StickerBox>
      </Settle>
      </View>
    </View>
  );
}

export function Card({
  children,
  variant = 'default',
  compact,
  style,
}: {
  children: React.ReactNode;
  variant?: 'default' | 'accent' | 'dashed';
  compact?: boolean;
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
      <View style={[styles.pad, compact ? styles.padCompact : null]}>{children}</View>
    </StickerBox>
  );
}

export function ArtSlot({
  name,
  size = 88,
}: {
  name: ArtName | EmptyArtName | CelebrateName;
  size?: number;
}) {
  const { scheme } = useTheme();
  return (
    <Image
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      accessibilityIgnoresInvertColors
      source={artSource(name, scheme)}
      resizeMode="contain"
      style={{ width: size, height: size }}
    />
  );
}

export function ArtRow({
  art,
  size = 88,
  children,
}: {
  art: ArtName;
  size?: number;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.artRow}>
      <ArtSlot name={art} size={size} />
      <View style={styles.personCopy}>{children}</View>
    </View>
  );
}

export function EmptyState({
  kind,
  text,
  action,
  onAction,
  secondaryAction,
  onSecondaryAction,
}: {
  kind: EmptyArtName;
  text: string;
  action?: string;
  onAction?: () => void;
  secondaryAction?: string;
  onSecondaryAction?: () => void;
}) {
  return (
    <Card variant="dashed">
      <View style={styles.empty}>
        <ArtSlot name={kind} size={160} />
        <Body>{text}</Body>
        {action && onAction ? <Button label={action} onPress={onAction} /> : null}
        {secondaryAction && onSecondaryAction ? <Button label={secondaryAction} tone="secondary" onPress={onSecondaryAction} /> : null}
      </View>
    </Card>
  );
}

function LaunchCopy() {
  const reduce = useReduceMotion();
  const opacity = useSharedValue(reduce ? 1 : 0);
  useEffect(() => {
    opacity.value = reduce ? 1 : withTiming(1, { duration: 320 });
  }, [opacity, reduce]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <Animated.View pointerEvents="none" style={[styles.launchCopy, style]}>
      <Title>{t('appName')}</Title>
      <Body>{t('common.loading')}</Body>
    </Animated.View>
  );
}

/** First frame is only the splash mark. The words fade in after a delay, with no bob. */
export function BrandedLoading() {
  const scheme = useColorScheme();
  const [showCopy, setShowCopy] = useState(false);
  const splashHidden = useRef(false);
  useEffect(() => {
    const timer = setTimeout(() => setShowCopy(true), LAUNCH_COPY_DELAY);
    return () => clearTimeout(timer);
  }, []);
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={t('common.loading')}
      onLayout={() => {
        if (splashHidden.current) {
          return;
        }
        splashHidden.current = true;
        requestAnimationFrame(() => {
          hideNativeSplash();
        });
      }}
      style={styles.launch}>
      <View pointerEvents="none" style={styles.launchLogo}>
        <Image
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          accessibilityIgnoresInvertColors
          source={scheme === 'dark' ? splashDark : splashLight}
          resizeMode="contain"
          style={styles.launchMark}
        />
      </View>
      {showCopy ? <LaunchCopy /> : null}
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
  return (
    <View style={[styles.avatar, { backgroundColor: fill, borderColor: colors.outline }]}>
      <Text maxFontSizeMultiplier={typeScale.heading} style={[type.heading, { color: sticker.light.ink }]}>{initials.slice(0, 1).toUpperCase()}</Text>
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
      style={[styles.track, { borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.surfaceAlt, borderRadius: radius.pill }]}>
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
  const { colors, scheme, type, typeScale } = useTheme();
  const look = occasionLook(occasionId);
  const fill = colors[look.chip];
  const ink = colors[`on${look.chip[0].toUpperCase()}${look.chip.slice(1)}` as 'onPink'];
  const words = trailing ? `${label} ${trailing}` : label;
  return (
    <View style={[styles.chip, styles.occasionChip, { backgroundColor: fill, borderColor: colors.outline, alignSelf: 'flex-start' }]}>
      <Image
        accessibilityElementsHidden
        source={artSource(look.art, scheme)}
        resizeMode="contain"
        style={styles.occasionEmblem}
      />
      <Text accessibilityLabel={words} maxFontSizeMultiplier={typeScale.caption} style={[type.caption, { color: ink }]}>{words}</Text>
    </View>
  );
}

export function SectionHeader({
  title,
  action,
  onAction,
  display,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
  display?: boolean;
}) {
  return (
    <View style={styles.sectionHeader}>
      {display ? <Display>{title}</Display> : <Heading>{title}</Heading>}
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
  initials,
  hue,
  progress,
}: {
  kicker: string;
  title: string;
  figure: string;
  unit?: string;
  detail: string;
  action: string | null;
  onAction: () => void;
  art: ArtName;
  initials?: string;
  hue?: string;
  progress?: number | null;
}) {
  const { colors, radius } = useTheme();
  const ink = sticker.light.ink;
  return (
    <StickerBox fill={colors.sunshine} radius={radius.card} borderWidth={stroke.card} style={styles.heroCard}>
      <View style={styles.hero}>
        <View style={styles.heroCopy}>
          <Caption color={ink}>{kicker}</Caption>
          <View style={styles.heroName}>
            {initials ? <Avatar initials={initials} hue={hue} /> : null}
            <Heading color={ink}>{title}</Heading>
          </View>
          <Display color={ink}>{figure}</Display>
          {unit ? <Caption color={ink}>{unit}</Caption> : null}
          <Caption color={ink}>{detail}</Caption>
          <ProgressBar value={progress ?? null} />
          {action ? <Button icon="gift" label={action} tone="hero" onPress={onAction} /> : null}
        </View>
        <View pointerEvents="none" style={styles.heroArt}>
          <ArtSlot name={art} size={150} />
        </View>
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
  const { colors, scheme, type, typeScale, radius } = useTheme();
  const iconColor = tint === 'teal' || tint === 'lilac' ? iconOnSurface[scheme][tint] : colors[tint];
  const face = (pressed: boolean) => (
    <StickerBox fill={colors.surface} radius={radius.card} borderWidth={stroke.card} pressed={pressed}>
      <View style={styles.stat}>
        <Icon name={icon} color={iconColor} />
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.6}
          maxFontSizeMultiplier={typeScale.heading}
          style={[type.heading, styles.statValue, { color: colors.text }]}>
          {value}
        </Text>
        <Caption>{label}</Caption>
      </View>
    </StickerBox>
  );
  if (!onPress) {
    return <View style={styles.statFlex}>{face(false)}</View>;
  }
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${value} ${label}`} onPress={onPress} style={styles.statFlex}>
      {({ pressed }) => face(pressed)}
    </Pressable>
  );
}

export function StatRow({ children }: { children: React.ReactNode }) {
  return <View style={styles.statRow}>{children}</View>;
}

export function PersonRow({
  name,
  personId,
  relationship,
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
  personId: string;
  relationship?: string;
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
        <MonogramAvatar name={name} personId={personId} />
        <View style={styles.personCopy}>
          <Heading>{name}</Heading>
          {relationship ? <Caption tone="text">{relationship}</Caption> : null}
          {budget ? <Caption tone="text">{budget}</Caption> : null}
          {occasionId && occasionLabel ? (
            <OccasionChip occasionId={occasionId} label={occasionLabel} trailing={trailing} />
          ) : (
            <Caption>{note || ''}</Caption>
          )}
          {progress != null ? <ProgressBar value={progress} /> : null}
        </View>
        <Icon name="chevron" color={colors.muted} />
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
        <View style={styles.personCopy}>
          {greeting ? <Caption>{greeting}</Caption> : null}
          <Display lines={1}>{title}</Display>
        </View>
      </View>
      <IconButton label={t('people.remindersA11y')} name="bell" onPress={() => setOpen(true)} />
      <Sheet visible={open} title={t('people.remindersA11y')} onClose={() => setOpen(false)}>
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

const TABS: Array<{ id: TabId; icon: IconName; label: string; route: 'Home' | 'People' | 'Fairness' | 'Settings' }> = [
  { id: 'home', icon: 'home', label: t('people.home'), route: 'Home' },
  { id: 'people', icon: 'people', label: t('people.title'), route: 'People' },
  { id: 'fairness', icon: 'scale', label: t('people.fairness'), route: 'Fairness' },
  { id: 'settings', icon: 'gear', label: t('people.settings'), route: 'Settings' },
];

export function TabBar({ active }: { active: TabId }) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStack>>();
  const { colors, scheme, type, typeScale } = useTheme();
  return (
    <View accessibilityRole="tablist" style={[styles.tabs, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
      {TABS.map(tab => {
        const selected = tab.id === active;
        const ink = selected ? colors.pink : colors.muted;
        return (
          <Pressable
            key={tab.id}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={tab.label}
            onPress={() => {
              const state = navigation.getState?.();
              const current = state?.routes[state.index]?.name;
              if (current !== tab.route) {
                openTab(navigation, tab.route);
              }
            }}
            style={styles.tab}>
            <View style={styles.tabInner}>
              {selected ? (
                <Image accessible={false} source={bowSource(scheme)} resizeMode="contain" style={styles.tabBow} />
              ) : (
                <View accessibilityElementsHidden importantForAccessibility="no" style={styles.tabBow} />
              )}
              <Icon name={tab.icon} color={ink} size={20} />
              <Text maxFontSizeMultiplier={typeScale.caption} style={[type.caption, { color: ink }]}>{tab.label}</Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

export function IconButton({
  label,
  name,
  onPress,
  color,
  filled,
  size = 22,
  word,
}: {
  label: string;
  name: IconName;
  onPress: () => void;
  color?: string;
  filled?: boolean;
  size?: number;
  /** Visible word when the icon alone would not say what the control does. */
  word?: string;
}) {
  const { colors, type, typeScale } = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={styles.iconButton}>
      {word ? (
        <Text maxFontSizeMultiplier={typeScale.button} style={[type.button, { color: color || colors.pink }]}>{word}</Text>
      ) : (
        <Icon name={name} color={color || colors.text} filled={filled} size={size} />
      )}
    </Pressable>
  );
}

export function GhostRow({ label, onPress }: { label: string; onPress: () => void }) {
  const { colors, type, typeScale, radius } = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress}>
      {({ pressed }) => (
        <StickerBox fill="transparent" radius={radius.card} borderWidth={stroke.card} pressed={pressed} dashed shadow={false}>
          <View style={styles.buttonInner}>
            <Text maxFontSizeMultiplier={typeScale.button} style={[type.button, { color: colors.text }]}>{label}</Text>
          </View>
        </StickerBox>
      )}
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
  field,
  disabled = false,
}: {
  label: string;
  checked: boolean;
  onPress: () => void;
  /** Renders in the row, outside the checkbox, so a text field can be edited. */
  field?: React.ReactNode;
  disabled?: boolean;
}) {
  const { colors, type, typeScale } = useTheme();
  const showChecked = disabled ? false : checked;
  const state = { checked: showChecked, ...(disabled ? { disabled: true } : {}) };
  const box = (
    <View style={[styles.box, { borderColor: disabled ? colors.muted : colors.outline, backgroundColor: showChecked ? colors.button : colors.surface }]}>
      {showChecked ? <Icon name="check" color={colors.onButton} size={16} /> : null}
    </View>
  );
  if (field) {
    return (
      <View style={styles.checkRow}>
        <Pressable
          accessibilityRole="checkbox"
          accessibilityLabel={label}
          accessibilityState={state}
          disabled={disabled}
          onPress={onPress}
          hitSlop={8}
          style={styles.boxHit}>
          {box}
        </Pressable>
        <View style={styles.checkField}>{field}</View>
      </View>
    );
  }
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={state}
      disabled={disabled}
      onPress={onPress}
      style={styles.checkRow}>
      {box}
      <Text maxFontSizeMultiplier={typeScale.body} style={[type.body, styles.ink, { color: disabled ? colors.muted : colors.text }]}>{label}</Text>
    </Pressable>
  );
}

const SheetFooterContext = React.createContext<((node: React.ReactNode) => void) | null>(null);

/** Pins a control under a sheet's scroll, such as Add occasion. */
export function useSheetFooter(): ((node: React.ReactNode) => void) | null {
  return useContext(SheetFooterContext);
}

export function Sheet({
  visible,
  onClose,
  onDismiss,
  title,
  doneLabel,
  compact,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  onDismiss?: () => void;
  /** Left-aligned title. The close control sits on the same row. */
  title?: string;
  /** Replaces the close icon on forms. */
  doneLabel?: string;
  /** Bottom card sized to its content, for short forms such as reminders. */
  compact?: boolean;
  children: React.ReactNode;
}) {
  const { colors, type, typeScale } = useTheme();
  const insets = useSafeAreaInsets();
  const reduce = useReduceMotion();
  const dismissRef = useRef(onDismiss);
  dismissRef.current = onDismiss;
  const wasVisible = useRef(visible);
  useEffect(() => {
    if (wasVisible.current && !visible) {
      dismissRef.current?.();
    }
    wasVisible.current = visible;
  }, [visible]);
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null);
  useEffect(() => {
    if (!visible) {
      return undefined;
    }
    sheetConfirmHosts.push(setConfirm);
    return () => {
      const index = sheetConfirmHosts.lastIndexOf(setConfirm);
      if (index >= 0) {
        sheetConfirmHosts.splice(index, 1);
      }
      setConfirm(current => {
        if (current) {
          settleConfirm(current, false);
        }
        return null;
      });
    };
  }, [visible]);
  const finishConfirm = (value: boolean | 'secondary') => {
    if (!confirm) {
      return;
    }
    settleConfirm(confirm, value);
    setConfirm(null);
  };
  const [footer, setFooterState] = useState<React.ReactNode>(null);
  const setFooter = useCallback((node: React.ReactNode) => {
    setFooterState(node);
  }, []);
  useEffect(() => {
    if (!visible) {
      setFooterState(null);
    }
  }, [visible]);
  return (
    <Modal
      visible={visible}
      transparent={compact}
      animationType={reduce ? 'fade' : 'slide'}
      presentationStyle={compact ? 'overFullScreen' : 'pageSheet'}
      onRequestClose={onClose}>
      <View style={compact ? styles.compactRoot : [styles.screen, { backgroundColor: colors.background, paddingTop: Platform.OS === 'ios' ? space.xs : insets.top }]}>
        {compact ? (
          <Pressable accessibilityRole="button" accessibilityLabel={t('common.close')} onPress={onClose} style={styles.backdrop} />
        ) : null}
        <View style={compact ? [styles.compactCard, { backgroundColor: colors.background, paddingBottom: insets.bottom }] : styles.screen}>
        <SheetFooterContext.Provider value={setFooter}>
        <KeyboardAvoidingView style={compact ? undefined : styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View
          style={compact ? undefined : styles.screen}
          accessibilityElementsHidden={confirm != null}
          importantForAccessibility={confirm ? 'no-hide-descendants' : 'auto'}>
          <View style={styles.grabberWrap}>
            <View style={[styles.grabber, { backgroundColor: colors.border }]} />
          </View>
          <View style={styles.sheetHead}>
            <Text
              numberOfLines={1}
              maxFontSizeMultiplier={typeScale.heading}
              style={[type.heading, styles.sheetTitle, { color: colors.text }]}>
              {title ?? ''}
            </Text>
            {doneLabel ? (
              <Pressable accessibilityRole="button" accessibilityLabel={doneLabel} onPress={onClose} style={styles.sheetDone}>
                <Text maxFontSizeMultiplier={typeScale.button} style={[type.button, { color: colors.pink }]}>{doneLabel}</Text>
              </Pressable>
            ) : (
              <IconButton label={t('common.close')} name="close" onPress={onClose} />
            )}
          </View>
          <ScrollView contentContainerStyle={[styles.content, { flexGrow: compact ? 0 : 1, paddingBottom: footer ? space.md : compact ? space.md : insets.bottom + space.lg }]} keyboardShouldPersistTaps="handled">
            <Settle distance={10}>
              <View style={styles.column}>{children}</View>
            </Settle>
          </ScrollView>
          {footer ? (
            <View style={[styles.footer, { paddingBottom: insets.bottom + space.xs }]}>{footer}</View>
          ) : null}
        </View>
        </KeyboardAvoidingView>
        </SheetFooterContext.Provider>
        {confirm ? (
          <View style={styles.sheetConfirm}>
            <ConfirmDialog
              title={confirm.title}
              message={confirm.message}
              confirmLabel={confirm.confirmLabel}
              confirmAccessibilityLabel={confirm.confirmAccessibilityLabel}
              secondaryLabel={confirm.secondaryLabel}
              tone={confirm.tone ?? 'danger'}
              onConfirm={() => finishConfirm(true)}
              onSecondary={() => finishConfirm('secondary')}
              onCancel={() => finishConfirm(false)}
              nested
            />
          </View>
        ) : null}
        </View>
      </View>
    </Modal>
  );
}

export function priceLabel(displayPrice?: string | null): string {
  const price = displayPrice?.trim();
  if (price) {
    return t('settings.unlockPrice', { price });
  }
  return t('settings.unlockFallback');
}

export function UnlockSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { buy, restorePurchases, storeProduct, storeBusy, error } = useGifteez();
  return (
    <Sheet visible={visible} title={t('settings.keepEveryone')} onClose={onClose}>
      <Body>{t('settings.keepEveryoneBody', { count: getEnv().freeTierMaxPeople })}</Body>
      <Body>{priceLabel(storeProduct?.displayPrice)}</Body>
      {error ? <Caption tone="danger">{error}</Caption> : null}
      <Button label={t('settings.unlockAction')} busy={storeBusy} onPress={buy} />
      <Button label={t('settings.restore')} tone="secondary" onPress={restorePurchases} />
      <Button label={t('settings.notNow')} tone="ghost" onPress={onClose} />
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
  const { colors, scheme, type, typeScale } = useTheme();
  const track = scheme === 'dark' ? chrome.segmentTrackDark : chrome.segmentTrack;
  const pill = scheme === 'dark' ? chrome.segmentPillDark : chrome.segmentPill;
  const rose = scheme === 'dark' ? chrome.softInkDark : chrome.softInk;
  return (
    <View accessibilityRole="tablist" style={[styles.segment, { backgroundColor: track, borderColor: track }]}>
      {options.map(option => {
        const selected = option.id === value;
        return (
          <Pressable
            key={option.id}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={option.label}
            onPress={() => onChange(option.id)}
            style={[styles.segmentItem, { backgroundColor: selected ? pill : 'transparent' }]}>
            <Text maxFontSizeMultiplier={typeScale.button} style={[type.button, { color: selected ? rose : colors.text }]}>{option.label}</Text>
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
  const { colors, type, typeScale, radius } = useTheme();
  const ink = selected ? colors.onPink : colors.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: Boolean(selected) }}
      hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
      onPress={onPress}
      style={block ? styles.blockChip : styles.chipWrap}>
      {({ pressed }) => (
        <StickerBox
          fill={selected ? colors.pink : colors.surface}
          radius={block ? radius.card : radius.chip}
          borderWidth={stroke.inner}
          pressed={pressed}
          shadow={false}>
          <View style={[styles.chipPress, block ? styles.chipBlock : null]}>
            <Text maxFontSizeMultiplier={typeScale.caption} style={[type.caption, { color: ink }]}>{label}</Text>
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
  const { colors, scheme, type, typeScale } = useTheme();
  const off = scheme === 'dark' ? chrome.switchOffDark : chrome.switchOff;
  const thumb = scheme === 'dark' ? chrome.switchThumbDark : chrome.white;
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value }}
      onPress={() => onValueChange(!value)}
      style={styles.toggle}>
      <Text maxFontSizeMultiplier={typeScale.body} style={[type.body, styles.ink, { color: colors.text, flex: 1 }]}>{label}</Text>
      <View style={[styles.switchBorder, { borderColor: colors.outline }]}>
        <Switch
          pointerEvents="none"
          value={value}
          onValueChange={onValueChange}
          trackColor={{ false: off, true: colors.pink }}
          ios_backgroundColor={off}
          thumbColor={value ? colors.onPink : thumb}
        />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  compactRoot: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: scrim },
  compactCard: { maxHeight: '80%', borderTopLeftRadius: 16, borderTopRightRadius: 16, overflow: 'hidden' },
  statusBar: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 4 },
  statusBarFront: { zIndex: 30, elevation: 30 },
  centerText: { textAlign: 'center', alignSelf: 'stretch' },
  pinned: { paddingHorizontal: space.md, width: '100%', maxWidth: layout.maxContent, alignSelf: 'center', gap: space.sm },
  modalFill: { flex: 1, justifyContent: 'center', padding: space.lg },
  content: { paddingHorizontal: space.md, flexGrow: 1, width: '100%', maxWidth: layout.maxContent, alignSelf: 'center', overflow: 'visible' },
  column: { gap: space.sm, overflow: 'visible' },
  centered: { justifyContent: 'center' },
  footer: { paddingHorizontal: space.md, paddingTop: space.xs, width: '100%', maxWidth: layout.maxContent, alignSelf: 'center' },
  dock: { position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 10, elevation: 10 },
  stack: { gap: space.sm },
  cluster: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs, alignItems: 'center' },
  split: { flexDirection: 'row', gap: space.xs },
  splitItem: { flex: 1 },
  ink: { flexShrink: 1 },
  stickerWrap: {},
  pad: { padding: space.md, gap: space.xs },
  padCompact: { padding: space.sm, gap: space.xxs },
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
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  inputFill: { flex: 1, minHeight: touch.minTarget, paddingVertical: 0 },
  floater: { position: 'absolute', left: 0, right: 0, alignItems: 'center', paddingHorizontal: space.md },
  floaterCard: { width: '100%', maxWidth: layout.maxContent },
  empty: { gap: space.sm, alignItems: 'center' },
  launch: { flex: 1 },
  launchLogo: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  launchMark: { width: LAUNCH_MARK, height: LAUNCH_MARK },
  launchCopy: {
    position: 'absolute',
    left: space.md,
    right: space.md,
    bottom: '18%',
    alignItems: 'center',
    gap: space.xs,
  },
  progress: { flexDirection: 'row', gap: space.xxs },
  progressDot: { flex: 1, height: 8, borderRadius: 4, borderWidth: stroke.inner },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: stroke.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  track: { height: 14, borderWidth: stroke.inner, overflow: 'hidden', justifyContent: 'center' },
  bar: { height: 10, marginHorizontal: 1 },
  chip: { borderWidth: stroke.inner, borderRadius: 999, minHeight: 32, paddingHorizontal: space.xs, paddingVertical: space.xxs, justifyContent: 'center' },
  occasionChip: { flexDirection: 'row', alignItems: 'center', gap: space.xxs, flexShrink: 0 },
  occasionEmblem: { width: 22, height: 22 },
  chipWrap: { alignSelf: 'flex-start', flexShrink: 0 },
  chipPress: { minHeight: touch.minTarget, flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.sm },
  chipBlock: { minHeight: touch.minTarget, alignItems: 'center' },
  blockChip: { alignSelf: 'stretch' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.xs },
  heroCard: { overflow: 'visible' },
  hero: { flexDirection: 'row', alignItems: 'flex-start', padding: space.md, gap: space.xs, overflow: 'visible' },
  heroCopy: { flex: 1, gap: space.xxs },
  heroName: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  heroArt: { marginTop: -28, marginRight: -44, marginBottom: -24 },
  switchBorder: { borderWidth: stroke.inner, borderRadius: 16, overflow: 'hidden' },
  statRow: { flexDirection: 'row', alignItems: 'stretch', gap: space.xxs },
  statFlex: { flex: 1 },
  stat: { padding: space.sm, gap: space.xxs, minHeight: 96 },
  statValue: { width: '100%' },
  person: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  personCopy: { flex: 1, gap: space.xxs },
  artRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.xs },
  headerCopy: { flexDirection: 'row', alignItems: 'center', gap: space.xs, flex: 1 },
  tabs: { flexDirection: 'row', paddingVertical: space.xs, paddingHorizontal: space.xxs, borderTopWidth: 1 },
  tab: { flex: 1, minHeight: touch.minTarget },
  tabFlex: { flex: 1 },
  tabInner: { minHeight: 64, alignItems: 'center', justifyContent: 'flex-start', gap: space.xxs, paddingTop: space.xxs },
  tabBow: { width: 22, height: 16 },
  iconButton: { minWidth: touch.minTarget, minHeight: touch.minTarget, alignItems: 'center', justifyContent: 'center' },
  hue: { width: 16, height: 16, borderRadius: 8, borderWidth: stroke.inner },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: touch.minTarget },
  boxHit: { minWidth: touch.minTarget, minHeight: touch.minTarget, alignItems: 'center', justifyContent: 'center' },
  checkField: { flex: 1, gap: space.xxs },
  box: { width: 28, height: 28, borderWidth: stroke.inner, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  segment: { flexDirection: 'row', borderWidth: stroke.inner, borderRadius: 999, padding: space.xxs, gap: space.xxs },
  segmentItem: { flex: 1, minHeight: 44, borderRadius: 999, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.xxs },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: touch.minTarget },
  grabberWrap: { alignItems: 'center', paddingTop: space.xs },
  grabber: { width: 36, height: 4, borderRadius: 2 },
  sheetHead: { flexDirection: 'row', alignItems: 'center', paddingLeft: space.md, minHeight: 44 },
  sheetTitle: { flex: 1 },
  sheetDone: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.sm },
  sheetConfirm: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, zIndex: 8 },
  scrim: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, justifyContent: 'center', padding: space.lg },
  scrimFill: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, opacity: 0.45 },
  dialog: { width: '100%', maxWidth: layout.maxContent, alignSelf: 'center' },
});
