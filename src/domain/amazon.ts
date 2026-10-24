const QUERY_STOP = new Set([
  'a', 'an', 'the', 'and', 'or', 'for', 'to', 'of', 'with', 'from', 'their', 'they', 'them',
  'that', 'this', 'you', 'your', 'just', 'plus', 'one', 'into', 'can', 'use',
]);

const REASON_MARK = /idea they can use|something they can use|something to do together|letter or keepsake|something useful they can enjoy/i;

function titleKeywords(title: string): string[] {
  return title.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(word => word.length > 2 && !QUERY_STOP.has(word));
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
 * Shop search uses the idea's search keywords, or words from the title when those keywords are missing.
 * Reason sentences never become the query.
 */
export function shopSearchQuery(idea: { title: string; searchQuery?: string; reason?: string } | string): string {
  if (typeof idea === 'string') {
    return padKeywords(titleKeywords(idea));
  }
  const query = (idea.searchQuery ?? '').trim().replace(/\s+/g, ' ');
  if (query && !copiesReason(query, idea.reason ?? '')) {
    return query;
  }
  return padKeywords(titleKeywords(idea.title));
}

function padKeywords(words: string[]): string {
  const picked = words.slice(0, 6);
  while (picked.length < 3) {
    picked.push('gift');
  }
  return picked.join(' ');
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
