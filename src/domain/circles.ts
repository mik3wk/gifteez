import { randomId } from '../crypto/crypto';
import type { AppSnapshot, Circle, Person } from './types';
import { relationshipKey, type RelationshipPresetKey } from './relationship';
import { yearSpentCents } from './logic';

/** Circle created when a backup still has the removed keepEven flag. */
export const KEPT_EVEN_CIRCLE_NAME = 'Kept even';

/** A gap no larger than this still counts as even when 5% of the top spend is smaller. */
export const FAIRNESS_EVEN_FLOOR_CENTS = 1000;

/** Share of the circle's highest spend this year that still counts as even. */
export const FAIRNESS_EVEN_RATIO = 0.05;

/** The larger of $10 and 5% of the circle's highest spend, in cents. */
export function evenGapCents(topCents: number): number {
  const top = Math.max(0, Math.round(topCents));
  return Math.max(FAIRNESS_EVEN_FLOOR_CENTS, Math.round(top * FAIRNESS_EVEN_RATIO));
}

export function isEvenSpend(spentCents: number, topCents: number): boolean {
  return Math.max(0, topCents - spentCents) <= evenGapCents(topCents);
}

export function cleanCircleName(value: string): string | null {
  const trimmed = value.trim().replace(/\s+/g, ' ');
  if (!trimmed || trimmed.length > 40) {
    return null;
  }
  if (!/^[\p{L}\p{N}][\p{L}\p{N}\s.'’-]*$/u.test(trimmed)) {
    return null;
  }
  return trimmed;
}

export type CircleMember = {
  personId: string;
  name: string;
  yearSpentCents: number;
  budgetCents: number | null;
  behindCents: number;
};

export type CircleSection = {
  circleId: string;
  name: string;
  status: 'empty' | 'even' | 'behind';
  members: CircleMember[];
  behind: CircleMember[];
};

export type CircleSuggestion = {
  key: RelationshipPresetKey;
  personIds: string[];
  names: string[];
};

function activeCircles(snapshot: AppSnapshot): Circle[] {
  return snapshot.circles ?? [];
}

function membersOf(snapshot: AppSnapshot, circleId: string): Person[] {
  return snapshot.people.filter(person => !person.deleted && person.circleId === circleId);
}

export function circleSections(snapshot: AppSnapshot, year: number): CircleSection[] {
  return activeCircles(snapshot).map(circle => {
    const people = membersOf(snapshot, circle.id);
    if (people.length === 0) {
      return { circleId: circle.id, name: circle.name, status: 'empty', members: [], behind: [] };
    }
    const spent = people.map(person => yearSpentCents(person.id, snapshot.gifts, year));
    const top = Math.max(...spent);
    const members = people.map(person => {
      const yearSpent = yearSpentCents(person.id, snapshot.gifts, year);
      return {
        personId: person.id,
        name: person.name,
        yearSpentCents: yearSpent,
        budgetCents: person.budgetCents,
        behindCents: Math.max(0, top - yearSpent),
      };
    });
    const behind = members
      .filter(member => !isEvenSpend(member.yearSpentCents, top))
      .sort((a, b) => b.behindCents - a.behindCents || a.name.localeCompare(b.name));
    return {
      circleId: circle.id,
      name: circle.name,
      status: behind.length === 0 ? 'even' : 'behind',
      members,
      behind,
    };
  });
}

export function circleSuggestions(people: Person[]): CircleSuggestion[] {
  const groups = new Map<RelationshipPresetKey, Person[]>();
  people.filter(person => !person.deleted && !person.circleId).forEach(person => {
    const key = relationshipKey(person.relationship);
    if (!key) {
      return;
    }
    const list = groups.get(key) ?? [];
    list.push(person);
    groups.set(key, list);
  });
  return [...groups.entries()]
    .filter(([, group]) => group.length >= 2)
    .map(([key, group]) => ({
      key,
      personIds: group.map(person => person.id),
      names: group.map(person => person.name),
    }));
}

/** One slim Home line. Empty circles are omitted. The first person behind is the most behind. */
export function circleHomeLine(section: CircleSection): { status: 'even' | 'behind'; personName?: string; behindCents?: number } | null {
  if (section.status === 'empty') {
    return null;
  }
  if (section.status === 'even') {
    return { status: 'even' };
  }
  const first = section.behind[0];
  if (!first) {
    return { status: 'even' };
  }
  return { status: 'behind', personName: first.name, behindCents: first.behindCents };
}

export function joinNames(names: string[]): string {
  if (names.length <= 1) {
    return names[0] ?? '';
  }
  if (names.length === 2) {
    return `${names[0]} and ${names[1]}`;
  }
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

export function uncircledPeople(snapshot: AppSnapshot): Person[] {
  const ids = new Set(activeCircles(snapshot).map(circle => circle.id));
  return snapshot.people.filter(person => !person.deleted && (!person.circleId || !ids.has(person.circleId)));
}

export function addCircle(snapshot: AppSnapshot, circle: Circle): AppSnapshot {
  return { ...snapshot, circles: [...activeCircles(snapshot), circle] };
}

export function renameCircle(snapshot: AppSnapshot, circleId: string, name: string): AppSnapshot | null {
  if (!activeCircles(snapshot).some(circle => circle.id === circleId)) {
    return null;
  }
  return {
    ...snapshot,
    circles: activeCircles(snapshot).map(circle => (circle.id === circleId ? { ...circle, name } : circle)),
  };
}

export function removeCircle(snapshot: AppSnapshot, circleId: string): AppSnapshot {
  return {
    ...snapshot,
    circles: activeCircles(snapshot).filter(circle => circle.id !== circleId),
    people: snapshot.people.map(person => {
      if (person.circleId !== circleId) {
        return person;
      }
      const next = { ...person };
      delete next.circleId;
      return next;
    }),
  };
}

export function assignCircle(snapshot: AppSnapshot, personId: string, circleId: string | null, now: number): AppSnapshot | null {
  const person = snapshot.people.find(item => item.id === personId && !item.deleted);
  if (!person) {
    return null;
  }
  if (circleId && !activeCircles(snapshot).some(circle => circle.id === circleId)) {
    return null;
  }
  return {
    ...snapshot,
    people: snapshot.people.map(item => {
      if (item.id !== personId) {
        return item;
      }
      const next = { ...item, updatedAt: now };
      if (circleId) {
        next.circleId = circleId;
      } else {
        delete next.circleId;
      }
      return next;
    }),
  };
}

function keptEvenFlag(person: Person): boolean {
  if (!Object.prototype.hasOwnProperty.call(person, 'keepEven')) {
    return false;
  }
  return (person as Person & { keepEven?: unknown }).keepEven === true;
}

export function stripKeptEven(person: Person): Person {
  if (!Object.prototype.hasOwnProperty.call(person, 'keepEven')) {
    return person;
  }
  const next = { ...person } as Person & { keepEven?: unknown };
  delete next.keepEven;
  return next;
}

/**
 * The short-lived keepEven flag becomes one circle named "Kept even".
 * People already in a circle move into that one. The flag is not kept.
 */
export function foldKeptEven(snapshot: AppSnapshot, now: number): AppSnapshot {
  const marked = new Set(
    snapshot.people.filter(person => keptEvenFlag(person) && !person.deleted).map(person => person.id),
  );
  const people = snapshot.people.map(stripKeptEven);
  const circles = [...(snapshot.circles ?? [])];
  if (marked.size === 0) {
    return { ...snapshot, people, circles };
  }
  const existing = circles.find(item => item.name === KEPT_EVEN_CIRCLE_NAME);
  const circle = existing ?? { id: randomId(), name: KEPT_EVEN_CIRCLE_NAME, createdAt: now };
  return {
    ...snapshot,
    circles: existing ? circles : [...circles, circle],
    people: people.map(person => (marked.has(person.id) ? { ...person, circleId: circle.id, updatedAt: now } : person)),
  };
}

export function acceptSuggestion(snapshot: AppSnapshot, circle: Circle, personIds: string[], now: number): AppSnapshot {
  const withCircle = addCircle(snapshot, circle);
  return {
    ...withCircle,
    people: withCircle.people.map(person => (
      personIds.includes(person.id) && !person.deleted
        ? { ...person, circleId: circle.id, updatedAt: now }
        : person
    )),
  };
}
