import React, { useEffect, useRef } from 'react';
import { Linking, View } from 'react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { parseLink } from '../crypto/crypto';
import { t } from '../i18n';
import { AddPersonScreen, PersonScreen } from '../screens/PersonScreen';
import { FirstOpenScreen } from '../screens/FirstOpen';
import { FairnessScreen, GroupScreen, JoinScreen, SettingsScreen } from '../screens/MoreScreens';
import { PeopleScreen } from '../screens/PeopleScreen';
import { GifteezProvider, useGifteez } from '../state/GifteezContext';
import { Body, Button, Screen, Title } from '../ui/ui';
import { Notice } from '../ui/ui';
import type { AppEnv } from '../config/env';
import type { RootStack } from './navigation';

const Stack = createNativeStackNavigator<RootStack>();

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
    const handle = (url: string) => {
      const parsed = parseLink(url);
      if (parsed?.kind === 'invite') {
        linkHandler.current.joinFromLink(url).catch(() => undefined);
      } else if (parsed?.kind === 'email') {
        linkHandler.current.finishEmail(parsed.url).catch(() => undefined);
      }
    };
    Linking.getInitialURL().then(url => {
      if (url) {
        handle(url);
      }
    }).catch(() => undefined);
    const subscription = Linking.addEventListener('url', event => handle(event.url));
    return () => subscription.remove();
  }, []);
  if (!gifteez.ready) {
    return (
      <Screen>
        <Body>{t('common.loading')}</Body>
      </Screen>
    );
  }
  return (
    <View style={{ flex: 1 }}>
      <NavigationContainer theme={theme}>
        <Stack.Navigator screenOptions={{ headerShadowVisible: false, headerTintColor: gifteez.colors.text, contentStyle: { backgroundColor: gifteez.colors.background } }}>
          {gifteez.snapshot.profile.onboarded ? (
            <>
              <Stack.Screen name="People" component={PeopleScreen} options={{ title: t('people.title') }} />
              <Stack.Screen name="Person" component={PersonScreen} options={{ title: t('person.ideas') }} />
              <Stack.Screen name="AddPerson" component={AddPersonScreen} options={{ title: t('person.addTitle') }} />
              <Stack.Screen name="Fairness" component={FairnessScreen} options={{ title: t('fairness.title') }} />
              <Stack.Screen name="Group" component={GroupScreen} options={{ title: t('groupScreen.title') }} />
              <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: t('settings.title') }} />
              <Stack.Screen name="Join" component={JoinScreen} options={{ title: t('join.title') }} />
            </>
          ) : (
            <>
              <Stack.Screen name="FirstOpen" component={FirstOpenScreen} options={{ headerShown: false }} />
              <Stack.Screen name="Join" component={JoinScreen} options={{ title: t('join.title') }} />
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>
      {gifteez.notice ? <Notice text={gifteez.notice} onClose={gifteez.clearNotice} /> : null}
      {gifteez.error ? <Notice text={gifteez.error} onClose={gifteez.clearError} /> : null}
      {gifteez.recoveryCode ? (
        <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}>
          <Screen>
            <Title>{t('groupCreate.recoveryTitle')}</Title>
            <Body>{t('groupCreate.recoveryBody')}</Body>
            <Title>{gifteez.recoveryCode}</Title>
            <Body>{t('groupCreate.showLater')}</Body>
            <Button label={t('groupCreate.savedCode')} onPress={gifteez.acknowledgeRecovery} />
          </Screen>
        </View>
      ) : null}
    </View>
  );
}
