import { isRealMonthDay, type ImportedPerson } from './logic';

export type ContactBirthday = {
  month?: number | null;
  day?: number | null;
  year?: number | null;
};

/**
 * Birthday month from react-native-contacts.
 * iOS stores NSDateComponents.month unchanged. That value is 1 for January.
 * The comment in RCTContacts.mm about subtracting 1 does not match the code.
 * Android parses "MM-dd" or "yyyy-MM-dd" and stores that calendar month, also 1–12.
 * A month or day that cannot be a birthday is omitted.
 */
export function contactMonthDay(
  platform: string,
  birthday: ContactBirthday | null | undefined,
): { month: number; day: number } | null {
  if (birthday?.month == null || birthday.day == null) {
    return null;
  }
  // iOS keeps NSDateComponents.month, which is already 1-based.
  // Android keeps the MM it parsed from the contact date, also 1-based.
  const month = platform === 'android' ? birthday.month : birthday.month;
  if (!isRealMonthDay(month, birthday.day)) {
    return null;
  }
  return { month, day: birthday.day };
}

type ExistingPerson = { id: string; name: string; deleted?: boolean };
type ExistingOccasion = { personId: string; type: string; month: number; day: number; deleted?: boolean };

export type PlannedImport =
  | { kind: 'create'; name: string; budgetCents: number | null; tags: string[]; month?: number; day?: number }
  | { kind: 'occasion'; personId: string; month: number; day: number };

/**
 * One person per name. A birthday already stored for that person is not added again,
 * including when the same date arrived earlier from the calendar.
 */
export function planImported(
  rows: Array<{ name: string; budgetCents: number | null; tags: string[]; month?: number; day?: number }>,
  existing: { people: ExistingPerson[]; occasions: ExistingOccasion[] },
): PlannedImport[] {
  const byName = new Map<string, string>();
  existing.people.forEach(person => {
    if (person.deleted) {
      return;
    }
    const key = person.name.trim().toLowerCase();
    if (key && !byName.has(key)) {
      byName.set(key, person.id);
    }
  });
  const birthdays = new Set(
    existing.occasions
      .filter(occasion => !occasion.deleted && occasion.type === 'birthday')
      .map(occasion => `${occasion.personId}|${occasion.month}|${occasion.day}`),
  );
  const planned: PlannedImport[] = [];
  rows.forEach(row => {
    const name = row.name.trim();
    const key = name.toLowerCase();
    if (!key) {
      return;
    }
    const dated = row.month != null && row.day != null && isRealMonthDay(row.month, row.day)
      ? { month: row.month, day: row.day }
      : null;
    const known = byName.get(key);
    if (known) {
      if (!dated || birthdays.has(`${known}|${dated.month}|${dated.day}`)) {
        return;
      }
      birthdays.add(`${known}|${dated.month}|${dated.day}`);
      planned.push({ kind: 'occasion', personId: known, month: dated.month, day: dated.day });
      return;
    }
    const token = `new:${key}`;
    byName.set(key, token);
    if (dated) {
      birthdays.add(`${token}|${dated.month}|${dated.day}`);
    }
    planned.push({
      kind: 'create',
      name,
      budgetCents: row.budgetCents,
      tags: row.tags,
      ...(dated ?? {}),
    });
  });
  return planned;
}

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
