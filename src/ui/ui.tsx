import React, { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { t } from '../i18n';
import { useGifteez } from '../state/GifteezContext';

export function Screen({
  children,
  footer,
}: {
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const { colors } = useGifteez();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.screen, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled">
        {children}
      </ScrollView>
      {footer ? <View style={{ paddingBottom: insets.bottom + 12, paddingHorizontal: 20 }}>{footer}</View> : null}
    </View>
  );
}

export function Title({ children }: { children: string }) {
  const { colors } = useGifteez();
  return <Text style={[styles.title, { color: colors.text }]}>{children}</Text>;
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
}: {
  label: string;
  onPress: () => void;
  tone?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
}) {
  const { colors } = useGifteez();
  const background = tone === 'primary' ? colors.accent : tone === 'danger' ? colors.danger : colors.surface;
  const text = tone === 'secondary' ? colors.text : colors.accentText;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[styles.button, { backgroundColor: background, borderColor: colors.border, opacity: disabled ? 0.5 : 1 }]}>
      <Text style={[styles.buttonText, { color: text }]}>{label}</Text>
    </Pressable>
  );
}

export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'email-address' | 'phone-pad' | 'number-pad' | 'decimal-pad';
}) {
  const { colors } = useGifteez();
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: colors.muted }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        keyboardType={keyboardType}
        autoCapitalize={keyboardType === 'email-address' ? 'none' : 'sentences'}
        style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
      />
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

export function Notice({ text, onClose }: { text: string; onClose: () => void }) {
  const { colors } = useGifteez();
  return (
    <Pressable onPress={onClose} style={[styles.notice, { backgroundColor: colors.text }]}>
      <Text style={[styles.noticeText, { color: colors.background }]}>{text}</Text>
    </Pressable>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const { colors } = useGifteez();
  return <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }, style]}>{children}</View>;
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
  const { snapshot, sendEmail, finishEmail, sendPhone, confirmPhone, colors } = useGifteez();
  const [name, setName] = useState(snapshot.profile.displayName);
  const [groupName, setGroupName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [link, setLink] = useState('');
  const [sms, setSms] = useState(false);
  if (!visible) {
    return null;
  }
  return (
    <View style={[styles.sheet, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
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
        <Field label={t('groupCreate.email')} value={email} onChangeText={setEmail} keyboardType="email-address" />
        <Button label={t('groupCreate.sendLink')} onPress={() => sendEmail(email)} disabled={!email.trim()} />
        <Field label={t('groupCreate.pasteLink')} value={link} onChangeText={setLink} />
        <Button label={t('groupCreate.finishLink')} onPress={() => finishEmail(link)} disabled={!link.trim()} />
        <Button label={t('groupCreate.useSms')} onPress={() => setSms(true)} tone="secondary" />
        {sms ? (
          <>
            <Body>{t('groupCreate.smsRegion')}</Body>
            <Field label={t('groupCreate.phone')} value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
            <Button label={t('groupCreate.sendCode')} onPress={() => sendPhone(phone)} />
            <Field label={t('groupCreate.code')} value={code} onChangeText={setCode} keyboardType="number-pad" />
            <Button label={t('groupCreate.confirmCode')} onPress={() => confirmPhone(code)} />
          </>
        ) : null}
        <Button label={showCreate ? t('groupCreate.skip') : t('common.close')} onPress={onClose} tone="secondary" />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: 20, gap: 12 },
  title: { fontSize: 28, fontWeight: '700', flexShrink: 1 },
  body: { fontSize: 16, lineHeight: 22, flexShrink: 1 },
  button: {
    minHeight: 48,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    flexGrow: 1,
  },
  buttonText: { fontSize: 17, fontWeight: '600', textAlign: 'center', flexShrink: 1 },
  field: { gap: 6 },
  label: { fontSize: 14 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 12, fontSize: 17 },
  banner: { borderWidth: 1, borderRadius: 12, padding: 12, gap: 8 },
  bannerText: { fontSize: 15, lineHeight: 21, flexShrink: 1 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  notice: { position: 'absolute', left: 16, right: 16, bottom: 24, borderRadius: 12, padding: 14 },
  noticeText: { fontSize: 15, textAlign: 'center' },
  card: { borderWidth: 1, borderRadius: 14, padding: 14, gap: 8 },
  sheet: { ...StyleSheet.absoluteFill, zIndex: 5 },
});
