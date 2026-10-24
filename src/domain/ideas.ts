import { hashToUint } from '../crypto/crypto';
import { CATALOG, ideaReason, type CatalogIdea } from './catalog';
import { relationshipKey } from './relationship';
import type { FeedbackEntry, GiftIdea, OccasionType } from './types';

export type AgeBand = 'baby' | 'kid' | 'teen' | 'adult';

const CHILD_RELATIONSHIPS = new Set(['son', 'daughter', 'child', 'niece', 'nephew']);
const ADULT_RELATIONSHIPS = new Set([
  'mom', 'dad', 'parent', 'sister', 'brother', 'sibling', 'wife', 'husband', 'partner',
  'grandma', 'grandpa', 'aunt', 'uncle', 'inLaw', 'friend', 'bestFriend', 'coworker', 'boss', 'teacher', 'neighbor',
]);

const SIMILAR_STOP = new Set([
  'gift', 'gifts', 'the', 'and', 'for', 'with', 'from', 'this', 'that', 'their', 'they', 'them',
  'your', 'you', 'just', 'plus', 'into', 'can', 'use', 'something', 'small', 'nice', 'set', 'day',
  'more', 'than', 'once', 'about', 'have', 'been', 'will', 'not', 'but', 'are', 'was', 'her', 'his',
  'she', 'him', 'who', 'what', 'when', 'where', 'also', 'very', 'really', 'some', 'other', 'only',
]);

const NOTE_STOP = new Set([
  'age', 'loves', 'love', 'likes', 'like', 'and', 'the', 'with', 'for', 'who', 'has', 'into',
  'really', 'very', 'just', 'their', 'they', 'from', 'this', 'that', 'about', 'year', 'years', 'old',
]);

export function ideaKey(idea: GiftIdea | string): string {
  return typeof idea === 'string' ? idea : idea.title;
}

/** Titles match across batches when spacing and case differ. */
export function normalizeIdeaTitle(title: string): string {
  return title.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
}

/** Sentence case for every idea title, including ones that arrive in title case from the cloud. */
export function sentenceCaseTitle(title: string): string {
  const trimmed = title.trim().replace(/\s+/g, ' ');
  if (!trimmed) {
    return '';
  }
  const lower = trimmed.toLocaleLowerCase();
  return lower.charAt(0).toLocaleUpperCase() + lower.slice(1);
}

/** Tokens that can mark two titles as the same gift. Short words and "gift" do not count. */
export function ideaTokens(title: string): string[] {
  return title.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(word => word.length > 3 && !SIMILAR_STOP.has(word));
}

/** True when two titles share enough distinctive words, such as pottery + class. */
export function ideasTooSimilar(a: string, b: string): boolean {
  const left = new Set(ideaTokens(a));
  const right = new Set(ideaTokens(b));
  if (left.size === 0 || right.size === 0) {
    return false;
  }
  let shared = 0;
  left.forEach(token => {
    if (right.has(token)) {
      shared += 1;
    }
  });
  const min = Math.min(left.size, right.size);
  return shared >= 2 && shared / min >= 0.5;
}

function sameIdea(a: string, b: string): boolean {
  return normalizeIdeaTitle(a) === normalizeIdeaTitle(b) || ideasTooSimilar(a, b);
}

/** Keep earlier ideas. A later batch drops exact and near-duplicate titles. */
export function mergeIdeaBatches(existing: GiftIdea[], incoming: GiftIdea[]): { ideas: GiftIdea[]; added: GiftIdea[] } {
  const ideas: GiftIdea[] = [];
  existing.forEach(idea => {
    if (!normalizeIdeaTitle(idea.title) || ideas.some(kept => sameIdea(kept.title, idea.title))) {
      return;
    }
    ideas.push(idea);
  });
  const added: GiftIdea[] = [];
  incoming.forEach(idea => {
    const titled = { ...idea, title: sentenceCaseTitle(idea.title) };
    if (!normalizeIdeaTitle(titled.title) || ideas.some(kept => sameIdea(kept.title, titled.title))) {
      return;
    }
    added.push(titled);
    ideas.push(titled);
  });
  return { ideas, added };
}

/** Age from a birthday year, when one is saved. The name is never part of this. */
export function ageYears(
  occasions: Array<{ personId: string; type: string; year?: number; month: number; day: number; deleted?: boolean }>,
  personId: string,
  today = new Date(),
): number | null {
  const birthday = occasions.find(item => (
    item.personId === personId && !item.deleted && item.type === 'birthday' && typeof item.year === 'number'
  ));
  if (!birthday?.year) {
    return null;
  }
  let age = today.getFullYear() - birthday.year;
  const before = today.getMonth() + 1 < birthday.month
    || (today.getMonth() + 1 === birthday.month && today.getDate() < birthday.day);
  if (before) {
    age -= 1;
  }
  if (age < 0 || age > 120) {
    return null;
  }
  return age;
}

export function ageBandFromYears(age: number): AgeBand {
  if (age < 3) {
    return 'baby';
  }
  if (age < 13) {
    return 'kid';
  }
  if (age < 18) {
    return 'teen';
  }
  return 'adult';
}

/** A note such as "Age 6, loves LEGO" can supply an age when no birthday year is saved. */
export function ageFromNotes(notes: string): number | null {
  const match = /\bage\s+(\d{1,3})\b/i.exec(notes) ?? /\b(\d{1,3})\s*(?:years?\s*old|yo)\b/i.exec(notes);
  const value = Number(match?.[1]);
  if (!Number.isInteger(value) || value < 0 || value > 120) {
    return null;
  }
  return value;
}

function bandFromRelationship(relationship: string | undefined): AgeBand | null {
  const key = relationshipKey(relationship);
  if (!key) {
    return null;
  }
  if (CHILD_RELATIONSHIPS.has(key)) {
    return 'kid';
  }
  if (ADULT_RELATIONSHIPS.has(key)) {
    return 'adult';
  }
  return null;
}

/**
 * Occasion year, then the birth-year field, then a note, then the relationship.
 * `years` stays empty when the band was only inferred, so a name-free prompt is not given a guessed number.
 */
export function resolveAge(input: {
  occasions: Array<{ personId: string; type: string; year?: number; month: number; day: number; deleted?: boolean }>;
  personId: string;
  birthYear?: number | null;
  notes?: string;
  relationship?: string;
  today?: Date;
}): { years: number | null; band: AgeBand | null } {
  const today = input.today ?? new Date();
  const fromOccasion = ageYears(input.occasions, input.personId, today);
  if (fromOccasion != null) {
    return { years: fromOccasion, band: ageBandFromYears(fromOccasion) };
  }
  if (typeof input.birthYear === 'number' && input.birthYear >= 1900 && input.birthYear <= today.getFullYear()) {
    const years = today.getFullYear() - input.birthYear;
    if (years >= 0 && years <= 120) {
      return { years, band: ageBandFromYears(years) };
    }
  }
  const fromNotes = ageFromNotes(input.notes ?? '');
  if (fromNotes != null) {
    return { years: fromNotes, band: ageBandFromYears(fromNotes) };
  }
  return { years: null, band: bandFromRelationship(input.relationship) };
}

export function asGiftIdea(idea: GiftIdea | string): GiftIdea {
  if (typeof idea === 'string') {
    return { title: idea, priceMin: 15, priceMax: 45, reason: 'Something useful they can enjoy more than once.', searchQuery: 'thoughtful practical gift' };
  }
  return idea;
}

export function suggestIdeas(input: {
  personId: string;
  name: string;
  tags: string[];
  occasion: OccasionType | null;
  feedback: FeedbackEntry[];
  salt: number;
  limit?: number;
  notes?: string;
  band?: AgeBand | null;
}): GiftIdea[] {
  const limit = input.limit ?? 5;
  const tags = new Set(input.tags.map(tag => tag.toLowerCase()));
  const mine = input.feedback.filter(entry => entry.personId === input.personId);
  const blocked = new Set(mine.filter(entry => entry.vote === 'down').map(entry => entry.idea));
  const liked = mine.filter(entry => entry.vote === 'up').map(entry => entry.idea);
  const likedTags = new Set(
    CATALOG.filter(idea => liked.includes(idea.text)).flatMap(idea => idea.tags),
  );
  const notes = noteTokens(input.notes ?? '');
  const band = input.band ?? null;
  const ranked = CATALOG.map(idea => ({
    idea,
    score: scoreIdea(idea, tags, input.occasion, likedTags, blocked, band, notes),
    tie: hashToUint(`${input.personId}|${idea.text}|${input.salt}`),
  }))
    .filter(item => item.score > -50)
    .sort((a, b) => b.score - a.score || a.tie - b.tie);
  const picked = ranked.slice(0, limit).map(item => toGiftIdea(item.idea, tags));
  if (picked.length >= limit) {
    return picked;
  }
  const titles = new Set(picked.map(idea => idea.title));
  const filler = CATALOG.filter(idea => !titles.has(idea.text) && !blocked.has(idea.text) && audienceOk(idea, band))
    .sort((a, b) => hashToUint(`${input.salt}|${a.text}`) - hashToUint(`${input.salt}|${b.text}`))
    .slice(0, limit - picked.length)
    .map(idea => toGiftIdea(idea, tags));
  return [...picked, ...filler];
}

function toGiftIdea(idea: CatalogIdea, userTags: Set<string>): GiftIdea {
  const matched = userTags.size > 0 ? idea.tags.find(tag => userTags.has(tag)) ?? null : null;
  return {
    title: idea.text,
    priceMin: idea.priceMin,
    priceMax: idea.priceMax,
    reason: ideaReason(idea.text, matched),
    searchQuery: idea.searchQuery,
  };
}

function noteTokens(notes: string): Set<string> {
  return new Set(
    notes.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(word => word.length > 3 && !NOTE_STOP.has(word)),
  );
}

function audienceOk(idea: CatalogIdea, band: AgeBand | null): boolean {
  if ((band === 'baby' || band === 'kid') && idea.audience === 'adult') {
    return false;
  }
  if (band === 'adult' && idea.audience === 'child') {
    return false;
  }
  return true;
}

function scoreIdea(
  idea: CatalogIdea,
  tags: Set<string>,
  occasion: OccasionType | null,
  likedTags: Set<string>,
  blocked: Set<string>,
  band: AgeBand | null,
  notes: Set<string>,
): number {
  if (blocked.has(idea.text) || !audienceOk(idea, band)) {
    return -100;
  }
  let score = 1;
  idea.tags.forEach(tag => {
    if (tags.has(tag)) {
      score += 3;
    }
    if (likedTags.has(tag)) {
      score += 4;
    }
  });
  if (occasion && idea.occasions !== 'any' && idea.occasions.includes(occasion)) {
    score += 2;
  }
  if (!occasion || idea.occasions === 'any') {
    score += 1;
  }
  if (tags.size === 0) {
    score += 1;
  }
  const hay = `${idea.text} ${idea.searchQuery} ${idea.tags.join(' ')}`.toLowerCase();
  notes.forEach(token => {
    if (hay.includes(token)) {
      score += 5;
    }
    if (token === 'lego' && (idea.tags.includes('kids') || idea.tags.includes('games'))) {
      score += 6;
    }
  });
  return score;
}

export function ideaCacheId(personId: string, occasionKey: string, source: string): string {
  return `${personId}:${occasionKey}:${source}:v2`;
}
