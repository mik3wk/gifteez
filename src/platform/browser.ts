import { AppState, Linking, NativeModules } from 'react-native';
import InAppBrowser from 'react-native-inappbrowser-reborn';

/**
 * Opens a store link in SFSafariViewController or Chrome Custom Tabs.
 * Resolves true when the shopper comes back, so the caller can ask once.
 * Falls back to the system browser when the native module is not linked yet.
 */
export async function openInApp(url: string): Promise<boolean> {
  if (NativeModules.RNInAppBrowser) {
    try {
      if (await InAppBrowser.isAvailable()) {
        await InAppBrowser.open(url, {
          dismissButtonStyle: 'close',
          animated: true,
          modalEnabled: true,
          modalPresentationStyle: 'fullScreen',
          showTitle: true,
          enableUrlBarHiding: true,
          enableDefaultShare: true,
        });
        return true;
      }
    } catch {
      // The in-app browser could not present. The system browser is the backup.
    }
  }
  try {
    await Linking.openURL(url);
  } catch {
    return false;
  }
  return waitForReturn();
}

function waitForReturn(): Promise<boolean> {
  return new Promise(resolve => {
    let left = AppState.currentState !== 'active';
    const sub = AppState.addEventListener('change', state => {
      if (state === 'background' || state === 'inactive') {
        left = true;
        return;
      }
      if (state === 'active' && left) {
        sub.remove();
        resolve(true);
      }
    });
  });
}
