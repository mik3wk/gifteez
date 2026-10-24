import type { AppSnapshot, Circle, Person } from './types';
import { withCircleBudget } from './circles';

export type BudgetOrigin =
  | { kind: 'circle'; cents: number | null; circleName: string }
  | { kind: 'custom'; cents: number | null; circleName: string }
  | { kind: 'own'; cents: number | null };

function circleOf(person: Person, circles: Circle[]): Circle | undefined {
  if (!person.circleId) {
    return undefined;
  }
  return circles.find(circle => circle.id === person.circleId);
}

function centsOf(value: number | null | undefined): number | null {
  return value ?? null;
}

/** Where a person's budget comes from. A circle amount applies unless this person has their own. */
export function budgetOrigin(person: Person, circles: Circle[]): BudgetOrigin {
  const circle = circleOf(person, circles);
  if (!circle) {
    return { kind: 'own', cents: person.budgetCents };
  }
  if (person.budgetCustom) {
    return { kind: 'custom', cents: person.budgetCents, circleName: circle.name };
  }
  return { kind: 'circle', cents: centsOf(circle.budgetCents), circleName: circle.name };
}

/** "Siblings circle", or the name alone when it already ends with circle. */
export function circleLabel(name: string): string {
  const trimmed = name.trim();
  if (/circle$/i.test(trimmed)) {
    return trimmed;
  }
  return `${trimmed} circle`;
}

/** "from the Siblings circle", or "from Test Circle" when the name already says circle. */
export function circleBudgetFrom(name: string): string {
  const trimmed = name.trim();
  if (/circle$/i.test(trimmed)) {
    return `from ${trimmed}`;
  }
  return `from the ${trimmed} circle`;
}

function withCustom(person: Person, budgetCents: number | null): Person {
  return { ...person, budgetCents, budgetCustom: true };
}

function followingCircle(person: Person, budgetCents: number | null): Person {
  const next = { ...person, budgetCents };
  delete next.budgetCustom;
  return next;
}

/**
 * Amounts that already differ from the circle stay on that person.
 * Amounts that match keep following the circle.
 */
export function migrateBudgetSources(snapshot: AppSnapshot): AppSnapshot {
  const circles = snapshot.circles ?? [];
  let changed = false;
  const people = snapshot.people.map(person => {
    if (person.deleted) {
      return person;
    }
    const circle = circleOf(person, circles);
    if (!circle) {
      return person;
    }
    if (person.budgetCustom) {
      return person;
    }
    if (centsOf(person.budgetCents) === centsOf(circle.budgetCents)) {
      return person;
    }
    changed = true;
    return { ...person, budgetCustom: true };
  });
  return changed ? { ...snapshot, people } : snapshot;
}

/** Circle budget is the amount for each member, unless the change should leave current members as they are. */
export function applyCircleBudget(
  snapshot: AppSnapshot,
  circleId: string,
  budgetCents: number | null,
  mode: 'everyone' | 'new',
): AppSnapshot | null {
  const circle = (snapshot.circles ?? []).find(item => item.id === circleId);
  if (!circle) {
    return null;
  }
  const previous = centsOf(circle.budgetCents);
  const nextCircle = withCircleBudget(snapshot, circleId, budgetCents);
  if (!nextCircle) {
    return null;
  }
  return {
    ...nextCircle,
    people: nextCircle.people.map(person => {
      if (person.deleted || person.circleId !== circleId) {
        return person;
      }
      if (mode === 'everyone') {
        return followingCircle(person, budgetCents);
      }
      const stored = person.budgetCents ?? null;
      const follows = !person.budgetCustom && stored === previous;
      return withCustom(person, follows ? previous : stored);
    }),
  };
}
