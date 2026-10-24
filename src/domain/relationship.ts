import { t } from '../i18n';
import type { Person } from './types';

export const RELATIONSHIP_MAX = 40;

/** Preset keys match en-US `relationshipPresets`. Older lists stored the English label. */
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

/** Chips shown before More. Order is the default row. */
export const DEFAULT_RELATIONSHIP_KEYS = [
  'mom',
  'dad',
  'sister',
  'brother',
  'partner',
  'child',
  'cousin',
  'friend',
] as const satisfies readonly RelationshipPresetKey[];

export function relationshipKey(value: string | undefined | null): RelationshipPresetKey | null {
  const trimmed = value?.trim() ?? '';
  if (!trimmed) {
    return null;
  }
  if ((RELATIONSHIP_PRESET_KEYS as readonly string[]).includes(trimmed)) {
    return trimmed as RelationshipPresetKey;
  }
  return RELATIONSHIP_PRESET_KEYS.find(key => t(`relationshipPresets.${key}`) === trimmed) ?? null;
}

export function relationshipLabel(value: string | undefined | null): string {
  const key = relationshipKey(value);
  return key ? t(`relationshipPresets.${key}`) : (value?.trim() ?? '');
}

/** Plural circle name for a preset, such as cousin → Cousins. Matched by key, not by label text. */
export function relationshipCircleName(key: RelationshipPresetKey): string {
  return t(`relationshipCircles.${key}`);
}

/** Store a preset as its key. Free text and older label values stay readable. */
export function storeRelationship(value: string): string | null {
  const cleaned = cleanRelationship(value);
  if (cleaned == null) {
    return null;
  }
  if (!cleaned) {
    return '';
  }
  return relationshipKey(cleaned) ?? cleaned;
}

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
