import React, { useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { describeIncomingLink } from '../app/incomingLink';
import { t } from '../i18n';
import { useGifteez } from '../state/GifteezContext';
import { Body, Button, Card, Field, Heading, Progress, Screen, Title } from '../ui/ui';
import type { RootStack } from '../app/navigation';

const STEPS = ['welcome', 'choose', 'name', 'secure'] as const;
type Step = (typeof STEPS)[number];

const POINTS = [
  ['pointPeople', 'pointPeopleBody'],
  ['pointIdeas', 'pointIdeasBody'],
  ['pointShare', 'pointShareBody'],
  ['pointClaim', 'pointClaimBody'],
] as const;

export function FirstOpenScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStack>>();
  const { startGroup, sendEmail, finishEmail, snapshot } = useGifteez();
  const [step, setStep] = useState<Step>('welcome');
  const [name, setName] = useState(snapshot.profile.displayName);
  const [groupName, setGroupName] = useState('');
  const [email, setEmail] = useState('');
  const [link, setLink] = useState('');
  const [invite, setInvite] = useState('');
  const [nameError, setNameError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [inviteError, setInviteError] = useState('');
  const index = STEPS.indexOf(step);

  const create = () => startGroup(name, groupName);

  return (
    <Screen>
      <Progress step={index + 1} total={STEPS.length} />
      {step === 'welcome' ? (
        <>
          <Title>{t('appName')}</Title>
          <Body>{t('firstOpen.lead')}</Body>
          {POINTS.map(([title, body]) => (
            <Card key={title}>
              <Heading>{t(`firstOpen.${title}`)}</Heading>
              <Body>{t(`firstOpen.${body}`)}</Body>
            </Card>
          ))}
          <Button label={t('common.continue')} onPress={() => setStep('choose')} />
          <Button label={t('firstOpen.skipIntro')} tone="ghost" onPress={() => setStep('name')} />
        </>
      ) : null}
      {step === 'choose' ? (
        <>
          <Title>{t('firstOpen.chooseTitle')}</Title>
          <Body>{t('firstOpen.chooseBody')}</Body>
          <Button label={t('firstOpen.start')} onPress={() => setStep('name')} />
          <Button label={t('firstOpen.join')} tone="secondary" onPress={() => navigation.navigate('Join')} />
          <Field
            label={t('firstOpen.pasteInvite')}
            value={invite}
            error={inviteError}
            onChangeText={value => {
              setInvite(value);
              setInviteError('');
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
                setInviteError(t('join.invalid'));
                return;
              }
              navigation.navigate('JoinConfirm', { url });
            }}
          />
          <Button label={t('common.back')} tone="ghost" onPress={() => setStep('welcome')} />
        </>
      ) : null}
      {step === 'name' ? (
        <>
          <Title>{t('groupCreate.title')}</Title>
          <Body>{t('groupCreate.body')}</Body>
          <Field
            label={t('groupCreate.name')}
            value={name}
            error={nameError}
            onChangeText={value => {
              setName(value);
              setNameError('');
            }}
          />
          <Field label={t('groupCreate.listName')} value={groupName} onChangeText={setGroupName} />
          <Body>{t('groupCreate.listNameHint')}</Body>
          <Button
            label={t('common.continue')}
            onPress={() => {
              if (!name.trim()) {
                setNameError(t('errors.name'));
                return;
              }
              setStep('secure');
            }}
          />
          <Button label={t('common.back')} tone="ghost" onPress={() => setStep('choose')} />
        </>
      ) : null}
      {step === 'secure' ? (
        <>
          <Title>{t('groupCreate.secureTitle')}</Title>
          <Body>{t('groupCreate.emailWhy')}</Body>
          <Body>{t('groupCreate.recoveryWhy')}</Body>
          <Field
            label={t('groupCreate.email')}
            value={email}
            error={emailError}
            keyboardType="email-address"
            onChangeText={value => {
              setEmail(value);
              setEmailError('');
            }}
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
          <Field label={t('groupCreate.pasteLink')} value={link} onChangeText={setLink} />
          <Button label={t('groupCreate.finishLink')} tone="secondary" disabled={!link.trim()} onPress={() => finishEmail(link)} />
          <Button label={t('groupCreate.create')} onPress={create} />
          <Button label={t('groupCreate.skip')} tone="ghost" onPress={create} />
          <Button label={t('common.back')} tone="ghost" onPress={() => setStep('name')} />
        </>
      ) : null}
    </Screen>
  );
}
