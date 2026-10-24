import type { ImportedPerson } from './logic';

/** Null when the list is unlocked and the free cap does not apply. */
export function freeSlotsLeft(used: number, limit: number, unlocked: boolean): number | null {
  if (unlocked) {
    return null;
  }
  return Math.max(0, limit - used);
}

/**
 * Nothing is written until the person confirms a selection.
 * A selection larger than the free slots opens the paywall and adds no one.
 */
export function contactAddDecision(picked: number, slotsLeft: number | null): 'none' | 'add' | 'paywall' {
  if (picked <= 0) {
    return 'none';
  }
  if (slotsLeft != null && picked > slotsLeft) {
    return 'paywall';
  }
  return 'add';
}

export function withDefaultBudget(
  rows: ImportedPerson[],
  defaultBudgetCents: number | null | undefined,
): ImportedPerson[] {
  const budgetCents = typeof defaultBudgetCents === 'number' ? defaultBudgetCents : null;
  return rows.map(row => ({ ...row, budgetCents }));
}
