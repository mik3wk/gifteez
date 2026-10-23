import React, { useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { describeIncomingLink } from '../app/incomingLink';
import { t } from '../i18n';
import { useGifteez } from '../state/GifteezContext';
import { Body, Button, Field, Screen, Title } from '../ui/ui';
import type { RootStack } from '../app/navigation';

export function FirstOpenScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStack>>();
  const { startGroup, addPerson, openPerson } = useGifteez();
  const [name, setName] = useState('');
  const [nameError, setNameError] = useState('');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [invite, setInvite] = useState('');
  const [inviteError, setInviteError] = useState('');

  return (
    <Screen>
      <Title>{t('firstOpen.title')}</Title>
      <Body>{t('firstOpen.lead')}</Body>
      <Field
        label={t('firstOpen.theirName')}
        value={name}
        error={nameError}
        onChangeText={value => {
          setName(value);
          setNameError('');
        }}
      />
      <Button
        label={t('firstOpen.start')}
        onPress={async () => {
          const trimmed = name.trim();
          if (!trimmed) {
            setNameError(t('errors.name'));
            return;
          }
          const started = await startGroup('', '');
          if (!started) {
            return;
          }
          const id = await addPerson({ name: trimmed, budget: '', tags: [] });
          if (id) {
            openPerson(id);
          }
        }}
      />
      <Button label={t('firstOpen.haveInvite')} tone="ghost" onPress={() => setInviteOpen(true)} />
      {inviteOpen ? (
        <>
          <Body>{t('firstOpen.pasteHint')}</Body>
          <Field
            label={t('firstOpen.pasteInvite')}
            value={invite}
            error={inviteError}
            onChangeText={value => {
              setInvite(value);
              setInviteError('');
            }}
          />
          <Button
            label={t('firstOpen.pasteContinue')}
            accessibilityLabel={t('firstOpen.pasteContinueLabel')}
            tone="secondary"
            onPress={() => {
              const url = invite.trim();
              if (describeIncomingLink(url) !== 'confirm-invite') {
                setInviteError(t('join.invalid'));
                return;
              }
              navigation.navigate('JoinConfirm', { url });
            }}
          />
          <Button label={t('firstOpen.join')} tone="secondary" onPress={() => navigation.navigate('Join')} />
        </>
      ) : null}
    </Screen>
  );
}
