import { ideaCacheId, resolveAge, suggestIdeas } from './ideas';
import { upcomingOccasion, upsertIdeas } from './logic';
import type { AppSnapshot, Person } from './types';

function interestKey(tags: readonly string[]): string {
  return [...new Set(tags.map(tag => tag.trim().toLowerCase()).filter(Boolean))].sort().join('|');
}

/** Birth year and interests are part of the idea cache. A real change has to rebuild it. */
export function shouldRefreshIdeas(
  person: Pick<Person, 'tags' | 'birthYear'>,
  patch: { tags?: readonly string[]; birthYear?: number | null },
): boolean {
  if (patch.tags !== undefined && interestKey(person.tags) !== interestKey(patch.tags)) {
    return true;
  }
  if (patch.birthYear !== undefined && (patch.birthYear ?? null) !== (person.birthYear ?? null)) {
    return true;
  }
  return false;
}

/**
 * Drop every cached batch for this person, then write a fresh on-device list
 * for the birth year and interests now stored on them.
 */
export function refreshLocalIdeas(snapshot: AppSnapshot, personId: string, now: number, today = new Date()): AppSnapshot {
  const person = snapshot.people.find(item => item.id === personId && !item.deleted);
  if (!person) {
    return snapshot;
  }
  const occasion = upcomingOccasion(personId, snapshot.occasions, today);
  const occasionKey = occasion ? `${occasion.occasion.id}:${occasion.date.getFullYear()}` : 'general';
  const age = resolveAge({
    occasions: snapshot.occasions,
    personId,
    birthYear: person.birthYear,
    notes: person.notes,
    relationship: person.relationship,
    today,
  });
  const cacheId = ideaCacheId(person.id, occasionKey, 'on-device', person.tags, age);
  const previous = snapshot.ideas.find(item => item.id === cacheId);
  const salt = (previous?.salt ?? 0) + 1;
  const ideas = suggestIdeas({
    personId: person.id,
    name: person.name,
    tags: person.tags,
    occasion: occasion && occasion.occasion.type !== 'custom' ? occasion.occasion.type : null,
    feedback: snapshot.feedback,
    salt,
    notes: person.notes,
    years: age.years,
    band: age.band,
  });
  const cleared: AppSnapshot = {
    ...snapshot,
    ideas: snapshot.ideas.filter(item => item.personId !== personId),
  };
  return upsertIdeas(cleared, {
    id: cacheId,
    personId,
    occasionKey,
    ideas,
    source: 'on-device',
    salt,
    generatedAt: now,
    updatedAt: now,
  });
}
