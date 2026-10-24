import AsyncStorage from '@react-native-async-storage/async-storage';

import type { SnapshotSlots } from '../domain/snapshotLoad';

const CACHE_KEY = 'gifteez.snapshot.v1';
const PREV_KEY = 'gifteez.snapshot.prev.v1';
const PREV2_KEY = 'gifteez.snapshot.prev2.v1';
const PREV3_KEY = 'gifteez.snapshot.prev3.v1';
const SLOT_KEYS = [CACHE_KEY, PREV_KEY, PREV2_KEY, PREV3_KEY] as const;

export async function readCacheBlob(): Promise<string | null> {
  return AsyncStorage.getItem(CACHE_KEY);
}

export async function readPreviousBlob(): Promise<string | null> {
  return AsyncStorage.getItem(PREV_KEY);
}

export async function readSnapshotSlots(): Promise<SnapshotSlots> {
  const rows = await AsyncStorage.getMany([...SLOT_KEYS]);
  return {
    current: rows[CACHE_KEY] ?? null,
    prev: rows[PREV_KEY] ?? null,
    prev2: rows[PREV2_KEY] ?? null,
    prev3: rows[PREV3_KEY] ?? null,
  };
}

/** Write the current blob and up to three older generations. Null slots are removed. */
export async function writeSnapshotSlots(slots: SnapshotSlots): Promise<void> {
  const writes: [string, string][] = [];
  const removes: string[] = [];
  const pairs: Array<[string, string | null]> = [
    [CACHE_KEY, slots.current],
    [PREV_KEY, slots.prev],
    [PREV2_KEY, slots.prev2],
    [PREV3_KEY, slots.prev3],
  ];
  pairs.forEach(([key, stored]) => {
    if (stored) {
      writes.push([key, stored]);
    } else {
      removes.push(key);
    }
  });
  if (writes.length > 0) {
    await AsyncStorage.setMany(Object.fromEntries(writes));
  }
  if (removes.length > 0) {
    await AsyncStorage.removeMany(removes);
  }
}
