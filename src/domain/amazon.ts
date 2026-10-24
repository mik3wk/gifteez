const NUMBER_WORD: Record<string, string> = {
  one: '1',
  two: '2',
  three: '3',
  four: '4',
  five: '5',
  six: '6',
  seven: '7',
  eight: '8',
  nine: '9',
  ten: '10',
};

const QUERY_STOP = new Set([
  'a', 'an', 'the', 'and', 'or', 'for', 'to', 'of', 'with', 'from', 'their', 'they', 'them',
  'that', 'this', 'you', 'your', 'just', 'plus', 'into', 'can', 'use', 'on', 'in', 'at', 'by',
]);

const FILLER = new Set(['plays', 'play', 'playing', 'well', 'focused', 'enough']);

const LEGACY_STOP = new Set([
  'a', 'an', 'the', 'and', 'or', 'for', 'to', 'of', 'with', 'from', 'their', 'they', 'them',
  'that', 'this', 'you', 'your', 'just', 'plus', 'one', 'into', 'can', 'use',
]);

const REASON_MARK = /idea they can use|something they can use|something to do together|letter or keepsake|something useful they can enjoy/i;

/** Shop words from the gift itself. A player count stays as "for 2-5 players". */
export function shopNounPhrase(title: string): string {
  const normalized = title.toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').replace(/\s+/g, ' ').trim();
  const numbered = normalized.replace(
    /\b(one|two|three|four|five|six|seven|eight|nine|ten)\b/g,
    word => NUMBER_WORD[word] ?? word,
  );
  const range = numbered.match(/\b(\d+)\s*(?:to|-)\s*(\d+)\b/);
  const players = /\b(?:people|players|person|player)\b/.test(numbered);
  const head = numbered.split(/\b(?:that|which|who)\b/)[0] ?? numbered;
  const words = head.split(/[\s-]+/).filter(word => (
    Boolean(word)
    && !QUERY_STOP.has(word)
    && !FILLER.has(word)
    && !/^\d+$/.test(word)
    && word.length > 2
  ));
  const picked = words.slice(0, 6);
  if (range && players) {
    picked.push('for', `${range[1]}-${range[2]}`, 'players');
  }
  while (picked.length < 3) {
    picked.push('gift');
  }
  return picked.join(' ');
}

function legacyTitleQuery(title: string): string {
  const words = title.toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/).filter(word => word.length > 2 && !LEGACY_STOP.has(word));
  const picked = words.slice(0, 6);
  while (picked.length < 3) {
    picked.push('gift');
  }
  return picked.join(' ');
}

function copiesReason(query: string, reason: string): boolean {
  const folded = query.trim().toLowerCase().replace(/\s+/g, ' ');
  const why = reason.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!folded) {
    return true;
  }
  if (REASON_MARK.test(folded)) {
    return true;
  }
  if (!why) {
    return false;
  }
  return folded === why || (why.includes(folded) && folded.length > 20) || (folded.includes(why) && why.length > 20);
}

/**
 * Shop search uses the noun phrase in the title.
 * A stored query is kept when it is its own phrase, and replaced when it is only the old filler strip or the reason.
 */
export function shopSearchQuery(idea: { title: string; searchQuery?: string; reason?: string } | string): string {
  if (typeof idea === 'string') {
    return shopNounPhrase(idea);
  }
  const phrase = shopNounPhrase(idea.title);
  const query = (idea.searchQuery ?? '').trim().replace(/\s+/g, ' ');
  if (!query || copiesReason(query, idea.reason ?? '') || query === legacyTitleQuery(idea.title)) {
    return phrase;
  }
  return query;
}

/** Amazon search for one idea. The associate tag is left off when Remote Config has none. */
export function amazonSearchUrl(searchQuery: string, associateTag: string): string {
  const params = new URLSearchParams();
  params.set('k', searchQuery.trim().replace(/\s+/g, ' '));
  const tag = associateTag.trim();
  if (tag) {
    params.set('tag', tag);
  }
  return `https://www.amazon.com/s?${params.toString()}`;
}
