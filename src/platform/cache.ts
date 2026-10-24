import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_KEY = 'gifteez.snapshot.v1';
const PREVIOUS_KEY = 'gifteez.snapshot.prev.v1';

export async function readCacheBlob(): Promise<string | null> {
  return AsyncStorage.getItem(CACHE_KEY);
}

export async function readPreviousBlob(): Promise<string | null> {
  return AsyncStorage.getItem(PREVIOUS_KEY);
}

/** Keep the blob we are about to replace. A later write does not erase this copy until the next save. */
export async function keepPreviousBlob(current: string | null, next: string): Promise<void> {
  if (!current || current === next) {
    return;
  }
  await AsyncStorage.setItem(PREVIOUS_KEY, current);
}

export async function writeCacheBlob(value: string): Promise<void> {
  await AsyncStorage.setItem(CACHE_KEY, value);
}
