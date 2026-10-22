import { Platform } from 'react-native';

export type AppEnv = {
  firebaseApiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  iosAppId: string;
  androidAppId: string;
  measurementId: string;
  functionsRegion: string;
  phoneRegions: string[];
  appCheckDebugToken: string;
  inviteDomain: string;
  remoteConfigSkinParam: string;
  remoteConfigMinFetchSeconds: number;
  iapProductId: string;
  iapPriceUsd: number;
  openAiModel: string;
  freeRefreshesPerPerson: number;
  paidRefreshesPerPersonPerMonth: number;
  freeTierMaxPeople: number;
  groupMaxMembers: number;
  bannerAfterDays: number;
  useEmulators: boolean;
  emulatorHost: string;
  bundleId: string;
  firebaseReady: boolean;
  missing: string[];
};

const PLACEHOLDER_PREFIXES = ['your-', 'sk-your-', 'g-xxxx'];

function readNativeConfig(): Record<string, string | undefined> {
  try {
    const loaded = require('react-native-config');
    const config = loaded?.default ?? loaded ?? {};
    return config;
  } catch {
    return {};
  }
}

function text(config: Record<string, string | undefined>, key: string, fallback = ''): string {
  const value = config[key];
  return typeof value === 'string' ? value.trim() : fallback;
}

function numberValue(config: Record<string, string | undefined>, key: string, fallback: number): number {
  const raw = text(config, key);
  if (!raw) {
    return fallback;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function isPlaceholder(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) {
    return true;
  }
  const lower = trimmed.toLowerCase();
  if (PLACEHOLDER_PREFIXES.some(prefix => lower.startsWith(prefix))) {
    return true;
  }
  if (lower.includes('your-project-id') || lower.includes('0000000000000000')) {
    return true;
  }
  if (trimmed === '000000000000' || trimmed === 'G-XXXXXXXXXX') {
    return true;
  }
  return false;
}

export function getEnv(): AppEnv {
  const config = readNativeConfig();
  const iosAppId = text(config, 'FIREBASE_IOS_APP_ID');
  const androidAppId = text(config, 'FIREBASE_ANDROID_APP_ID');
  const appId = Platform.OS === 'android' ? androidAppId : iosAppId;
  const required: Array<[string, string]> = [
    ['FIREBASE_API_KEY', text(config, 'FIREBASE_API_KEY')],
    ['FIREBASE_AUTH_DOMAIN', text(config, 'FIREBASE_AUTH_DOMAIN')],
    ['FIREBASE_PROJECT_ID', text(config, 'FIREBASE_PROJECT_ID')],
    ['FIREBASE_STORAGE_BUCKET', text(config, 'FIREBASE_STORAGE_BUCKET')],
    ['FIREBASE_MESSAGING_SENDER_ID', text(config, 'FIREBASE_MESSAGING_SENDER_ID')],
    [Platform.OS === 'android' ? 'FIREBASE_ANDROID_APP_ID' : 'FIREBASE_IOS_APP_ID', appId],
  ];
  const missing = required.filter(([, value]) => isPlaceholder(value)).map(([key]) => key);
  return {
    firebaseApiKey: text(config, 'FIREBASE_API_KEY'),
    authDomain: text(config, 'FIREBASE_AUTH_DOMAIN'),
    projectId: text(config, 'FIREBASE_PROJECT_ID'),
    storageBucket: text(config, 'FIREBASE_STORAGE_BUCKET'),
    messagingSenderId: text(config, 'FIREBASE_MESSAGING_SENDER_ID'),
    iosAppId,
    androidAppId,
    measurementId: text(config, 'FIREBASE_MEASUREMENT_ID'),
    functionsRegion: text(config, 'FIREBASE_FUNCTIONS_REGION', 'us-central1'),
    phoneRegions: text(config, 'PHONE_AUTH_ALLOWED_REGIONS', 'US')
      .split(',')
      .map(region => region.trim())
      .filter(Boolean),
    appCheckDebugToken: text(config, 'APP_CHECK_DEBUG_TOKEN'),
    inviteDomain: text(config, 'INVITE_LINK_DOMAIN', 'gifteez.app'),
    remoteConfigSkinParam: text(config, 'REMOTE_CONFIG_SKIN_PARAM', 'active_skin'),
    remoteConfigMinFetchSeconds: numberValue(config, 'REMOTE_CONFIG_MIN_FETCH_SECONDS', 3600),
    iapProductId: text(config, 'IAP_UNLOCK_PRODUCT_ID', 'gifteez_unlock'),
    iapPriceUsd: numberValue(config, 'IAP_UNLOCK_PRICE_USD', 9.99),
    openAiModel: text(config, 'OPENAI_MODEL', 'gpt-4o-mini'),
    freeRefreshesPerPerson: numberValue(config, 'AI_FREE_REFRESHES_PER_PERSON', 5),
    paidRefreshesPerPersonPerMonth: numberValue(config, 'AI_PAID_REFRESHES_PER_PERSON_PER_MONTH', 20),
    freeTierMaxPeople: numberValue(config, 'FREE_TIER_MAX_PEOPLE', 5),
    groupMaxMembers: numberValue(config, 'GROUP_MAX_MEMBERS', 5),
    bannerAfterDays: numberValue(config, 'ACCOUNT_BANNER_AFTER_DAYS', 30),
    useEmulators: text(config, 'USE_FIREBASE_EMULATORS', 'false') === 'true',
    emulatorHost: text(config, 'FIREBASE_EMULATOR_HOST', 'localhost'),
    bundleId: text(config, 'APP_BUNDLE_ID', 'com.gifteez'),
    firebaseReady: missing.length === 0,
    missing,
  };
}
