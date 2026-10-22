import React, { useState } from 'react';
import { View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { describeIncomingLink } from '../app/incomingLink';
import { t } from '../i18n';
import { useGifteez } from '../state/GifteezContext';
import { AccountSheet, Body, Button, Field, Screen, Title } from '../ui/ui';
import type { RootStack } from '../app/navigation';

export function FirstOpenScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStack>>();
  const { startGroup, snapshot } = useGifteez();
  const [open, setOpen] = useState(false);
  const [invite, setInvite] = useState('');
  const [pasteError, setPasteError] = useState(false);
  return (
    <Screen>
      <Title>{t('appName')}</Title>
      <Body>{t('firstOpen.sentence')}</Body>
      <View style={{ gap: 8 }}>
        <Button label={t('firstOpen.start')} onPress={() => setOpen(true)} />
        <Button label={t('firstOpen.join')} tone="secondary" onPress={() => navigation.navigate('Join')} />
        <Field
          label={t('firstOpen.pasteInvite')}
          accessibilityLabel={t('firstOpen.pasteInvite')}
          value={invite}
          onChangeText={value => {
            setInvite(value);
            setPasteError(false);
          }}
        />
        <Body>{t('firstOpen.pasteHint')}</Body>
        <Button
          label={t('firstOpen.pasteContinue')}
          accessibilityLabel={t('firstOpen.pasteContinueLabel')}
          tone="secondary"
          onPress={() => {
            const url = invite.trim();
            if (describeIncomingLink(url) !== 'confirm-invite') {
              setPasteError(true);
              return;
            }
            navigation.navigate('JoinConfirm', { url });
          }}
        />
        {pasteError ? <Body>{t('join.invalid')}</Body> : null}
      </View>
      <AccountSheet
        visible={open}
        allowName={!snapshot.profile.nameLocked}
        showCreate
        onClose={() => setOpen(false)}
        onCreate={async (name, groupName) => {
          await startGroup(name, groupName);
          setOpen(false);
        }}
      />
    </Screen>
  );
}
