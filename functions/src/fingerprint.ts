import { createHash } from 'crypto';

export function fingerprint(pepper: string, deviceId: string): string {
  return createHash('sha256').update(`${pepper}|${deviceId}`, 'utf8').digest('hex');
}
