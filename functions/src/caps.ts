export type Usage = {
  freeUsed: number;
  paidMonth: string;
  paidUsed: number;
};

export type Limits = {
  free: number;
  paidPerMonth: number;
};

export function monthKey(date: Date): string {
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${date.getUTCFullYear()}-${month}`;
}

export function emptyUsage(): Usage {
  return { freeUsed: 0, paidMonth: '', paidUsed: 0 };
}

export function canRefresh(input: {
  usage: Usage;
  paid: boolean;
  now: Date;
  limits: Limits;
  refresh: boolean;
  cacheHit: boolean;
}): { ok: boolean; counted: boolean } {
  if (!input.refresh && input.cacheHit) {
    return { ok: true, counted: false };
  }
  if (input.paid) {
    const used = input.usage.paidMonth === monthKey(input.now) ? input.usage.paidUsed : 0;
    if (used >= input.limits.paidPerMonth) {
      return { ok: false, counted: false };
    }
    return { ok: true, counted: true };
  }
  if (input.usage.freeUsed >= input.limits.free) {
    return { ok: false, counted: false };
  }
  return { ok: true, counted: true };
}

export function nextUsage(usage: Usage, paid: boolean, now: Date): Usage {
  if (paid) {
    const month = monthKey(now);
    const sameMonth = usage.paidMonth === month;
    return {
      ...usage,
      paidMonth: month,
      paidUsed: (sameMonth ? usage.paidUsed : 0) + 1,
    };
  }
  return { ...usage, freeUsed: usage.freeUsed + 1 };
}

export function claimSlot(active: number, paid: boolean, action: 'add' | 'remove', limit: number): { ok: boolean; active: number } {
  if (action === 'remove') {
    return { ok: true, active: Math.max(0, active - 1) };
  }
  if (paid || active < limit) {
    return { ok: true, active: active + 1 };
  }
  return { ok: false, active };
}
