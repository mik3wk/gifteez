import { chrome, sticker } from '../theme/tokens';
import type { GiftStatus } from './types';

export type SealState = 'not-started' | 'idea-saved' | 'purchased' | 'claimed' | 'logged' | 'balanced';

export type SealPaint = { fill: string; ink: string; ring: string };

/** Logged sage is a fill. Not-started is an outline only, so the two stay distinct when small. */
export const SEAL_PAINT: Record<'light' | 'dark', Record<SealState, SealPaint>> = {
  light: {
    'not-started': { fill: 'transparent', ink: sticker.light.muted, ring: sticker.light.muted },
    'idea-saved': { fill: sticker.light.pink, ink: chrome.white, ring: sticker.light.pink },
    purchased: { fill: chrome.goldFill, ink: sticker.light.ink, ring: sticker.light.sunshine },
    claimed: { fill: sticker.light.lilac, ink: chrome.white, ring: sticker.light.lilac },
    logged: { fill: sticker.light.teal, ink: chrome.white, ring: sticker.light.teal },
    balanced: { fill: sticker.light.teal, ink: chrome.white, ring: sticker.light.teal },
  },
  dark: {
    'not-started': { fill: 'transparent', ink: chrome.sealIdleDark, ring: chrome.sealIdleDark },
    'idea-saved': { fill: sticker.dark.pink, ink: chrome.inkOnFill, ring: sticker.dark.pink },
    purchased: { fill: sticker.dark.sunshine, ink: chrome.inkOnFill, ring: sticker.dark.sunshine },
    claimed: { fill: sticker.dark.lilac, ink: chrome.inkOnFill, ring: sticker.dark.lilac },
    logged: { fill: sticker.dark.teal, ink: chrome.inkOnFill, ring: sticker.dark.teal },
    balanced: { fill: sticker.dark.teal, ink: chrome.inkOnFill, ring: sticker.dark.teal },
  },
};

export function personSeal(input: {
  status: GiftStatus | null;
  claimed: boolean;
  logged: boolean;
}): SealState {
  if (input.logged) {
    return 'logged';
  }
  if (input.status === 'purchased') {
    return 'purchased';
  }
  if (input.status === 'idea-saved') {
    return 'idea-saved';
  }
  return 'not-started';
}
