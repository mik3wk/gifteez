import { gcm } from '@noble/ciphers/aes.js';
import { randomBytes, utf8ToBytes, bytesToUtf8 } from '@noble/ciphers/utils.js';
import { hkdf } from '@noble/hashes/hkdf.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { utf8ToBytes as hashUtf8 } from '@noble/hashes/utils.js';

const NONCE_BYTES = 12;

export function randomId(): string {
  return base64UrlEncode(randomBytes(16));
}

export function randomKey(): Uint8Array {
  return randomBytes(32);
}

export function sha256Hex(value: string): string {
  const digest = sha256(hashUtf8(value));
  return Array.from(digest)
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
}

export function hashToUint(value: string): number {
  const digest = sha256(hashUtf8(value));
  return (
    ((digest[0] << 24) | (digest[1] << 16) | (digest[2] << 8) | digest[3]) >>>
    0
  );
}

export function sealString(plaintext: string, key: Uint8Array): string {
  const nonce = randomBytes(NONCE_BYTES);
  const cipher = gcm(key, nonce);
  const encrypted = cipher.encrypt(utf8ToBytes(plaintext));
  return base64UrlEncode(concat(nonce, encrypted));
}

export function openString(payload: string, key: Uint8Array): string {
  const bytes = base64UrlDecode(payload);
  if (bytes.length < NONCE_BYTES + 16) {
    throw new Error('Ciphertext is too short.');
  }
  const nonce = bytes.slice(0, NONCE_BYTES);
  const encrypted = bytes.slice(NONCE_BYTES);
  const cipher = gcm(key, nonce);
  return bytesToUtf8(cipher.decrypt(encrypted));
}

export function sealJson(value: unknown, key: Uint8Array): string {
  return sealString(JSON.stringify(value), key);
}

export function openJson<T>(payload: string, key: Uint8Array): T {
  return JSON.parse(openString(payload, key)) as T;
}

/** Open with the source list key and seal with the destination key. The source key is not copied into the new payload. */
export function reencryptJson(payload: string, fromKey: Uint8Array, toKey: Uint8Array): string {
  return sealJson(openJson(payload, fromKey), toKey);
}

export function keyToString(key: Uint8Array): string {
  return base64UrlEncode(key);
}

export function keyFromString(value: string): Uint8Array {
  const key = base64UrlDecode(value);
  if (key.length !== 32) {
    throw new Error('Group key must be 32 bytes.');
  }
  return key;
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function base64UrlEncode(bytes: Uint8Array): string {
  let output = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const c = i + 2 < bytes.length ? bytes[i + 2] : 0;
    output += B64[a >> 2];
    output += B64[((a & 3) << 4) | (b >> 4)];
    output += i + 1 < bytes.length ? B64[((b & 15) << 2) | (c >> 6)] : '=';
    output += i + 2 < bytes.length ? B64[c & 63] : '=';
  }
  return output.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function base64UrlDecode(value: string): Uint8Array {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/');
  const pad = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4));
  const input = padded + pad;
  const bytes: number[] = [];
  for (let i = 0; i < input.length; i += 4) {
    const a = B64.indexOf(input[i]);
    const b = B64.indexOf(input[i + 1]);
    const c = B64.indexOf(input[i + 2]);
    const d = B64.indexOf(input[i + 3]);
    bytes.push((a << 2) | (b >> 4));
    if (input[i + 2] !== '=') {
      bytes.push(((b & 15) << 4) | (c >> 2));
    }
    if (input[i + 3] !== '=') {
      bytes.push(((c & 3) << 6) | d);
    }
  }
  return Uint8Array.from(bytes);
}

export function buildInviteUrl(input: {
  domain: string;
  groupId: string;
  inviteId: string;
  groupKey: string;
}): string {
  const domain = input.domain.replace(/^https?:\/\//, '').replace(/\/$/, '');
  return `https://${domain}/join/${encodeURIComponent(input.groupId)}?i=${encodeURIComponent(input.inviteId)}#k=${input.groupKey}`;
}

export function buildAppInviteUrl(input: {
  groupId: string;
  inviteId: string;
  groupKey: string;
}): string {
  return `gifteez://join/${encodeURIComponent(input.groupId)}?i=${encodeURIComponent(input.inviteId)}#k=${input.groupKey}`;
}

export type ParsedLink =
  | {
      kind: 'invite';
      groupId: string;
      inviteId: string;
      groupKey: string;
    }
  | { kind: 'email'; url: string };

export function parseLink(raw: string): ParsedLink | null {
  const text = raw.trim();
  if (!text) {
    return null;
  }
  if (/oobCode=|mode=signIn|\/__\/auth\//.test(text)) {
    return { kind: 'email', url: text };
  }
  const hashIndex = text.indexOf('#');
  const fragment = hashIndex >= 0 ? text.slice(hashIndex + 1) : '';
  let groupKey = '';
  if (fragment.startsWith('k=')) {
    groupKey = decodeURIComponent(fragment.slice(2));
  } else if (fragment) {
    groupKey = decodeURIComponent(fragment);
  }
  let url: URL;
  try {
    url = new URL(text.replace(/^gifteez:\/\//, 'https://gifteez.local/'));
  } catch {
    return null;
  }
  const parts = url.pathname.split('/').filter(Boolean);
  const joinIndex = parts.indexOf('join');
  const groupId = joinIndex >= 0 ? decodeURIComponent(parts[joinIndex + 1] ?? '') : '';
  const inviteId = url.searchParams.get('i') ?? '';
  if (!groupId || !inviteId || !groupKey) {
    return null;
  }
  return { kind: 'invite', groupId, inviteId, groupKey };
}

const RECOVERY_WORDS = [
  'acorn', 'amber', 'apple', 'apron', 'arrow', 'aspen', 'attic', 'badge',
  'baker', 'basil', 'beach', 'berry', 'birch', 'bloom', 'board', 'boots',
  'bread', 'brick', 'brook', 'brush', 'cabin', 'camel', 'candy', 'canoe',
  'cedar', 'charm', 'cherry', 'cider', 'cliff', 'cloud', 'clover', 'coast',
  'cocoa', 'comet', 'coral', 'crate', 'creek', 'crisp', 'daisy', 'dance',
  'delta', 'denim', 'diary', 'dune', 'eagle', 'ember', 'fable', 'fairy',
  'falcon', 'feast', 'fern', 'field', 'finch', 'flame', 'flint', 'flora',
  'flute', 'foggy', 'forest', 'frost', 'garden', 'ginger', 'glade', 'glass',
  'gleam', 'goose', 'grain', 'grape', 'grove', 'harbor', 'hazel', 'honey',
  'horizon', 'icicle', 'island', 'ivory', 'ivy', 'jasmine', 'jelly', 'jewel',
  'journey', 'kayak', 'kettle', 'kindle', 'koala', 'ladder', 'lantern', 'lark',
  'lemon', 'lilac', 'linen', 'lotus', 'lunar', 'maple', 'marble', 'meadow',
  'melon', 'meteor', 'mint', 'mirror', 'misty', 'mocha', 'moon', 'moss',
  'muffin', 'nectar', 'needle', 'nest', 'north', 'novel', 'nutmeg', 'oasis',
  'olive', 'onyx', 'orchid', 'otter', 'paddle', 'panda', 'pantry', 'peach',
  'pebble', 'petal', 'picnic', 'pine', 'pixel', 'plum', 'pocket', 'pond',
  'poppy', 'porch', 'prairie', 'prism', 'pudding', 'pumpkin', 'quartz', 'quilt',
  'rabbit', 'radar', 'rain', 'ranch', 'raven', 'ribbon', 'ridge', 'river',
  'robin', 'rocket', 'rooster', 'rose', 'ruby', 'saffron', 'sail', 'sandal',
  'sapphire', 'scarf', 'shadow', 'shore', 'silk', 'silver', 'sky', 'slate',
  'sleigh', 'snow', 'solar', 'spark', 'spice', 'sprig', 'sprout', 'star',
  'stone', 'storm', 'story', 'straw', 'stream', 'sugar', 'summit', 'sun',
  'swan', 'table', 'tango', 'teapot', 'thicket', 'thistle', 'tide', 'tiger',
  'timber', 'toast', 'topaz', 'trail', 'tulip', 'turtle', 'twig', 'umbrella',
  'valley', 'velvet', 'violet', 'voyage', 'walnut', 'wander', 'willow', 'wind',
  'window', 'winter', 'wisp', 'wonder', 'wool', 'yard', 'yellow', 'yonder',
  'zephyr', 'zinc', 'zodiac', 'ambergris', 'anchor', 'apron', 'arcade',
];

export function recoveryWordList(): readonly string[] {
  return RECOVERY_WORDS;
}

export function generateRecoveryCode(): string {
  const words = uniqueWords(RECOVERY_WORDS);
  const bytes = randomBytes(10);
  const chosen: string[] = [];
  for (let i = 0; i < bytes.length; i += 1) {
    chosen.push(words[bytes[i] % words.length]);
  }
  return chosen.join(' ');
}

export type WrappedKey = {
  salt: string;
  nonce: string;
  wrapped: string;
};

export function wrapKey(groupKey: Uint8Array, recoveryCode: string): WrappedKey {
  const salt = randomBytes(16);
  const nonce = randomBytes(NONCE_BYTES);
  const wrapping = deriveRecoveryKey(recoveryCode, salt);
  const cipher = gcm(wrapping, nonce);
  const wrapped = cipher.encrypt(groupKey);
  return {
    salt: base64UrlEncode(salt),
    nonce: base64UrlEncode(nonce),
    wrapped: base64UrlEncode(wrapped),
  };
}

export function unwrapKey(wrappedKey: WrappedKey, recoveryCode: string): Uint8Array {
  const salt = base64UrlDecode(wrappedKey.salt);
  const nonce = base64UrlDecode(wrappedKey.nonce);
  const wrapped = base64UrlDecode(wrappedKey.wrapped);
  const wrapping = deriveRecoveryKey(recoveryCode, salt);
  const cipher = gcm(wrapping, nonce);
  const key = cipher.decrypt(wrapped);
  if (key.length !== 32) {
    throw new Error('Recovered key has the wrong length.');
  }
  return key;
}

function deriveRecoveryKey(recoveryCode: string, salt: Uint8Array): Uint8Array {
  const normalized = recoveryCode.trim().toLowerCase().replace(/\s+/g, ' ');
  return hkdf(sha256, hashUtf8(normalized), salt, hashUtf8('gifteez-recovery'), 32);
}

function uniqueWords(words: string[]): string[] {
  return [...new Set(words)];
}

function concat(left: Uint8Array, right: Uint8Array): Uint8Array {
  const out = new Uint8Array(left.length + right.length);
  out.set(left, 0);
  out.set(right, left.length);
  return out;
}
