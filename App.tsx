import React from 'react';
import { StatusBar, StyleSheet, useColorScheme, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { getEnv, type AppEnv } from './src/config/env';
import { DevConfig } from './src/screens/DevConfig';
import { sticker } from './src/theme/tokens';

function Configured({ env }: { env: AppEnv }) {
  const Ready = require('./src/app/ReadyApp').ReadyApp as (props: { env: AppEnv }) => React.JSX.Element;
  return <Ready env={env} />;
}

function App() {
  const env = getEnv();
  const scheme = useColorScheme();
  const background = scheme === 'dark' ? sticker.dark.background : sticker.light.background;
  return (
    <SafeAreaProvider style={[styles.fill, { backgroundColor: background }]}>
      <StatusBar barStyle={scheme === 'dark' ? 'light-content' : 'dark-content'} />
      <View style={[styles.fill, { backgroundColor: background }]}>
        {env.firebaseReady ? <Configured env={env} /> : <DevConfig env={env} />}
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});

export default App;
