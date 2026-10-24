import type { GiftStatus } from './types';

export type SealState = 'not-started' | 'idea-saved' | 'purchased' | 'claimed' | 'logged' | 'balanced';

export type SealPaint = { fill: string; ink: string; ring: string };

/** Logged sage is a fill. Not-started is an outline only, so the two stay distinct when small. */
export const SEAL_PAINT: Record<'light' | 'dark', Record<SealState, SealPaint>> = {
  light: {
    'not-started': { fill: 'transparent', ink: '#6F6660', ring: '#6F6660' },
    'idea-saved': { fill: '#A93F55', ink: '#FFFFFF', ring: '#A93F55' },
    purchased: { fill: '#B8913A', ink: '#2B2522', ring: '#8A6A22' },
    claimed: { fill: '#5D7290', ink: '#FFFFFF', ring: '#5D7290' },
    logged: { fill: '#4F6F57', ink: '#FFFFFF', ring: '#4F6F57' },
    balanced: { fill: '#4F6F57', ink: '#FFFFFF', ring: '#4F6F57' },
  },
  dark: {
    'not-started': { fill: 'transparent', ink: '#C8BFB6', ring: '#C8BFB6' },
    'idea-saved': { fill: '#E58A9C', ink: '#1C1816', ring: '#E58A9C' },
    purchased: { fill: '#D9B866', ink: '#1C1816', ring: '#D9B866' },
    claimed: { fill: '#A9B9CE', ink: '#1C1816', ring: '#A9B9CE' },
    logged: { fill: '#8FB497', ink: '#1C1816', ring: '#8FB497' },
    balanced: { fill: '#8FB497', ink: '#1C1816', ring: '#8FB497' },
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
  if (input.claimed) {
    return 'claimed';
  }
  if (input.status === 'idea-saved') {
    return 'idea-saved';
  }
  return 'not-started';
}
