import * as Keychain from 'react-native-keychain';

const SERVICE = 'gifteez';

export async function saveSecret(account: string, secret: string): Promise<void> {
  const saved = await Keychain.setGenericPassword(account, secret, {
    service: `${SERVICE}.${account}`,
  });
  if (!saved) {
    throw new Error(`Could not save ${account} on this device.`);
  }
}

export async function loadSecret(account: string): Promise<string | null> {
  const result = await Keychain.getGenericPassword({ service: `${SERVICE}.${account}` });
  if (!result) {
    return null;
  }
  return result.password;
}

export async function deleteSecret(account: string): Promise<void> {
  await Keychain.resetGenericPassword({ service: `${SERVICE}.${account}` });
}
