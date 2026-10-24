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

/** "$0 of $150" when a budget is set, including a spent amount of zero. Otherwise just the spent amount. */
export function formatSpentOfBudget(
  spentCents: number,
  budgetCents: number | null,
  money: (cents: number) => string,
): string {
  if (budgetCents == null) {
    return money(spentCents);
  }
  return `${money(spentCents)} of ${money(budgetCents)}`;
}

export function budgetFraction(spentCents: number, budgetCents: number | null): number {
  if (budgetCents == null || budgetCents <= 0) {
    return 0;
  }
  return Math.max(0, Math.min(1, spentCents / budgetCents));
}
