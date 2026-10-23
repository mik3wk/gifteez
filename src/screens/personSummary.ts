export type SummaryAction = 'add' | 'find' | 'claim' | 'log' | 'logged';

export function summaryPrimary(input: {
  hidden: boolean;
  locked: boolean;
  hasOccasion: boolean;
  purchased: boolean;
  claimedByMe: boolean;
  claimedByOther: boolean;
  savedIdea: boolean;
}): SummaryAction | null {
  if (input.hidden || input.locked) {
    return null;
  }
  if (!input.hasOccasion) {
    return 'add';
  }
  if (input.purchased) {
    return 'logged';
  }
  if (input.claimedByMe) {
    return 'log';
  }
  if (input.claimedByOther) {
    return null;
  }
  if (input.savedIdea) {
    return 'claim';
  }
  return 'find';
}

/** Occasions lead when the next date is a week away or closer. */
export function initialPersonSection(daysAway: number | null): 'ideas' | 'occasions' {
  return daysAway != null && daysAway <= 7 ? 'occasions' : 'ideas';
}
