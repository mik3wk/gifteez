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
