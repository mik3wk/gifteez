import { NativeModules } from 'react-native';

/** Drops the native launch cover once the JS loader has painted. A missing module stays quiet. */
export function hideNativeSplash(): void {
  const splash = NativeModules.GifteezSplash as { hide?: () => void } | undefined;
  splash?.hide?.();
}
