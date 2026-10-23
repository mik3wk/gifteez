import React, { useEffect, useRef, useState } from 'react';
import { Share, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { describeIncomingLink, joinConfirmModel, type JoinPreview } from '../app/incomingLink';
import type { RootStack } from '../app/navigation';
import { getEnv } from '../config/env';
import { accountUnlocked, canStartAnotherList, fairnessRows, groupCurrency, groupDisplayName, groupMarker } from '../domain/logic';
import { isHiddenFromViewer } from '../domain/visibility';
import { deviceLocale, formatMoney, t } from '../i18n';
import { useGifteez } from '../state/GifteezContext';
import { useGroupLabel } from '../ui/heading';
import { AccountSheet, Body, Button, Card, EmptyState, Field, Heading, Row, Screen, Title, UnlockSheet } from '../ui/ui';

export function FairnessScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStack>>();
  const { snapshot, colors } = useGifteez();
  const heading = useGroupLabel();
  const money = (cents: number) => formatMoney(cents, deviceLocale(), groupCurrency(snapshot.group));
  const rows = fairnessRows(snapshot, new Date()).filter(row => {
    const person = snapshot.people.find(item => item.id === row.personId);
    return !isHiddenFromViewer(person, snapshot.profile.uid);
  });
  const max = Math.max(1, ...rows.map(row => row.yearSpentCents));
  return (
    <Screen>
      <Title>{t('fairness.title')}</Title>
      <Body>{`${heading.emoji} ${heading.label}`}</Body>
      <Body>{t('fairness.intro')}</Body>
      {rows.length === 0 ? (
        <EmptyState
          kind="fairness"
          text={t('fairness.empty')}
          action={t('fairness.emptyAction')}
          onAction={() => navigation.navigate('AddPerson')}
        />
      ) : null}
      {rows.map(row => (
        <Card key={row.personId}>
          <Text style={[styles.name, { color: colors.text }]}>{row.name}</Text>
          <Text style={{ color: colors.muted }}>{t('fairness.gifts', { count: row.giftCount })}</Text>
          <Text style={{ color: colors.text }}>{t('fairness.year', { amount: money(row.yearSpentCents) })}</Text>
          <Text style={{ color: colors.muted }}>{t('fairness.all', { amount: money(row.spentCents) })}</Text>
          <Text style={{ color: colors.text }}>
            {row.remainingCents == null ? t('fairness.noBudget') : t('fairness.left', { amount: money(row.remainingCents) })}
          </Text>
          <View style={[styles.track, { backgroundColor: colors.border }]}>
            <View style={[styles.bar, { backgroundColor: colors.accent, width: `${Math.round((row.yearSpentCents / max) * 100)}%` }]} />
          </View>
        </Card>
      ))}
    </Screen>
  );
}

export function GroupScreen() {
  const { snapshot, shareInvite, leave, removeGroupMember, renameList, showRecovery, switchGroup, startGroup, colors, transferOwnership, setListCurrency } = useGifteez();
  const heading = useGroupLabel();
  const groupName = snapshot.group?.name ?? '';
  const groupId = snapshot.group?.id;
  const storedCurrency = groupCurrency(snapshot.group);
  const [name, setName] = useState(groupName);
  const [currency, setCurrency] = useState(storedCurrency);
  const [code, setCode] = useState<string | null>(null);
  const [upgrade, setUpgrade] = useState(false);
  const [creating, setCreating] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const canStart = canStartAnotherList(snapshot, snapshot.profile.uid ?? '');
  useEffect(() => {
    setName(groupName);
    setCurrency(storedCurrency);
  }, [groupId, groupName, storedCurrency]);
  return (
    <Screen>
      <Title>{`${heading.emoji} ${heading.label}`}</Title>
      <Heading>{t('groupScreen.lists')}</Heading>
      {snapshot.roster.map(item => {
        const marker = groupMarker(item.id);
        const label = groupDisplayName(item.name, item.memberNames);
        const active = item.id === snapshot.group?.id;
        return (
          <Row key={item.id} accessibilityLabel={label} onPress={() => switchGroup(item.id)}>
              <Text style={[styles.name, { color: marker.color }]}>{`${marker.emoji} ${label}`}</Text>
              <Text style={{ color: colors.muted }}>{active ? t('groupScreen.current') : t('groupScreen.switchTo')}</Text>
              {item.stale ? <Text style={{ color: colors.muted }}>{t('groupScreen.notCurrent')}</Text> : null}
          </Row>
        );
      })}
      <Button
        label={t('groupScreen.newList')}
        tone="secondary"
        onPress={() => {
          if (canStart) {
            setCreating(true);
          } else {
            setUnlocking(true);
          }
        }}
      />
      <Field label={t('groupScreen.groupName')} value={name} onChangeText={setName} />
      <Body>{t('groupScreen.nameHint', { name: heading.label })}</Body>
      <Button label={t('groupScreen.rename')} onPress={() => renameList(name)} />
      {snapshot.profile.uid === snapshot.group?.ownerId ? (
        <>
          <Field label={t('groupScreen.currency')} value={currency} onChangeText={setCurrency} accessibilityLabel={t('groupScreen.currency')} />
          <Button label={t('groupScreen.saveCurrency')} accessibilityLabel={t('groupScreen.saveCurrencyLabel')} tone="secondary" onPress={() => setListCurrency(currency)} />
        </>
      ) : null}
      <Body>{t('groupScreen.inviteHint', { count: getEnv().groupMaxMembers })}</Body>
      <Button
        label={t('groupScreen.invite')}
        onPress={async () => {
          if (!snapshot.profile.upgraded) {
            setUpgrade(true);
          }
          const message = await shareInvite();
          if (message) {
            await Share.share({ message });
          }
        }}
      />
      <Heading>{t('groupScreen.members')}</Heading>
      {snapshot.members.filter(member => !member.deleted).map(member => (
        <Card key={member.uid}>
          <Text style={[styles.name, { color: colors.text }]}>
            {member.displayName}{member.uid === snapshot.profile.uid ? ` · ${t('groupScreen.you')}` : ''}
            {member.uid === snapshot.group?.ownerId ? ` · ${t('groupScreen.owner')}` : ''}
          </Text>
          {snapshot.profile.uid === snapshot.group?.ownerId && member.uid !== snapshot.profile.uid ? (
            <>
              <Button
                label={t('groupScreen.makeOwner')}
                accessibilityLabel={t('groupScreen.makeOwnerLabel', { name: member.displayName })}
                tone="secondary"
                onPress={() => transferOwnership(member.uid)}
              />
              <Button label={t('groupScreen.remove')} tone="danger" onPress={() => removeGroupMember(member.uid)} />
            </>
          ) : null}
        </Card>
      ))}
      <Body>{t('groupScreen.recoveryWhy')}</Body>
      <Button
        label={t('groupScreen.recovery')}
        tone="secondary"
        onPress={async () => setCode((await showRecovery()) || t('groupScreen.emptyCode'))}
      />
      {code ? <Body>{code}</Body> : null}
      <Button label={t('groupScreen.leave')} tone="danger" onPress={leave} />
      <UnlockSheet visible={unlocking} onClose={() => setUnlocking(false)} />
      <AccountSheet visible={upgrade} allowName={false} showCreate={false} onClose={() => setUpgrade(false)} />
      <AccountSheet
        visible={creating}
        allowName={!snapshot.profile.nameLocked}
        showCreate
        onClose={() => setCreating(false)}
        onCreate={async (personName, groupName) => {
          await startGroup(personName, groupName);
          setCreating(false);
        }}
      />
    </Screen>
  );
}

export function JoinConfirmScreen() {
  const route = useRoute<RouteProp<RootStack, 'JoinConfirm'>>();
  const navigation = useNavigation<NativeStackNavigationProp<RootStack>>();
  const { previewInvite, joinFromLink } = useGifteez();
  const [preview, setPreview] = useState<JoinPreview | null>(null);
  const [joining, setJoining] = useState(false);
  useEffect(() => {
    let cancelled = false;
    previewInvite(route.params.url)
      .then(next => {
        if (!cancelled) {
          setPreview(next);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPreview(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [previewInvite, route.params.url]);
  return (
    <JoinConfirmView
      model={joinConfirmModel(preview)}
      joining={joining}
      onJoin={() => {
        if (joining) {
          return;
        }
        setJoining(true);
        joinFromLink(route.params.url)
          .catch(() => undefined)
          .finally(() => setJoining(false));
      }}
      onCancel={() => {
        if (navigation.canGoBack()) {
          navigation.goBack();
        }
      }}
    />
  );
}

export function JoinConfirmView({
  model,
  joining,
  onJoin,
  onCancel,
}: {
  model: ReturnType<typeof joinConfirmModel>;
  joining?: boolean;
  onJoin: () => void;
  onCancel: () => void;
}) {
  const heading = model.emoji ? `${model.emoji} ${model.question}` : model.question;
  return (
    <Screen>
      <Text
        accessibilityRole="header"
        accessibilityLabel={model.question}
        style={[styles.name, model.color ? { color: model.color } : null]}>
        {heading}
      </Text>
      <Button
        label={t('join.confirmJoin')}
        accessibilityLabel={model.joinLabel}
        disabled={joining}
        busy={joining}
        onPress={onJoin}
      />
      <Button
        label={t('join.confirmCancel')}
        accessibilityLabel={model.cancelLabel}
        tone="secondary"
        onPress={onCancel}
      />
    </Screen>
  );
}

export function JoinScreen() {
  const { joinFromLink, restoreWithCode, sendEmail, finishEmail, previewInvite } = useGifteez();
  const [link, setLink] = useState('');
  const [code, setCode] = useState('');
  const [email, setEmail] = useState('');
  const [emailLink, setEmailLink] = useState('');
  const [linkError, setLinkError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [preview, setPreview] = useState<{ label: string; emoji: string; color: string } | null>(null);
  useEffect(() => {
    let cancelled = false;
    previewInvite(link).then(next => {
      if (!cancelled) {
        setPreview(next);
      }
    }).catch(() => {
      if (!cancelled) {
        setPreview(null);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [link, previewInvite]);
  return (
    <Screen>
      <Title>{t('join.title')}</Title>
      <Body>{t('join.body')}</Body>
      {preview ? (
        <Text style={[styles.name, { color: preview.color }]}>
          {t('join.preview', { name: `${preview.emoji} ${preview.label}` })}
        </Text>
      ) : null}
      <Field
        label={t('join.placeholder')}
        value={link}
        error={linkError}
        onChangeText={value => {
          setLink(value);
          setLinkError('');
        }}
      />
      <Button
        label={t('join.join')}
        onPress={() => {
          if (describeIncomingLink(link.trim()) === 'ignore') {
            setLinkError(t('join.invalid'));
            return;
          }
          return joinFromLink(link);
        }}
      />
      <Heading>{t('groupCreate.secondDevice')}</Heading>
      <Body>{t('join.needAccount')}</Body>
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
        disabled={!email.trim()}
        onPress={() => {
          if (!email.includes('@')) {
            setEmailError(t('errors.email'));
            return;
          }
          return sendEmail(email);
        }}
      />
      <Field label={t('groupCreate.pasteLink')} value={emailLink} onChangeText={setEmailLink} />
      <Button label={t('groupCreate.finishLink')} onPress={() => finishEmail(emailLink)} />
      <Field label={t('join.recovery')} value={code} onChangeText={setCode} />
      <Button label={t('join.restore')} tone="secondary" onPress={() => restoreWithCode(code)} />
    </Screen>
  );
}

export function SettingsScreen() {
  const {
    snapshot,
    exportText,
    setReminders,
    deleteAccount,
    buy,
    restorePurchases,
    storeProduct,
    storeReady,
    skinId,
    importText,
    importFromContacts,
    importFromCalendar,
    envNotice,
  } = useSettingsData();
  const [upgrade, setUpgrade] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const exportAfterSave = useRef(false);
  const [pasted, setPasted] = useState('');
  const [message, setMessage] = useState<string | null>(envNotice);
  useEffect(() => {
    if (!exportAfterSave.current || !snapshot.profile.upgraded) {
      return;
    }
    exportAfterSave.current = false;
    const text = exportText();
    if (text) {
      Share.share({ message: text }).catch(() => undefined);
    }
  }, [exportText, snapshot.profile.upgraded]);
  return (
    <Screen>
      <Title>{t('settings.title')}</Title>
      <Card>
        <Heading>{t('settings.account')}</Heading>
        <Body>{snapshot.profile.upgraded ? t('settings.saved') : t('settings.anonymous')}</Body>
        <Text style={styles.name}>{snapshot.profile.displayName}</Text>
        {snapshot.profile.upgraded ? null : <Button label={t('settings.upgrade')} onPress={() => setUpgrade(true)} />}
      </Card>
      <Body>{t('settings.exportHint')}</Body>
      <Button
        label={t('settings.export')}
        onPress={async () => {
          if (!snapshot.profile.upgraded) {
            exportAfterSave.current = true;
            setUpgrade(true);
            return;
          }
          const message = exportText();
          if (message) {
            await Share.share({ message });
          }
        }}
      />
      <Body>{t('settings.remindersHint')}</Body>
      <Button
        label={snapshot.profile.reminders === 'on' ? t('settings.remindersOn') : t('settings.remindersOff')}
        accessibilityLabel={t('settings.remindersLabel')}
        tone="secondary"
        onPress={() => setReminders(snapshot.profile.reminders !== 'on')}
      />
      <Card>
        <Heading>{t('settings.unlock')}</Heading>
        {accountUnlocked(snapshot) ? <Body>{t('settings.unlocked')}</Body> : (
          <>
            <Body>{t('settings.unlockPrice', { price: storeProduct?.displayPrice || messagePrice() })}</Body>
            {storeReady ? null : <Body>{t('settings.storeMissing')}</Body>}
            <Button label={t('settings.unlock')} onPress={buy} />
            <Button label={t('settings.restore')} tone="secondary" onPress={restorePurchases} />
          </>
        )}
      </Card>
      <Body>{t('settings.skinNow', { skin: skinId })}</Body>
      <Body>{t('settings.optional')}</Body>
      <Body>{t('settings.calendarHint')}</Body>
      <Button
        label={t('settings.calendar')}
        tone="secondary"
        onPress={async () => setMessage(await describeImport(await importFromCalendar()))}
      />
      <Body>{t('settings.contactsHint')}</Body>
      <Button
        label={t('settings.contacts')}
        tone="secondary"
        onPress={async () => setMessage(await describeImport(await importFromContacts()))}
      />
      <Field label={t('settings.pasteImport')} value={pasted} onChangeText={setPasted} />
      <Body>{t('settings.pasteHint')}</Body>
      <Button
        label={t('settings.importAction')}
        onPress={async () => setMessage(await describeImport(await importText(pasted)))}
      />
      {confirmDelete ? (
        <>
          <Body>{t('settings.deleteAccountBody')}</Body>
          <Button
            label={t('settings.deleteAccountConfirm')}
            accessibilityLabel={t('settings.deleteAccountConfirmLabel')}
            tone="danger"
            onPress={() => deleteAccount()}
          />
        </>
      ) : (
        <Button
          label={t('settings.deleteAccount')}
          accessibilityLabel={t('settings.deleteAccountLabel')}
          tone="danger"
          onPress={() => setConfirmDelete(true)}
        />
      )}
      {message ? <Body>{message}</Body> : null}
      <AccountSheet
        visible={upgrade}
        allowName={false}
        showCreate={false}
        onClose={() => {
          setUpgrade(false);
          if (!snapshot.profile.upgraded) {
            exportAfterSave.current = false;
          }
        }}
      />
    </Screen>
  );
}

function useSettingsData() {
  const api = useGifteez();
  return { ...api, envNotice: api.error };
}

function messagePrice(): string {
  return formatMoney(Math.round(getEnv().iapPriceUsd * 100));
}

async function describeImport(result: number | 'denied'): Promise<string> {
  if (result === 'denied') {
    return t('importFlow.denied');
  }
  if (result === 0) {
    return t('importFlow.none');
  }
  return t('importFlow.added', { count: result });
}

const styles = StyleSheet.create({
  name: { fontSize: 18, fontWeight: '600' },
  track: { height: 8, borderRadius: 8, overflow: 'hidden' },
  bar: { height: 8 },
});
