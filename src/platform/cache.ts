import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_KEY = 'gifteez.snapshot.v1';

export async function readCacheBlob(): Promise<string | null> {
  return AsyncStorage.getItem(CACHE_KEY);
}

export async function writeCacheBlob(value: string): Promise<void> {
  await AsyncStorage.setItem(CACHE_KEY, value);
}
