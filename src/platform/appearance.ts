import AsyncStorage from '@react-native-async-storage/async-storage';
import { Appearance } from 'react-native';

export type AppearanceChoice = 'system' | 'light' | 'dark';

const KEY = 'gifteez.appearance';

export function applyAppearance(choice: AppearanceChoice): void {
  Appearance.setColorScheme(choice === 'system' ? 'unspecified' : choice);
}

export async function loadAppearance(): Promise<AppearanceChoice> {
  try {
    const stored = await AsyncStorage.getItem(KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'system') {
      return stored;
    }
  } catch {
    // The list still opens if the preference cannot be read.
  }
  return 'system';
}

export async function saveAppearance(choice: AppearanceChoice): Promise<void> {
  applyAppearance(choice);
  try {
    await AsyncStorage.setItem(KEY, choice);
  } catch {
    // The choice still applies for this session.
  }
}
