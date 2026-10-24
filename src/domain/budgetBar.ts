export type BudgetTone = 'under' | 'near' | 'over';

/** Sage under budget, gold from 90%, rose once spending passes the budget. */
export function budgetTone(spentCents: number, budgetCents: number | null): BudgetTone {
  if (budgetCents == null || budgetCents <= 0) {
    return 'under';
  }
  const ratio = spentCents / budgetCents;
  if (ratio > 1) {
    return 'over';
  }
  if (ratio >= 0.9) {
    return 'near';
  }
  return 'under';
}

export function budgetFraction(spentCents: number, budgetCents: number | null): number {
  if (budgetCents == null || budgetCents <= 0) {
    return 0;
  }
  return Math.max(0, Math.min(1, spentCents / budgetCents));
}
