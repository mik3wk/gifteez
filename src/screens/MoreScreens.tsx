import React, { useEffect, useState } from 'react';
import { Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { getEnv } from '../config/env';
import { fairnessRows, groupDisplayName, groupMarker } from '../domain/logic';
import { formatMoney, t } from '../i18n';
import { useGifteez } from '../state/GifteezContext';
import { EmptyArt } from '../ui/art';
import { useGroupHeading } from '../ui/heading';
import { AccountSheet, Body, Button, Card, Field, Screen, Title } from '../ui/ui';

export function FairnessScreen() {
  const { snapshot, colors } = useGifteez();
  useGroupHeading();
  const rows = fairnessRows(snapshot, new Date());
  const max = Math.max(1, ...rows.map(row => row.yearSpentCents));
  return (
    <Screen>
      <Title>{t('fairness.title')}</Title>
      <Body>{t('fairness.intro')}</Body>
      {rows.length === 0 ? (
        <>
          <EmptyArt kind="fairness" />
          <Body>{t('fairness.empty')}</Body>
        </>
      ) : null}
      {rows.map(row => (
        <Card key={row.personId}>
          <Text style={[styles.name, { color: colors.text }]}>{row.name}</Text>
          <Text style={{ color: colors.muted }}>{t('fairness.gifts', { count: row.giftCount })}</Text>
          <Text style={{ color: colors.text }}>{t('fairness.year', { amount: formatMoney(row.yearSpentCents) })}</Text>
          <Text style={{ color: colors.muted }}>{t('fairness.all', { amount: formatMoney(row.spentCents) })}</Text>
          <Text style={{ color: colors.text }}>
            {row.remainingCents == null ? t('fairness.noBudget') : t('fairness.left', { amount: formatMoney(row.remainingCents) })}
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
  const { snapshot, shareInvite, leave, removeGroupMember, renameList, showRecovery, switchGroup, startGroup, colors } = useGifteez();
  const heading = useGroupHeading();
  const [name, setName] = useState(snapshot.group?.name ?? '');
  const [code, setCode] = useState<string | null>(null);
  const [upgrade, setUpgrade] = useState(false);
  const [creating, setCreating] = useState(false);
  useEffect(() => {
    setName(snapshot.group?.name ?? '');
  }, [snapshot.group?.id, snapshot.group?.name]);
  return (
    <Screen>
      <Title>{`${heading.emoji} ${heading.label}`}</Title>
      <Title>{t('groupScreen.lists')}</Title>
      {snapshot.roster.map(item => {
        const marker = groupMarker(item.id);
        const label = groupDisplayName(item.name, item.memberNames);
        const active = item.id === snapshot.group?.id;
        return (
          <Pressable key={item.id} onPress={() => switchGroup(item.id)}>
            <Card>
              <Text style={[styles.name, { color: marker.color }]}>{`${marker.emoji} ${label}`}</Text>
              <Text style={{ color: colors.muted }}>{active ? t('groupScreen.current') : t('groupScreen.switchTo')}</Text>
            </Card>
          </Pressable>
        );
      })}
      <Button label={t('groupScreen.newList')} tone="secondary" onPress={() => setCreating(true)} />
      <Field label={t('groupScreen.groupName')} value={name} onChangeText={setName} />
      <Body>{t('groupScreen.nameHint', { name: heading.label })}</Body>
      <Button label={t('groupScreen.rename')} onPress={() => renameList(name)} />
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
      <Title>{t('groupScreen.members')}</Title>
      {snapshot.members.filter(member => !member.deleted).map(member => (
        <Card key={member.uid}>
          <Text style={[styles.name, { color: colors.text }]}>
            {member.displayName}{member.uid === snapshot.profile.uid ? ` · ${t('groupScreen.you')}` : ''}
            {member.uid === snapshot.group?.ownerId ? ` · ${t('groupScreen.owner')}` : ''}
          </Text>
          {snapshot.profile.uid === snapshot.group?.ownerId && member.uid !== snapshot.profile.uid ? (
            <Button label={t('groupScreen.remove')} tone="danger" onPress={() => removeGroupMember(member.uid)} />
          ) : null}
        </Card>
      ))}
      <Button
        label={t('groupScreen.recovery')}
        tone="secondary"
        onPress={async () => setCode((await showRecovery()) || t('groupScreen.emptyCode'))}
      />
      {code ? <Body>{code}</Body> : null}
      <Button label={t('groupScreen.leave')} tone="danger" onPress={leave} />
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

export function JoinScreen() {
  const { joinFromLink, restoreWithCode, sendEmail, finishEmail, previewInvite } = useGifteez();
  const [link, setLink] = useState('');
  const [code, setCode] = useState('');
  const [email, setEmail] = useState('');
  const [emailLink, setEmailLink] = useState('');
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
      <Field label={t('join.placeholder')} value={link} onChangeText={setLink} />
      <Button label={t('join.join')} onPress={() => joinFromLink(link)} />
      <Title>{t('groupCreate.secondDevice')}</Title>
      <Body>{t('join.needAccount')}</Body>
      <Field label={t('groupCreate.email')} value={email} onChangeText={setEmail} keyboardType="email-address" />
      <Button label={t('groupCreate.sendLink')} onPress={() => sendEmail(email)} />
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
  const [pasted, setPasted] = useState('');
  const [message, setMessage] = useState<string | null>(envNotice);
  return (
    <Screen>
      <Title>{t('settings.title')}</Title>
      <Card>
        <Title>{t('settings.account')}</Title>
        <Body>{snapshot.profile.upgraded ? t('settings.saved') : t('settings.anonymous')}</Body>
        <Text style={styles.name}>{snapshot.profile.displayName}</Text>
        {snapshot.profile.upgraded ? null : <Button label={t('settings.upgrade')} onPress={() => setUpgrade(true)} />}
      </Card>
      <Body>{t('settings.exportHint')}</Body>
      <Button
        label={t('settings.export')}
        onPress={async () => {
          if (!snapshot.profile.upgraded) {
            setUpgrade(true);
          }
          await Share.share({ message: exportText() });
        }}
      />
      <Card>
        <Title>{t('settings.unlock')}</Title>
        {snapshot.entitlementPaid || snapshot.group?.entitled ? <Body>{t('settings.unlocked')}</Body> : (
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
      <Button
        label={t('settings.calendar')}
        tone="secondary"
        onPress={async () => setMessage(await describeImport(await importFromCalendar()))}
      />
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
      {message ? <Body>{message}</Body> : null}
      <AccountSheet visible={upgrade} allowName={false} showCreate={false} onClose={() => setUpgrade(false)} />
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
