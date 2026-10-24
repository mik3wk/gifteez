import { chrome, sticker } from '../theme/tokens';

export const MONOGRAM_SWATCHES = [
  { fill: sticker.light.pink, ink: chrome.white },
  { fill: sticker.light.teal, ink: chrome.white },
  { fill: sticker.light.sunshine, ink: chrome.white },
  { fill: sticker.light.lilac, ink: chrome.white },
  { fill: sticker.light.plum, ink: chrome.white },
] as const;

export function monogramIndex(id: string): number {
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) {
    hash = (Math.imul(hash, 31) + id.charCodeAt(index)) >>> 0;
  }
  return hash % MONOGRAM_SWATCHES.length;
}

/** One letter from the signed-in first name. Empty when that name is unset. */
export function householdCrestLetter(givenName: string | undefined): string {
  const first = givenName?.trim().split(/\s+/)[0] ?? '';
  return first.slice(0, 1).toUpperCase();
}

export function monogramLetters(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return '';
  }
  if (parts.length === 1) {
    return parts[0].slice(0, 1).toUpperCase();
  }
  return `${parts[0].slice(0, 1)}${parts[parts.length - 1].slice(0, 1)}`.toUpperCase();
}
