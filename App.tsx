import React from 'react';
import { Dimensions, StatusBar, StyleSheet, useColorScheme, View } from 'react-native';
import { initialWindowMetrics, SafeAreaProvider } from 'react-native-safe-area-context';
import { getEnv, type AppEnv } from './src/config/env';
import { DevConfig } from './src/screens/DevConfig';
import { sticker } from './src/theme/tokens';

/**
 * SafeAreaProvider renders nothing until it has insets. Without a synchronous
 * value, the first frames are only the launch background. Native constants
 * cover Debug and Release; the window size is the fallback when they are absent.
 */
const launchMetrics = initialWindowMetrics ?? {
  frame: {
    x: 0,
    y: 0,
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height,
  },
  insets: { top: 0, right: 0, bottom: 0, left: 0 },
};

function Configured({ env }: { env: AppEnv }) {
  const Ready = require('./src/app/ReadyApp').ReadyApp as (props: { env: AppEnv }) => React.JSX.Element;
  return <Ready env={env} />;
}

function App() {
  const env = getEnv();
  const scheme = useColorScheme();
  const background = scheme === 'dark' ? sticker.dark.background : sticker.light.background;
  return (
    <SafeAreaProvider initialMetrics={launchMetrics} style={[styles.fill, { backgroundColor: background }]}>
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
