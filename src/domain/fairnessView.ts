import type { FairnessRow } from './logic';

export type FairnessBar = FairnessRow & {
  fraction: number;
  behindCents: number;
};

export type FairnessView = {
  scale: number;
  spread: number;
  balanced: boolean;
  spentCents: number;
  budgetCents: number | null;
  bars: FairnessBar[];
};

/** One scale for every person: the larger of this year's spend and the budget. */
export function fairnessView(rows: FairnessRow[]): FairnessView {
  const scale = Math.max(1, ...rows.map(row => Math.max(row.yearSpentCents, row.budgetCents ?? 0)));
  const spent = rows.map(row => row.yearSpentCents);
  const spread = spent.length === 0 ? 0 : Math.max(...spent) - Math.min(...spent);
  const maxSpent = spent.length === 0 ? 0 : Math.max(...spent);
  const spentCents = spent.reduce((sum, value) => sum + value, 0);
  const budgets = rows.map(row => row.budgetCents).filter((value): value is number => value != null);
  return {
    scale,
    spread,
    balanced: rows.length > 0 && spread === 0,
    spentCents,
    budgetCents: budgets.length > 0 ? budgets.reduce((sum, value) => sum + value, 0) : null,
    bars: rows.map(row => ({
      ...row,
      fraction: Math.max(0, row.yearSpentCents) / scale,
      behindCents: Math.max(0, maxSpent - row.yearSpentCents),
    })),
  };
}
