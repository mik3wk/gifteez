import React, { useEffect, useRef } from 'react';
import { Linking, View } from 'react-native';
import { NavigationContainer, DefaultTheme, createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { t } from '../i18n';
import { MergeScreen } from '../screens/MergeScreen';
import { AddPersonScreen, PersonScreen } from '../screens/PersonScreen';
import { FirstOpenScreen } from '../screens/FirstOpen';
import { FairnessScreen, GroupScreen, JoinConfirmScreen, JoinScreen, SettingsScreen } from '../screens/MoreScreens';
import { describeIncomingLink } from './incomingLink';
import { PeopleScreen } from '../screens/PeopleScreen';
import { StartupScreen } from '../screens/StartupScreen';
import { GifteezProvider, useGifteez } from '../state/GifteezContext';
import { Body, Button, Screen, Title } from '../ui/ui';
import { Notice } from '../ui/ui';
import type { AppEnv } from '../config/env';
import type { RootStack } from './navigation';

const Stack = createNativeStackNavigator<RootStack>();
const navigationRef = createNavigationContainerRef<RootStack>();

export function ReadyApp({ env }: { env: AppEnv }) {
  return (
    <GifteezProvider env={env}>
      <Navigator />
    </GifteezProvider>
  );
}

function Navigator() {
  const gifteez = useGifteez();
  const linkHandler = useRef(gifteez);
  linkHandler.current = gifteez;
  const pendingUrl = useRef<string | null>(null);
  const flushLink = useRef(() => undefined);
  flushLink.current = () => {
    const url = pendingUrl.current;
    if (!url || !linkHandler.current.ready) {
      return;
    }
    const kind = describeIncomingLink(url);
    if (kind === 'email') {
      pendingUrl.current = null;
      linkHandler.current.finishEmail(url).catch(() => undefined);
      return;
    }
    if (kind === 'confirm-invite' && navigationRef.isReady()) {
      pendingUrl.current = null;
      navigationRef.navigate('JoinConfirm', { url });
    }
  };
  const theme = {
    ...DefaultTheme,
    colors: {
      ...DefaultTheme.colors,
      background: gifteez.colors.background,
      card: gifteez.colors.surface,
      text: gifteez.colors.text,
      border: gifteez.colors.border,
      primary: gifteez.colors.accent,
    },
  };
  useEffect(() => {
    const remember = (url: string | null | undefined) => {
      if (!url || describeIncomingLink(url) === 'ignore') {
        return;
      }
      pendingUrl.current = url;
      flushLink.current();
    };
    Linking.getInitialURL().then(remember).catch(() => undefined);
    const subscription = Linking.addEventListener('url', event => remember(event.url));
    return () => subscription.remove();
  }, []);
  useEffect(() => {
    flushLink.current();
  }, [gifteez.ready]);
  if (!gifteez.ready) {
    return (
      <Screen centered>
        <Title>{t('appName')}</Title>
        <Body>{t('common.loading')}</Body>
      </Screen>
    );
  }
  if (gifteez.startupFailure) {
    return (
      <StartupScreen
        kind={gifteez.startupFailure}
        detail={gifteez.startupDetail ?? ''}
        onRetry={gifteez.retryStartup}
      />
    );
  }
  return (
    <View style={{ flex: 1 }}>
      <NavigationContainer ref={navigationRef} theme={theme} onReady={() => flushLink.current()}>
        <Stack.Navigator screenOptions={{ headerShadowVisible: false, headerTintColor: gifteez.colors.text, contentStyle: { backgroundColor: gifteez.colors.background } }}>
          {gifteez.snapshot.profile.onboarded ? (
            <>
              <Stack.Screen name="People" component={PeopleScreen} options={{ title: t('people.title') }} />
              <Stack.Screen name="Person" component={PersonScreen} options={{ title: t('person.ideas') }} />
              <Stack.Screen name="SamePerson" component={MergeScreen} options={{ title: t('merge.title') }} />
              <Stack.Screen name="AddPerson" component={AddPersonScreen} options={{ title: t('person.addTitle') }} />
              <Stack.Screen name="Fairness" component={FairnessScreen} options={{ title: t('fairness.title') }} />
              <Stack.Screen name="Group" component={GroupScreen} options={{ title: t('groupScreen.title') }} />
              <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: t('settings.title') }} />
              <Stack.Screen name="Join" component={JoinScreen} options={{ title: t('join.title') }} />
              <Stack.Screen name="JoinConfirm" component={JoinConfirmScreen} options={{ title: t('join.title') }} />
            </>
          ) : (
            <>
              <Stack.Screen name="FirstOpen" component={FirstOpenScreen} options={{ headerShown: false }} />
              <Stack.Screen name="Join" component={JoinScreen} options={{ title: t('join.title') }} />
              <Stack.Screen name="JoinConfirm" component={JoinConfirmScreen} options={{ title: t('join.title') }} />
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>
      {gifteez.notice ? <Notice text={gifteez.notice} onClose={gifteez.clearNotice} /> : null}
      {gifteez.error ? <Notice text={gifteez.error} tone="danger" onClose={gifteez.clearError} /> : null}
      {gifteez.recoveryCode ? (
        <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}>
          <Screen>
            <Title>{t('groupCreate.recoveryTitle')}</Title>
            <Body>{t('groupCreate.recoveryBody')}</Body>
            <Title>{gifteez.recoveryCode}</Title>
            <Body>{t('groupCreate.showLater')}</Body>
            <Button label={t('groupCreate.savedCode')} onPress={gifteez.acknowledgeRecovery} />
            <Button label={t('groupCreate.later')} tone="secondary" onPress={gifteez.acknowledgeRecovery} />
          </Screen>
        </View>
      ) : null}
    </View>
  );
}
