export const DEFAULT_FREE_PEOPLE = 5;

export type PersonRow = {
  id: string;
  createdAt: number;
  deleted?: boolean;
};

export type PersonWriteDecision =
  | { ok: true; peopleCount: number; lockedPersonIds: string[] }
  | { ok: false; reason: 'cap'; peopleCount: number; lockedPersonIds: string[] };

export function activePersonRows(people: PersonRow[]): PersonRow[] {
  return people.filter(person => !person.deleted);
}

/** Newest people past the oldest `limit` are locked. Nothing is deleted. An entitled list locks nobody. */
export function lockedPersonIds(people: PersonRow[], entitled: boolean, limit: number): string[] {
  if (entitled) {
    return [];
  }
  const active = activePersonRows(people)
    .slice()
    .sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));
  if (active.length <= limit) {
    return [];
  }
  return active.slice(limit).map(person => person.id);
}

export function decidePersonWrite(input: {
  entitled: boolean;
  people: PersonRow[];
  personId: string;
  createdAt: number;
  deleted: boolean;
  limit: number;
}): PersonWriteDecision {
  const existing = input.people.find(person => person.id === input.personId);
  const next: PersonRow[] = existing
    ? input.people.map(person => (person.id === input.personId ? { ...person, deleted: input.deleted } : person))
    : [...input.people, { id: input.personId, createdAt: input.createdAt, deleted: input.deleted }];
  const adding = !input.deleted && (!existing || existing.deleted === true);
  const count = activePersonRows(next).length;
  if (adding && !input.entitled && count > input.limit) {
    const current = activePersonRows(input.people).length;
    return {
      ok: false,
      reason: 'cap',
      peopleCount: current,
      lockedPersonIds: lockedPersonIds(input.people, false, input.limit),
    };
  }
  return {
    ok: true,
    peopleCount: count,
    lockedPersonIds: lockedPersonIds(next, input.entitled, input.limit),
  };
}
