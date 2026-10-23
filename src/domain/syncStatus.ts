export type SyncFailure = 'offline' | 'permission' | 'failed';

/** App Check and permission errors are not a lost connection. */
export function classifySyncError(caught: unknown): SyncFailure {
  const code = caught && typeof caught === 'object' && 'code' in caught
    ? String((caught as { code?: string }).code)
    : '';
  const message = caught instanceof Error ? caught.message : String(caught ?? '');
  const blob = `${code} ${message}`.toLowerCase();
  if (
    blob.includes('appcheck')
    || blob.includes('app check')
    || blob.includes('permission')
    || blob.includes('unauthenticated')
  ) {
    return 'permission';
  }
  if (
    blob.includes('unavailable')
    || blob.includes('network')
    || blob.includes('offline')
    || blob.includes('timeout')
    || blob.includes('internet')
    || blob.includes('failed to get')
    || blob.includes('connection')
  ) {
    return 'offline';
  }
  return 'failed';
}
