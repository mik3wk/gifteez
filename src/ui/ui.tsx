import React, { useContext, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { HeaderHeightContext } from '@react-navigation/elements';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getEnv } from '../config/env';
import { formatMoney, t } from '../i18n';
import { useGifteez } from '../state/GifteezContext';
import { EmptyArt } from './art';

/** A stack header already includes the status bar, so a second top inset doubles the gap. */
export function screenTopInset(headerHeight: number | undefined, topInset: number): number {
  return headerHeight ? 0 : topInset;
}

export function Screen({
  children,
  footer,
  centered,
}: {
  children: React.ReactNode;
  footer?: React.ReactNode;
  centered?: boolean;
}) {
  const { colors } = useGifteez();
  const insets = useSafeAreaInsets();
  const headerHeight = useContext(HeaderHeightContext);
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
          { paddingTop: screenTopInset(headerHeight, insets.top) + 12, paddingBottom: (footer ? 12 : insets.bottom + 24) },
        ]}
        keyboardShouldPersistTaps="handled">
        {children}
      </ScrollView>
      {footer ? (
        <View style={[styles.footer, { backgroundColor: colors.background, borderTopColor: colors.border, paddingBottom: insets.bottom + 12 }]}>
          {footer}
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}

export function Progress({ step, total }: { step: number; total: number }) {
  const { colors } = useGifteez();
  return (
    <View accessibilityLabel={t('firstOpen.progress', { step, total })} style={styles.progress}>
      {Array.from({ length: total }, (_, index) => (
        <View
          key={index}
          style={[styles.progressDot, { backgroundColor: index < step ? colors.accent : colors.border }]}
        />
      ))}
    </View>
  );
}

export function Title({ children, accessibilityLabel }: { children: string; accessibilityLabel?: string }) {
  const { colors } = useGifteez();
  return (
    <Text accessibilityRole="header" accessibilityLabel={accessibilityLabel ?? children} style={[styles.title, { color: colors.text }]}>
      {children}
    </Text>
  );
}

export function Heading({ children }: { children: string }) {
  const { colors } = useGifteez();
  return (
    <Text accessibilityRole="header" style={[styles.heading, { color: colors.text }]}>
      {children}
    </Text>
  );
}

export function Body({ children }: { children: string }) {
  const { colors } = useGifteez();
  return <Text style={[styles.body, { color: colors.muted }]}>{children}</Text>;
}

export function Button({
  label,
  onPress,
  tone = 'primary',
  disabled,
  busy,
  flex,
  accessibilityLabel,
}: {
  label: string;
  onPress: () => void | Promise<unknown>;
  tone?: 'primary' | 'secondary' | 'danger' | 'ghost';
  disabled?: boolean;
  busy?: boolean;
  flex?: boolean;
  accessibilityLabel?: string;
}) {
  const { colors } = useGifteez();
  const [pending, setPending] = useState(false);
  const working = pending || Boolean(busy);
  const blocked = Boolean(disabled) || working;
  const background = tone === 'primary' ? colors.accent : tone === 'danger' ? colors.danger : tone === 'ghost' ? 'transparent' : colors.surface;
  const text = tone === 'primary' || tone === 'danger' ? colors.accentText : colors.accent;
  const border = tone === 'ghost' ? 'transparent' : tone === 'secondary' ? colors.border : background;
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
        // A promise that settles immediately should not flash a spinner or a test-only update.
        const timer = setTimeout(() => setPending(true), 0);
        Promise.resolve(result).finally(() => {
          clearTimeout(timer);
          setPending(false);
        });
      }}
      style={({ pressed }) => [
        styles.button,
        flex ? styles.buttonFlex : null,
        {
          backgroundColor: background,
          borderColor: border,
          opacity: blocked ? 0.5 : pressed ? 0.72 : 1,
          transform: [{ scale: pressed && !blocked ? 0.98 : 1 }],
        },
      ]}>
      {working ? (
        <ActivityIndicator color={text} />
      ) : (
        <Text style={[styles.buttonText, { color: tone === 'secondary' ? colors.text : text }]}>{label}</Text>
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
  const { colors } = useGifteez();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [
        styles.rowButton,
        { backgroundColor: pressed ? colors.banner : colors.surface, borderColor: colors.border, opacity: pressed ? 0.9 : 1 },
      ]}>
      {children}
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
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'email-address' | 'phone-pad' | 'number-pad' | 'decimal-pad';
  accessibilityLabel?: string;
  error?: string;
}) {
  const { colors } = useGifteez();
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: colors.muted }]}>{label}</Text>
      <TextInput
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityHint={error}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        keyboardType={keyboardType}
        autoCapitalize={keyboardType === 'email-address' ? 'none' : 'sentences'}
        autoCorrect={keyboardType === 'email-address' ? false : undefined}
        style={[styles.input, { color: colors.text, borderColor: error ? colors.danger : colors.border, backgroundColor: colors.surface }]}
      />
      {error ? <Text accessibilityLiveRegion="polite" style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}
    </View>
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
  const { colors } = useGifteez();
  return (
    <View style={[styles.banner, { backgroundColor: colors.banner, borderColor: colors.border }]}>
      <Text style={[styles.bannerText, { color: colors.text }]}>{text}</Text>
      <View style={styles.row}>
        {action && onAction ? <Button label={action} onPress={onAction} /> : null}
        {onDismiss ? <Button label={t('people.dismiss')} onPress={onDismiss} tone="secondary" /> : null}
      </View>
    </View>
  );
}

export function Notice({ text, onClose, tone = 'success' }: { text: string; onClose: () => void; tone?: 'success' | 'danger' }) {
  const { colors } = useGifteez();
  const background = tone === 'danger' ? colors.danger : colors.success;
  return (
    <Pressable
      accessibilityRole="alert"
      accessibilityLabel={text}
      onPress={onClose}
      style={({ pressed }) => [styles.notice, { backgroundColor: background, opacity: pressed ? 0.85 : 1 }]}>
      <Text style={[styles.noticeText, { color: colors.accentText }]}>{text}</Text>
    </Pressable>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const { colors } = useGifteez();
  return <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }, style]}>{children}</View>;
}

export function EmptyState({
  kind,
  text,
  action,
  onAction,
}: {
  kind: 'people' | 'fairness';
  text: string;
  action: string;
  onAction: () => void;
}) {
  return (
    <View style={styles.empty}>
      <EmptyArt kind={kind} />
      <Body>{text}</Body>
      <Button label={action} onPress={onAction} />
    </View>
  );
}

function Sheet({
  visible,
  onClose,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const { colors } = useGifteez();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={[styles.screen, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]} keyboardShouldPersistTaps="handled">
          {children}
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
      <Button label={t('common.close')} tone="secondary" onPress={onClose} />
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
      {allowName ? <Field label={t('groupCreate.name')} value={name} onChangeText={setName} /> : null}
      {showCreate ? (
        <>
          <Field label={t('groupCreate.listName')} value={groupName} onChangeText={setGroupName} />
          <Body>{t('groupCreate.listNameHint')}</Body>
        </>
      ) : null}
      {showCreate && onCreate ? <Button label={t('groupCreate.create')} onPress={() => onCreate(name, groupName)} /> : null}
      <Title>{t('groupCreate.secureTitle')}</Title>
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
      />
      <Button
        label={t('groupCreate.sendLink')}
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
      <Button label={t('groupCreate.finishLink')} onPress={() => finishEmail(link)} disabled={!link.trim()} />
      <Button label={t('groupCreate.useSms')} onPress={() => setSms(true)} tone="secondary" />
      {sms ? (
        <>
          <Body>{t('groupCreate.smsRegion')}</Body>
          <Field label={t('groupCreate.phone')} value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
          <Button label={t('groupCreate.sendCode')} onPress={() => sendPhone(phone)} disabled={!phone.trim()} />
          <Field label={t('groupCreate.code')} value={code} onChangeText={setCode} keyboardType="number-pad" />
          <Button label={t('groupCreate.confirmCode')} onPress={() => confirmPhone(code)} disabled={!code.trim()} />
        </>
      ) : null}
      <Button label={showCreate ? t('groupCreate.skip') : t('common.close')} onPress={onClose} tone="ghost" />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: 20, gap: 12, flexGrow: 1 },
  centered: { justifyContent: 'center' },
  footer: { paddingHorizontal: 20, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth },
  title: { fontSize: 28, lineHeight: 34, fontWeight: '700', flexShrink: 1 },
  heading: { fontSize: 20, lineHeight: 26, fontWeight: '700', flexShrink: 1 },
  body: { fontSize: 16, lineHeight: 22, flexShrink: 1 },
  button: {
    minHeight: 48,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  buttonFlex: { flexGrow: 1 },
  buttonText: { fontSize: 17, fontWeight: '600', textAlign: 'center', flexShrink: 1 },
  rowButton: { minHeight: 48, borderWidth: 1, borderRadius: 14, padding: 14, gap: 4 },
  field: { gap: 6 },
  label: { fontSize: 14, fontWeight: '600' },
  input: { borderWidth: 1, borderRadius: 12, minHeight: 48, paddingHorizontal: 12, paddingVertical: 12, fontSize: 17 },
  error: { fontSize: 14, lineHeight: 18 },
  banner: { borderWidth: 1, borderRadius: 12, padding: 12, gap: 8 },
  bannerText: { fontSize: 15, lineHeight: 21, flexShrink: 1 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  notice: { position: 'absolute', left: 16, right: 16, bottom: 24, borderRadius: 12, padding: 14 },
  noticeText: { fontSize: 15, lineHeight: 20, textAlign: 'center', fontWeight: '600' },
  card: { borderWidth: 1, borderRadius: 14, padding: 14, gap: 8 },
  empty: { gap: 12, alignItems: 'stretch' },
  progress: { flexDirection: 'row', gap: 6, marginBottom: 4 },
  progressDot: { flex: 1, height: 4, borderRadius: 2 },
});
