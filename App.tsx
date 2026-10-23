import React from 'react';
import { StatusBar, useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { getEnv, type AppEnv } from './src/config/env';
import { DevConfig } from './src/screens/DevConfig';

function Configured({ env }: { env: AppEnv }) {
  const Ready = require('./src/app/ReadyApp').ReadyApp as (props: { env: AppEnv }) => React.JSX.Element;
  return <Ready env={env} />;
}

function App() {
  const env = getEnv();
  const scheme = useColorScheme();
  return (
    <SafeAreaProvider>
      <StatusBar barStyle={scheme === 'dark' ? 'light-content' : 'dark-content'} />
      {env.firebaseReady ? <Configured env={env} /> : <DevConfig env={env} />}
    </SafeAreaProvider>
  );
}

export default App;
