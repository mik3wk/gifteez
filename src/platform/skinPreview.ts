import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SkinId } from '../theme/skins';

const KEY = 'gifteez.skinPreview';

export type SkinPreviewChoice = SkinId | 'auto' | 'remote';

const CHOICES: readonly SkinPreviewChoice[] = ['base', 'fall', 'winter', 'spring', 'summer', 'auto', 'remote'];

function isChoice(value: string | null): value is SkinPreviewChoice {
  return CHOICES.some(choice => choice === value);
}

/** Debug-only. Release builds never read a leftover preview. */
export async function loadSkinPreview(): Promise<SkinPreviewChoice | null> {
  if (!__DEV__) {
    return null;
  }
  try {
    const stored = await AsyncStorage.getItem(KEY);
    return isChoice(stored) ? stored : null;
  } catch {
    return null;
  }
}

/** `remote` clears the override so the next cold start follows Remote Config. */
export async function saveSkinPreview(choice: SkinPreviewChoice): Promise<void> {
  if (!__DEV__) {
    return;
  }
  try {
    if (choice === 'remote') {
      await AsyncStorage.removeItem(KEY);
      return;
    }
    await AsyncStorage.setItem(KEY, choice);
  } catch {
    // The preview still applies until this process ends.
  }
}
