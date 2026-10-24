import { hashToUint } from '../crypto/crypto';
import { CATALOG, type CatalogIdea } from './catalog';
import type { FeedbackEntry, GiftIdea, OccasionType } from './types';

export function ideaKey(idea: GiftIdea | string): string {
  return typeof idea === 'string' ? idea : idea.title;
}

/** Titles match across batches when spacing and case differ. */
export function normalizeIdeaTitle(title: string): string {
  return title.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
}

/** Keep earlier ideas. A later batch only adds titles that are not already saved. */
export function mergeIdeaBatches(existing: GiftIdea[], incoming: GiftIdea[]): { ideas: GiftIdea[]; added: GiftIdea[] } {
  const seen = new Set<string>();
  const ideas: GiftIdea[] = [];
  existing.forEach(idea => {
    const key = normalizeIdeaTitle(idea.title);
    if (!key || seen.has(key)) {
      return;
    }
    seen.add(key);
    ideas.push(idea);
  });
  const added: GiftIdea[] = [];
  incoming.forEach(idea => {
    const key = normalizeIdeaTitle(idea.title);
    if (!key || seen.has(key)) {
      return;
    }
    seen.add(key);
    added.push(idea);
    ideas.push(idea);
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
}): GiftIdea[] {
  const limit = input.limit ?? 5;
  const tags = new Set(input.tags.map(tag => tag.toLowerCase()));
  const mine = input.feedback.filter(entry => entry.personId === input.personId);
  const blocked = new Set(mine.filter(entry => entry.vote === 'down').map(entry => entry.idea));
  const liked = mine.filter(entry => entry.vote === 'up').map(entry => entry.idea);
  const likedTags = new Set(
    CATALOG.filter(idea => liked.includes(idea.text)).flatMap(idea => idea.tags),
  );
  const ranked = CATALOG.map(idea => ({
    idea,
    score: scoreIdea(idea, tags, input.occasion, likedTags, blocked),
    tie: hashToUint(`${input.personId}|${idea.text}|${input.salt}`),
  }))
    .filter(item => item.score > -50)
    .sort((a, b) => b.score - a.score || a.tie - b.tie);
  const picked = ranked.slice(0, limit).map(item => toGiftIdea(item.idea));
  if (picked.length >= limit) {
    return picked;
  }
  const titles = new Set(picked.map(idea => idea.title));
  const filler = CATALOG.filter(idea => !titles.has(idea.text) && !blocked.has(idea.text))
    .sort((a, b) => hashToUint(`${input.salt}|${a.text}`) - hashToUint(`${input.salt}|${b.text}`))
    .slice(0, limit - picked.length)
    .map(toGiftIdea);
  return [...picked, ...filler];
}

function toGiftIdea(idea: CatalogIdea): GiftIdea {
  return {
    title: idea.text,
    priceMin: idea.priceMin,
    priceMax: idea.priceMax,
    reason: idea.reason,
    searchQuery: idea.searchQuery,
  };
}

function scoreIdea(
  idea: CatalogIdea,
  tags: Set<string>,
  occasion: OccasionType | null,
  likedTags: Set<string>,
  blocked: Set<string>,
): number {
  if (blocked.has(idea.text)) {
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
  return score;
}

export function ideaCacheId(personId: string, occasionKey: string, source: string): string {
  return `${personId}:${occasionKey}:${source}:v2`;
}
