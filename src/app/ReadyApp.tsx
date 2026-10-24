import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, useColorScheme, View } from 'react-native';
import { NavigationContainer, DefaultTheme, createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { t } from '../i18n';
import { AddPersonScreen, PersonScreen } from '../screens/PersonScreen';
import { FirstOpenScreen } from '../screens/FirstOpen';
import { FairnessScreen, SettingsScreen } from '../screens/MoreScreens';
import { ThemeGalleryScreen } from '../screens/ThemeGallery';
import { HomeScreen } from '../screens/HomeScreen';
import { PeopleScreen } from '../screens/PeopleScreen';
import { DataRecoveryScreen, StartupScreen } from '../screens/StartupScreen';
import { GifteezProvider, useGifteez } from '../state/GifteezContext';
import { listenForReminderOpens } from '../platform/reminders';
import { sticker, type as appType } from '../theme/tokens';
import { ConfettiBurst, useReduceMotion } from '../ui/motion';
import { BrandedLoading, ConfirmHost, Notice, OfflineBanner, UnlockSheet, confirmDestructive } from '../ui/ui';
import type { AppEnv } from '../config/env';
import type { RootStack } from './navigation';

const Stack = createNativeStackNavigator<RootStack>();
const navigationRef = createNavigationContainerRef<RootStack>();
const tabOptions = { headerShown: false, animation: 'none' as const, gestureEnabled: false };

export function ReadyApp({ env }: { env: AppEnv }) {
  return (
    <GifteezProvider env={env}>
      <Navigator />
    </GifteezProvider>
  );
}

function Navigator() {
  const gifteez = useGifteez();
  const scheme = useColorScheme();
  const launchBackground = scheme === 'dark' ? sticker.dark.background : sticker.light.background;
  const reduceMotion = useReduceMotion();
  const [holdBrand, setHoldBrand] = useState(true);
  const [logoMounted, setLogoMounted] = useState(true);
  const logoOpacity = useSharedValue(1);
  const logoStyle = useAnimatedStyle(() => ({ opacity: logoOpacity.value }));
  useEffect(() => {
    const timer = setTimeout(() => setHoldBrand(false), 900);
    return () => clearTimeout(timer);
  }, []);
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
  useEffect(() => listenForReminderOpens(personId => {
    if (navigationRef.isReady()) {
      navigationRef.navigate('Person', { personId });
    }
  }), []);
  const coverBoot = !gifteez.ready || holdBrand;
  const showRecovery = !coverBoot && gifteez.dataRecovery;
  const showFailure = !coverBoot && !showRecovery && Boolean(gifteez.startupFailure);
  const showNav = !coverBoot && !showRecovery && !gifteez.startupFailure;
  useEffect(() => {
    if (coverBoot) {
      return undefined;
    }
    if (!showNav || reduceMotion) {
      setLogoMounted(false);
      return undefined;
    }
    logoOpacity.value = withTiming(0, { duration: 320 });
    const timer = setTimeout(() => setLogoMounted(false), 340);
    return () => clearTimeout(timer);
  }, [coverBoot, logoOpacity, reduceMotion, showNav]);
  return (
    <View style={[styles.fill, { backgroundColor: logoMounted ? launchBackground : gifteez.colors.background }]}>
      {showRecovery ? (
        <DataRecoveryScreen
          stage={gifteez.recoveryStage}
          onRetry={gifteez.retryStartup}
          onRestore={() => { gifteez.pickBackup().catch(() => undefined); }}
          onExport={() => { gifteez.exportRawCache().catch(() => undefined); }}
        />
      ) : null}
      {showFailure ? (
        <StartupScreen
          kind={gifteez.startupFailure ?? 'unknown'}
          detail={gifteez.startupDetail ?? ''}
          onRetry={gifteez.retryStartup}
        />
      ) : null}
      {showNav ? (
      <NavigationContainer
        ref={navigationRef}
        theme={theme}
        onReady={() => undefined}
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
              <Stack.Screen name="Home" component={HomeScreen} options={tabOptions} />
              <Stack.Screen name="People" component={PeopleScreen} options={tabOptions} />
              <Stack.Screen name="Person" component={PersonScreen} options={{ title: t('person.ideas') }} />
              <Stack.Screen name="AddPerson" component={AddPersonScreen} options={{ title: t('person.addTitle') }} />
              <Stack.Screen name="Fairness" component={FairnessScreen} options={tabOptions} />
              <Stack.Screen name="Settings" component={SettingsScreen} options={tabOptions} />
              <Stack.Screen name="ThemeGallery" component={ThemeGalleryScreen} options={{ title: t('settings.gallery') }} />
            </>
          ) : (
            <>
              <Stack.Screen name="FirstOpen" component={FirstOpenScreen} options={{ headerShown: false }} />
              <Stack.Screen name="AddPerson" component={AddPersonScreen} options={{ title: t('person.addTitle') }} />
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>
      ) : null}
      {logoMounted ? (
        <Animated.View
          pointerEvents="none"
          style={[styles.cover, { backgroundColor: launchBackground }, logoStyle]}>
          <BrandedLoading />
        </Animated.View>
      ) : null}
      {showNav && gifteez.offline ? <OfflineBanner text={t('sync.offlineBanner')} /> : null}
      {(showNav || showRecovery) && gifteez.error ? (
        <Notice text={gifteez.error} tone="danger" onClose={gifteez.clearError} />
      ) : showNav && gifteez.notice ? (
        <Notice
          text={gifteez.notice}
          art={gifteez.noticeArt ?? undefined}
          onClose={gifteez.clearNotice}
          action={gifteez.canUndo ? t('common.undo') : undefined}
          onAction={gifteez.canUndo ? () => { gifteez.runUndo().catch(() => undefined); } : undefined}
        />
      ) : null}
      {showNav && gifteez.confetti > 0 ? (
        <View pointerEvents="none" style={styles.cover}>
          <ConfettiBurst key={gifteez.confetti} />
        </View>
      ) : null}
      {showNav || showRecovery ? <ConfirmHost /> : null}
      {showNav ? <UnlockSheet visible={gifteez.paywallOpen} onClose={gifteez.dismissPaywall} /> : null}
      {showNav || showRecovery ? <IncomingRestore /> : null}
    </View>
  );
}

function IncomingRestore() {
  const { incomingBackup, acceptIncomingBackup, clearIncomingBackup } = useGifteez();
  const pending = useRef<string | null>(null);
  useEffect(() => {
    if (!incomingBackup || pending.current === incomingBackup.preview) {
      return;
    }
    pending.current = incomingBackup.preview;
    confirmDestructive(
      t('settings.restoreTitle'),
      incomingBackup.preview,
      t('settings.restoreConfirm'),
      t('settings.restoreConfirmLabel'),
    ).then(ok => {
      pending.current = null;
      if (ok) {
        acceptIncomingBackup().catch(() => undefined);
        return;
      }
      clearIncomingBackup();
    }).catch(() => {
      pending.current = null;
      clearIncomingBackup();
    });
  }, [acceptIncomingBackup, clearIncomingBackup, incomingBackup]);
  return null;
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  cover: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
});
