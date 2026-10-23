export type HapticKind = 'success' | 'warning' | 'error';

const TYPE = {
  success: 'notificationSuccess',
  warning: 'notificationWarning',
  error: 'notificationError',
} as const;

/** Important moments only. A missing native module, or a test runtime, stays quiet. */
export function haptic(kind: HapticKind): void {
  try {
    const loaded = require('react-native-haptic-feedback') as { default?: { trigger?: (type: string, options: object) => void } };
    const trigger = loaded.default?.trigger;
    if (!trigger) {
      return;
    }
    trigger(TYPE[kind], { enableVibrateFallback: true, ignoreAndroidSystemSettings: false });
  } catch {
    // Pods are not installed yet, or this device has no haptic engine.
  }
}
