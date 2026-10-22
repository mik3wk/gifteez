import { getUniqueId } from 'react-native-device-info';

export async function deviceId(): Promise<string> {
  const id = await getUniqueId();
  return id || 'unknown-device';
}
