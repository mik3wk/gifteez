import { isEvenSpend } from './circles';
import { yearSpentCents } from './logic';
import type { AppSnapshot, Person } from './types';

export type KeptPerson = {
  personId: string;
  name: string;
  yearSpentCents: number;
  budgetCents: number | null;
  behindCents: number;
};

export type KeptEvenView = {
  /** Fewer than two marked people is not a comparison. */
  status: 'need-more' | 'even' | 'behind';
  marked: KeptPerson[];
  /** Marked people outside the tolerance, largest gap first. */
  behind: KeptPerson[];
  /** Everyone not marked. They are never described as behind. */
  others: KeptPerson[];
};

export type KeptEvenHome =
  | { kind: 'prompt' }
  | { kind: 'even' }
  | { kind: 'gap'; name: string; behindCents: number };

function row(person: Person, gifts: AppSnapshot['gifts'], year: number, top: number): KeptPerson {
  const spent = yearSpentCents(person.id, gifts, year);
  return {
    personId: person.id,
    name: person.name,
    yearSpentCents: spent,
    budgetCents: person.budgetCents,
    behindCents: Math.max(0, top - spent),
  };
}

/** This year's keep-even set. Missing or false `keepEven` means the person is not compared. */
export function keptEvenView(snapshot: AppSnapshot, year: number): KeptEvenView {
  const people = snapshot.people.filter(person => !person.deleted);
  const markedPeople = people.filter(person => person.keepEven === true);
  const otherPeople = people.filter(person => person.keepEven !== true);
  const others = otherPeople
    .map(person => row(person, snapshot.gifts, year, 0))
    .sort((a, b) => a.name.localeCompare(b.name));
  if (markedPeople.length < 2) {
    return {
      status: 'need-more',
      marked: markedPeople.map(person => row(person, snapshot.gifts, year, 0)),
      behind: [],
      others,
    };
  }
  const top = Math.max(...markedPeople.map(person => yearSpentCents(person.id, snapshot.gifts, year)));
  const marked = markedPeople
    .map(person => row(person, snapshot.gifts, year, top))
    .sort((a, b) => a.name.localeCompare(b.name));
  const behind = marked
    .filter(person => !isEvenSpend(person.yearSpentCents, top))
    .sort((a, b) => b.behindCents - a.behindCents || a.name.localeCompare(b.name));
  return {
    status: behind.length === 0 ? 'even' : 'behind',
    marked,
    behind,
    others,
  };
}

/** Home shows one status line: a prompt, Even, or the single largest gap. */
export function keptEvenHome(view: KeptEvenView): KeptEvenHome {
  if (view.status !== 'behind') {
    return view.status === 'even' ? { kind: 'even' } : { kind: 'prompt' };
  }
  const gap = view.behind[0];
  if (!gap) {
    return { kind: 'even' };
  }
  return { kind: 'gap', name: gap.name, behindCents: gap.behindCents };
}
