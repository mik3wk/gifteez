import React, { useEffect, useRef, useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
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
import { listenForReminderOpens } from '../platform/reminders';
import { type as appType } from '../theme/tokens';
import { ConfettiBurst } from '../ui/motion';
import { Body, BrandedLoading, Button, ConfirmHost, Notice, OfflineBanner, Screen, Title } from '../ui/ui';
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
  const [holdBrand, setHoldBrand] = useState(true);
  useEffect(() => {
    const timer = setTimeout(() => setHoldBrand(false), 900);
    return () => clearTimeout(timer);
  }, []);
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
  useEffect(() => listenForReminderOpens(personId => {
    if (navigationRef.isReady()) {
      navigationRef.navigate('Person', { personId });
    }
  }), []);
  if (!gifteez.ready || holdBrand) {
    return (
      <Screen centered>
        <BrandedLoading />
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
    <View style={styles.fill}>
      <NavigationContainer
        ref={navigationRef}
        theme={theme}
        onReady={() => flushLink.current()}
        onStateChange={() => gifteez.onNavigate()}>
        <Stack.Navigator screenOptions={{
          headerShadowVisible: false,
          headerStyle: { backgroundColor: gifteez.colors.background },
          headerTintColor: gifteez.colors.text,
          headerTitleStyle: {
            fontFamily: appType.heading.fontFamily,
            fontWeight: appType.heading.fontWeight,
            color: gifteez.colors.text,
          },
          headerTitleAlign: 'center',
          headerBackButtonDisplayMode: 'minimal',
          contentStyle: { backgroundColor: gifteez.colors.background },
        }}>
          {gifteez.snapshot.profile.onboarded ? (
            <>
              <Stack.Screen name="People" component={PeopleScreen} options={{ headerShown: false }} />
              <Stack.Screen name="Person" component={PersonScreen} options={{ title: t('person.ideas') }} />
              <Stack.Screen name="SamePerson" component={MergeScreen} options={{ title: t('merge.title') }} />
              <Stack.Screen name="AddPerson" component={AddPersonScreen} options={{ title: t('person.addTitle') }} />
              <Stack.Screen name="Fairness" component={FairnessScreen} options={{ headerShown: false }} />
              <Stack.Screen name="Group" component={GroupScreen} options={{ headerShown: false }} />
              <Stack.Screen name="Settings" component={SettingsScreen} options={{ headerShown: false }} />
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
      {gifteez.offline ? <OfflineBanner text={t('sync.offlineBanner')} /> : null}
      {gifteez.error ? (
        <Notice text={gifteez.error} tone="danger" onClose={gifteez.clearError} />
      ) : gifteez.notice ? (
        <Notice
          text={gifteez.notice}
          art={gifteez.noticeArt ?? undefined}
          onClose={gifteez.clearNotice}
          action={gifteez.canUndo ? t('common.undo') : undefined}
          onAction={gifteez.canUndo ? () => { gifteez.runUndo().catch(() => undefined); } : undefined}
        />
      ) : null}
      {gifteez.confetti > 0 ? (
        <View pointerEvents="none" style={styles.cover}>
          <ConfettiBurst key={gifteez.confetti} />
        </View>
      ) : null}
      <ConfirmHost />
      {gifteez.recoveryCode ? (
        <View style={styles.cover}>
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

const styles = StyleSheet.create({
  fill: { flex: 1 },
  cover: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
});
