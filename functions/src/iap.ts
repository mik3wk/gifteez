import { createSign, randomBytes } from 'crypto';
import { classifyAppleVerdict, classifyGoogleVerdict, configuredVerdict, type StoreVerdict } from './entitlement';

export function appleTransactionGrants(payload: {
  productId?: string;
  bundleId?: string;
  revocationDate?: number | null;
}, expectedProduct: string, expectedBundle: string): boolean {
  if (!payload.productId || payload.productId !== expectedProduct) {
    return false;
  }
  if (expectedBundle && payload.bundleId && payload.bundleId !== expectedBundle) {
    return false;
  }
  return !payload.revocationDate;
}

export function googlePurchaseGrants(body: { purchaseState?: number }, expectedProduct: string, productId: string): boolean {
  return productId === expectedProduct && body.purchaseState === 0;
}

export function buildEs256Jwt(input: {
  issuerId: string;
  keyId: string;
  privateKey: string;
  bundleId: string;
  now?: number;
}): string {
  const now = input.now ?? Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: 'ES256', kid: input.keyId, typ: 'JWT' }));
  const payload = base64Url(JSON.stringify({
    iss: input.issuerId,
    iat: now,
    exp: now + 300,
    aud: 'appstoreconnect-v1',
    bid: input.bundleId,
    nonce: randomBytes(16).toString('hex'),
  }));
  const data = `${header}.${payload}`;
  const signer = createSign('SHA256');
  signer.update(data);
  signer.end();
  const signature = signer.sign({ key: input.privateKey, dsaEncoding: 'ieee-p1363' });
  return `${data}.${base64Url(signature)}`;
}

export function decodeJwsPayload(jws: string): Record<string, unknown> {
  const parts = jws.split('.');
  if (parts.length < 2) {
    throw new Error('jws');
  }
  return JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as Record<string, unknown>;
}

export async function verifyAppleTransaction(input: {
  transactionId: string;
  privateKey: string;
  keyId: string;
  issuerId: string;
  bundleId: string;
  productId: string;
}): Promise<boolean> {
  const verdict = await verifyAppleVerdict(input);
  return verdict === 'granted';
}

export async function verifyAppleVerdict(input: {
  transactionId: string;
  privateKey: string;
  keyId: string;
  issuerId: string;
  bundleId: string;
  productId: string;
}): Promise<StoreVerdict> {
  if (!input.privateKey || !input.keyId || !input.issuerId) {
    return 'not_configured';
  }
  const token = buildEs256Jwt(input);
  const hosts = ['https://api.storekit.itunes.apple.com', 'https://api.storekit-sandbox.itunes.apple.com'];
  for (const host of hosts) {
    const response = await fetch(`${host}/inApps/v1/transactions/${encodeURIComponent(input.transactionId)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (response.status === 404) {
      continue;
    }
    if (!response.ok) {
      continue;
    }
    const body = (await response.json()) as { signedTransactionInfo?: string };
    if (!body.signedTransactionInfo) {
      continue;
    }
    const payload = decodeJwsPayload(body.signedTransactionInfo);
    const revocationDate = typeof payload.revocationDate === 'number' ? payload.revocationDate : null;
    const grants = appleTransactionGrants({
      productId: String(payload.productId ?? ''),
      bundleId: String(payload.bundleId ?? ''),
      revocationDate,
    }, input.productId, input.bundleId);
    return classifyAppleVerdict({ grants, revocationDate });
  }
  return 'unknown';
}

export async function verifyGooglePurchase(input: {
  packageName: string;
  productId: string;
  purchaseToken: string;
  serviceAccountJson: string;
  expectedProduct: string;
}): Promise<boolean> {
  const verdict = await verifyGoogleVerdict(input);
  return verdict === 'granted';
}

export async function verifyGoogleVerdict(input: {
  packageName: string;
  productId: string;
  purchaseToken: string;
  serviceAccountJson: string;
  expectedProduct: string;
}): Promise<StoreVerdict> {
  if (!input.serviceAccountJson || !input.packageName || !input.purchaseToken) {
    return configuredVerdict(false, 'unknown');
  }
  const account = JSON.parse(input.serviceAccountJson) as { client_email: string; private_key: string };
  const accessToken = await googleAccessToken(account.client_email, account.private_key);
  const url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(input.packageName)}/purchases/products/${encodeURIComponent(input.productId)}/tokens/${encodeURIComponent(input.purchaseToken)}`;
  const response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!response.ok) {
    return 'unknown';
  }
  const body = (await response.json()) as { purchaseState?: number };
  return classifyGoogleVerdict({
    purchaseState: body.purchaseState,
    productMatches: input.productId === input.expectedProduct,
  });
}

async function googleAccessToken(clientEmail: string, privateKey: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = base64Url(JSON.stringify({
    iss: clientEmail,
    scope: 'https://www.googleapis.com/auth/androidpublisher',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }));
  const data = `${header}.${payload}`;
  const signer = createSign('RSA-SHA256');
  signer.update(data);
  signer.end();
  const assertion = `${data}.${base64Url(signer.sign(privateKey))}`;
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });
  if (!response.ok) {
    throw new Error('google_token');
  }
  const body = (await response.json()) as { access_token?: string };
  if (!body.access_token) {
    throw new Error('google_token');
  }
  return body.access_token;
}

function base64Url(value: string | Buffer): string {
  return Buffer.from(value).toString('base64url');
}
