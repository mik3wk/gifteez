import { t } from '../i18n';

export type SummaryAction = 'add' | 'find' | 'log' | 'logged';

const SUMMARY_LABEL: Record<SummaryAction, string> = {
  add: 'person.addOccasion',
  find: 'people.findGift',
  log: 'person.purchase',
  logged: 'person.logged',
};

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
  if (input.savedIdea) {
    return 'log';
  }
  return 'find';
}

/** The words for `summaryPrimary`, shared by the person summary and the People hero. */
export function summaryPrimaryLabel(input: Parameters<typeof summaryPrimary>[0]): string | null {
  const action = summaryPrimary(input);
  return action ? t(SUMMARY_LABEL[action]) : null;
}

/** Occasions lead when the next date is a week away or closer. */
export function initialPersonSection(daysAway: number | null): 'ideas' | 'occasions' {
  return daysAway != null && daysAway <= 7 ? 'occasions' : 'ideas';
}
