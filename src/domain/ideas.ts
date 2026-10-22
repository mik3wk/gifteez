import { hashToUint } from '../crypto/crypto';
import { CATALOG, type CatalogIdea } from './catalog';
import type { FeedbackEntry, OccasionType } from './types';

export function suggestIdeas(input: {
  personId: string;
  name: string;
  tags: string[];
  occasion: OccasionType | null;
  feedback: FeedbackEntry[];
  salt: number;
  limit?: number;
}): string[] {
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
  const picked = ranked.slice(0, limit).map(item => item.idea.text);
  if (picked.length >= limit) {
    return picked;
  }
  const filler = CATALOG.filter(idea => !picked.includes(idea.text) && !blocked.has(idea.text))
    .sort((a, b) => hashToUint(`${input.salt}|${a.text}`) - hashToUint(`${input.salt}|${b.text}`))
    .slice(0, limit - picked.length)
    .map(idea => idea.text);
  return [...picked, ...filler];
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
  return `${personId}:${occasionKey}:${source}`;
}
