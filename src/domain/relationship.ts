import type { Person } from './types';

export const RELATIONSHIP_MAX = 40;

/** Stored as the label. Keys match en-US `relationshipPresets`. */
export const RELATIONSHIP_PRESET_KEYS = [
  'mom',
  'dad',
  'parent',
  'sister',
  'brother',
  'sibling',
  'wife',
  'husband',
  'partner',
  'son',
  'daughter',
  'child',
  'grandma',
  'grandpa',
  'aunt',
  'uncle',
  'cousin',
  'niece',
  'nephew',
  'inLaw',
  'friend',
  'bestFriend',
  'coworker',
  'boss',
  'teacher',
  'neighbor',
] as const;

export type RelationshipPresetKey = (typeof RELATIONSHIP_PRESET_KEYS)[number];

/** Empty clears the label. Invalid text returns null. */
export function cleanRelationship(value: string): string | null {
  const trimmed = value.trim().replace(/\s+/g, ' ');
  if (!trimmed) {
    return '';
  }
  if (trimmed.length > RELATIONSHIP_MAX) {
    return null;
  }
  if (!/^[\p{L}][\p{L}\s.'’-]*$/u.test(trimmed)) {
    return null;
  }
  return trimmed;
}

/** The label stays on this phone. Group ciphertext must not carry it. */
export function omitRelationship<T extends { relationship?: string }>(value: T): Omit<T, 'relationship'> {
  const next = { ...value };
  delete next.relationship;
  return next;
}

/** A person doc from another member cannot overwrite or reveal this phone's label. */
export function absorbPerson(previous: Person | undefined, incoming: Person): Person {
  const next = omitRelationship(incoming) as Person;
  if (previous?.relationship) {
    next.relationship = previous.relationship;
  }
  return next;
}
