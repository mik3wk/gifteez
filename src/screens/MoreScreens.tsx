import React, { useEffect, useRef, useState } from 'react';
import { Share, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { describeIncomingLink, joinConfirmModel, type JoinPreview } from '../app/incomingLink';
import type { RootStack } from '../app/navigation';
import { getEnv } from '../config/env';
import { accountUnlocked, canStartAnotherList, fairnessRows, groupCurrency, groupDisplayName } from '../domain/logic';
import { isHiddenFromViewer } from '../domain/visibility';
import { deviceLocale, formatMoney, t } from '../i18n';
import { useGifteez } from '../state/GifteezContext';
import { groupHue } from '../theme/skins';
import { useTheme } from '../theme/useTheme';
import { useGroupLabel } from '../ui/heading';
import { SessionEntrance, Unwrap } from '../ui/motion';
import { Icon } from '../ui/icons';
import {
  AccountSheet,
  AppHeader,
  Avatar,
  Body,
  Button,
  Caption,
  Card,
  Display,
  Cluster,
  confirmDestructive,
  EmptyState,
  Field,
  GroupAvatar,
  Heading,
  HueDot,
  ProgressBar,
  Row,
  Screen,
  Stack,
  Title,
  Toggle,
  UnlockSheet,
} from '../ui/ui';

export function FairnessScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStack>>();
  const { snapshot } = useGifteez();
  const { scheme } = useTheme();
  const heading = useGroupLabel();
  const money = (cents: number) => formatMoney(cents, deviceLocale(), groupCurrency(snapshot.group), true);
  const rows = fairnessRows(snapshot, new Date()).filter(row => {
    const person = snapshot.people.find(item => item.id === row.personId);
    return !isHiddenFromViewer(person, snapshot.profile.uid);
  });
  const max = Math.max(1, ...rows.map(row => row.yearSpentCents));
  const quiet = rows.length > 0 && rows.every(row => row.giftCount === 0);
  return (
    <Screen tab="fairness">
      <AppHeader title={heading.label} />
      <SessionEntrance id="fairness">
      <Display>{t('fairness.title')}</Display>
      <Body>{t('fairness.intro')}</Body>
      {rows.length === 0 ? (
        <EmptyState
          kind="fairness"
          text={t('fairness.empty')}
          action={t('fairness.emptyAction')}
          onAction={() => navigation.navigate('AddPerson')}
        />
      ) : null}
      {quiet ? <EmptyState kind="fairness" text={t('fairness.noneYet')} /> : null}
      {rows.map(row => (
        <Card key={row.personId}>
          <View style={fairnessName}>
            <Avatar initials={row.name} hue={groupHue(row.name.length, scheme)} />
            <Body strong>{row.name}</Body>
          </View>
          <Caption>{t('fairness.gifts', { count: row.giftCount })}</Caption>
          <Caption tone="text">{t('fairness.year', { amount: money(row.yearSpentCents) })}</Caption>
          <Caption>{t('fairness.all', { amount: money(row.spentCents) })}</Caption>
          <Caption tone="text">
            {row.remainingCents == null ? t('fairness.noBudget') : t('fairness.left', { amount: money(row.remainingCents) })}
          </Caption>
          <ProgressBar value={row.yearSpentCents / max} />
        </Card>
      ))}
      </SessionEntrance>
    </Screen>
  );
}

const fairnessName = { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 12 };

export function GroupScreen() {
  const { snapshot, shareInvite, leave, removeGroupMember, renameList, showRecovery, switchGroup, startGroup, transferOwnership, setListCurrency } = useGifteez();
  const { colors } = useTheme();
  const heading = useGroupLabel();
  const groupName = snapshot.group?.name ?? '';
  const groupId = snapshot.group?.id;
  const storedCurrency = groupCurrency(snapshot.group);
  const [name, setName] = useState(groupName);
  const [currency, setCurrency] = useState(storedCurrency);
  const [currencyError, setCurrencyError] = useState('');
  const [code, setCode] = useState<string | null>(null);
  const [upgrade, setUpgrade] = useState(false);
  const [creating, setCreating] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const canStart = canStartAnotherList(snapshot, snapshot.profile.uid ?? '');
  useEffect(() => {
    setName(groupName);
    setCurrency(storedCurrency);
  }, [groupId, groupName, storedCurrency]);
  const members = snapshot.members.filter(member => !member.deleted);
  return (
    <Screen tab="group">
      <AppHeader title={heading.label} />
      <SessionEntrance id="group">
      <Heading>{t('groupScreen.lists')}</Heading>
      {snapshot.roster.length === 0 ? <EmptyState kind="group" text={t('groupScreen.listsEmpty')} /> : null}
      {snapshot.roster.map(item => {
        const label = groupDisplayName(item.name, item.memberNames);
        const active = item.id === snapshot.group?.id;
        return (
          <Row key={item.id} accessibilityLabel={label} onPress={() => switchGroup(item.id)}>
            <RowLine>
              <GroupAvatar />
              <Stack>
                <Body strong>{label}</Body>
                {item.stale ? <Caption>{t('groupScreen.notCurrent')}</Caption> : null}
              </Stack>
              {active ? <Icon name="check" color={colors.text} /> : <Caption>{t('groupScreen.switchTo')}</Caption>}
            </RowLine>
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
      <Card>
        <Field label={t('groupScreen.groupName')} value={name} onChangeText={setName} />
        <Caption>{t('groupScreen.nameHint', { name: heading.label })}</Caption>
        <Button label={t('groupScreen.rename')} tone="secondary" onPress={() => renameList(name)} />
      </Card>
      {snapshot.profile.uid === snapshot.group?.ownerId ? (
        <Card>
          <Field
            label={t('groupScreen.currency')}
            value={currency}
            error={currencyError}
            onChangeText={value => {
              setCurrency(value);
              setCurrencyError('');
            }}
            accessibilityLabel={t('groupScreen.currency')}
          />
          <Button
            label={t('groupScreen.saveCurrency')}
            accessibilityLabel={t('groupScreen.saveCurrencyLabel')}
            tone="secondary"
            onPress={() => {
              if (!/^[A-Za-z]{3}$/.test(currency.trim())) {
                setCurrencyError(t('errors.currency'));
                return;
              }
              return setListCurrency(currency);
            }}
          />
        </Card>
      ) : null}
      <Card>
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
      </Card>
      <Heading>{t('groupScreen.members')}</Heading>
      {members.length === 0 ? <EmptyState kind="group" text={t('groupScreen.members')} /> : null}
      {members.map(member => (
        <Card key={member.uid}>
          <Body strong>
            {`${member.displayName}${member.uid === snapshot.profile.uid ? ` · ${t('groupScreen.you')}` : ''}${member.uid === snapshot.group?.ownerId ? ` · ${t('groupScreen.owner')}` : ''}`}
          </Body>
          {snapshot.profile.uid === snapshot.group?.ownerId && member.uid !== snapshot.profile.uid ? (
            <>
              <Button
                label={t('groupScreen.makeOwner')}
                accessibilityLabel={t('groupScreen.makeOwnerLabel', { name: member.displayName })}
                tone="secondary"
                onPress={() => transferOwnership(member.uid)}
              />
              <Button
                label={t('groupScreen.remove')}
                tone="danger-quiet"
                onPress={async () => {
                  const ok = await confirmDestructive(
                    t('groupScreen.removeConfirm', { name: member.displayName }),
                    t('groupScreen.removeBody'),
                    t('groupScreen.remove'),
                  );
                  if (ok) {
                    await removeGroupMember(member.uid);
                  }
                }}
              />
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
      <Button
        label={t('groupScreen.leave')}
        tone="danger-quiet"
        onPress={async () => {
          const ok = await confirmDestructive(t('groupScreen.leaveConfirm'), t('groupScreen.leaveBody'), t('groupScreen.leave'));
          if (ok) {
            await leave();
          }
        }}
      />
      </SessionEntrance>
      <UnlockSheet visible={unlocking} onClose={() => setUnlocking(false)} />
      <AccountSheet visible={upgrade} allowName={false} showCreate={false} onClose={() => setUpgrade(false)} />
      <AccountSheet
        visible={creating}
        allowName={!snapshot.profile.nameLocked}
        showCreate
        onClose={() => setCreating(false)}
        onCreate={async (personName, nextGroupName) => {
          await startGroup(personName, nextGroupName);
          setCreating(false);
        }}
      />
    </Screen>
  );
}

function RowLine({ children }: { children: React.ReactNode }) {
  return <ViewRow>{children}</ViewRow>;
}

function ViewRow({ children }: { children: React.ReactNode }) {
  return <Cluster>{children}</Cluster>;
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
  return (
    <Screen>
      <Unwrap>
        <GroupAvatar size={96} />
      </Unwrap>
      {model.color ? <HueDot color={model.color} /> : null}
      <Title accessibilityLabel={model.question}>{model.question}</Title>
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
  const [codeError, setCodeError] = useState('');
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
      <Body>{t('join.body')}</Body>
      {preview ? (
        <Card>
          <HueDot color={preview.color} />
          <Body>{t('join.preview', { name: preview.label })}</Body>
        </Card>
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
        textContentType="emailAddress"
        autoComplete="email"
      />
      <Button
        label={t('groupCreate.sendLink')}
        tone="secondary"
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
      <Button label={t('groupCreate.finishLink')} tone="secondary" onPress={() => finishEmail(emailLink)} />
      <Field
        label={t('join.recovery')}
        value={code}
        error={codeError}
        onChangeText={value => {
          setCode(value);
          setCodeError('');
        }}
      />
      <Button
        label={t('join.restore')}
        tone="secondary"
        onPress={async () => {
          const ok = await restoreWithCode(code);
          if (!ok) {
            setCodeError(t('errors.invalid'));
          }
        }}
      />
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
  const heading = useGroupLabel();
  const [upgrade, setUpgrade] = useState(false);
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
  const saved = snapshot.profile.upgraded;
  return (
    <Screen tab="settings">
      <AppHeader title={heading.label} />
      <SessionEntrance id="settings">
      <Heading>{t('settings.title')}</Heading>
      <Card>
        <Heading>{t('settings.account')}</Heading>
        <Body>{saved ? t('settings.saved') : t('settings.anonymous')}</Body>
        <Heading>{snapshot.profile.displayName}</Heading>
        {saved ? null : <Button label={t('settings.upgrade')} onPress={() => setUpgrade(true)} />}
        <Heading>{t('settings.unlock')}</Heading>
        {accountUnlocked(snapshot) ? <Body>{t('settings.unlocked')}</Body> : (
          <>
            <Body>{t('settings.unlockPrice', { price: storeProduct?.displayPrice || messagePrice() })}</Body>
            {storeReady ? null : <Body>{t('settings.storeMissing')}</Body>}
            <Button label={t('settings.unlock')} tone="secondary" onPress={buy} />
            <Button label={t('settings.restore')} tone="secondary" onPress={restorePurchases} />
          </>
        )}
      </Card>
      <Card>
        <Heading>{t('settings.reminders')}</Heading>
        <Body>{t('settings.remindersHint')}</Body>
        <Toggle
          label={t('settings.remindersLabel')}
          value={snapshot.profile.reminders === 'on'}
          onValueChange={value => { Promise.resolve(setReminders(value)).catch(() => undefined); }}
        />
      </Card>
      <Card>
        <Heading>{t('settings.appearance')}</Heading>
        <Caption tone="text">{t('settings.skinNow', { skin: skinId })}</Caption>
      </Card>
      <Card>
        <Heading>{t('settings.data')}</Heading>
        <Body>{t('settings.exportHint')}</Body>
        <Button
          label={t('settings.export')}
          tone={saved ? 'primary' : 'secondary'}
          onPress={async () => {
            if (!snapshot.profile.upgraded) {
              exportAfterSave.current = true;
              setUpgrade(true);
              return;
            }
            const text = exportText();
            if (text) {
              await Share.share({ message: text });
            }
          }}
        />
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
          tone="secondary"
          onPress={async () => setMessage(await describeImport(await importText(pasted)))}
        />
      </Card>
      <Card>
        <Heading>{t('settings.danger')}</Heading>
        <Button
          label={t('settings.deleteAccount')}
          accessibilityLabel={t('settings.deleteAccountLabel')}
          tone="danger-quiet"
          onPress={() => {
            confirmDestructive(
              t('settings.deleteAccount'),
              t('settings.deleteAccountBody'),
              t('settings.deleteAccountConfirm'),
              t('settings.deleteAccountConfirmLabel'),
            ).then(ok => {
              if (ok) {
                deleteAccount().catch(() => undefined);
              }
            }).catch(() => undefined);
          }}
        />
      </Card>
      {message ? <Body>{message}</Body> : null}
      </SessionEntrance>
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
