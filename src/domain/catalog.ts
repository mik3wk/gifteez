export type CatalogIdea = {
  text: string;
  tags: string[];
  occasions: string[] | 'any';
  priceMin: number;
  priceMax: number;
  reason: string;
  searchQuery: string;
  /** Adult-only gifts stay off a child's list. Child gifts stay off an adult's list. */
  audience?: 'adult' | 'child';
};

export const INTEREST_TAGS = [
  'books',
  'cooking',
  'coffee',
  'tea',
  'games',
  'outdoors',
  'music',
  'sports',
  'fitness',
  'tech',
  'fashion',
  'beauty',
  'home',
  'plants',
  'art',
  'travel',
  'kids',
  'pets',
  'movies',
  'crafts',
  'jewelry',
  'experiences',
  'cozy',
  'foodie',
] as const;

const RAW_CATALOG: Array<Pick<CatalogIdea, 'text' | 'tags' | 'occasions'>> = [
  { text: 'A hardcover novel from an author they already love', tags: ['books'], occasions: 'any' },
  { text: 'A cozy reading light and a bookmark set', tags: ['books', 'cozy'], occasions: 'any' },
  { text: 'A cookbook focused on weeknight meals', tags: ['cooking', 'foodie'], occasions: 'any' },
  { text: 'A nice skillet or Dutch oven', tags: ['cooking', 'home'], occasions: 'any' },
  { text: 'A bag of beans from a local roaster', tags: ['coffee', 'foodie'], occasions: 'any' },
  { text: 'A travel mug they will actually use', tags: ['coffee', 'travel'], occasions: 'any' },
  { text: 'A sampler of loose-leaf teas', tags: ['tea', 'cozy'], occasions: 'any' },
  { text: 'A simple teapot and two cups', tags: ['tea', 'home'], occasions: 'any' },
  { text: 'A board game that plays well with two to five people', tags: ['games'], occasions: 'any' },
  { text: 'A card game small enough to bring to dinner', tags: ['games'], occasions: 'any' },
  { text: 'A day pass or warm layer for a trail they like', tags: ['outdoors'], occasions: 'any' },
  { text: 'A compact picnic blanket', tags: ['outdoors', 'experiences'], occasions: 'any' },
  { text: 'Tickets to a small live show', tags: ['music', 'experiences'], occasions: 'any' },
  { text: 'A record or playlist printed as a custom sleeve', tags: ['music'], occasions: 'any' },
  { text: 'A team scarf or a book about their sport', tags: ['sports'], occasions: 'any' },
  { text: 'A sturdy water bottle for practice', tags: ['sports', 'fitness'], occasions: 'any' },
  { text: 'A yoga mat or resistance bands', tags: ['fitness'], occasions: 'any' },
  { text: 'A class pass for something they have mentioned', tags: ['fitness', 'experiences'], occasions: 'any' },
  { text: 'A useful cable, stand, or battery pack', tags: ['tech'], occasions: 'any' },
  { text: 'A case or sleeve for the device they carry daily', tags: ['tech'], occasions: 'any' },
  { text: 'Wool socks or a scarf in a color they wear', tags: ['fashion', 'cozy'], occasions: ['birthday', 'christmas'] },
  { text: 'A gift card to the shop they already browse', tags: ['fashion'], occasions: 'any' },
  { text: 'A small set of everyday fragrance or lotion', tags: ['beauty'], occasions: 'any' },
  { text: 'A nice comb, balm, or other everyday care item', tags: ['beauty'], occasions: 'any' },
  { text: 'A candle and a soft throw for the couch', tags: ['home', 'cozy'], occasions: ['christmas', 'birthday'] },
  { text: 'Kitchen towels or a serving bowl they can use often', tags: ['home', 'cooking'], occasions: 'any' },
  { text: 'A low-maintenance houseplant', tags: ['plants', 'home'], occasions: 'any' },
  { text: 'A ceramic pot and soil for a plant they already have', tags: ['plants'], occasions: 'any' },
  { text: 'Quality paper, pens, or paint for a current project', tags: ['art', 'crafts'], occasions: 'any' },
  { text: 'A print or frame for a picture they already love', tags: ['art', 'home'], occasions: 'any' },
  { text: 'A guidebook or packing cube for the next trip', tags: ['travel'], occasions: 'any' },
  { text: 'A weekend breakfast out, planned around their schedule', tags: ['travel', 'experiences', 'foodie'], occasions: 'any' },
  { text: 'A toy or kit you can use together', tags: ['kids'], occasions: ['birthday', 'christmas'] },
  { text: 'A building set they can build and take apart', tags: ['kids', 'games'], occasions: ['birthday', 'christmas'] },
  { text: 'An art kit with paper and crayons', tags: ['kids', 'art', 'crafts'], occasions: ['birthday', 'christmas'] },
  { text: 'A picture book or early chapter book', tags: ['kids', 'books'], occasions: ['birthday', 'christmas'] },
  { text: 'A ball, bubbles, or a kite for outdoor play', tags: ['kids', 'outdoors'], occasions: ['birthday', 'christmas'] },
  { text: 'A book they can grow into, with a note in the front', tags: ['kids', 'books'], occasions: ['birthday', 'christmas'] },
  { text: 'Treats or a cozy bed for the pet', tags: ['pets'], occasions: 'any' },
  { text: 'A portrait of their pet from a photo they already took', tags: ['pets', 'art'], occasions: 'any' },
  { text: 'A movie-night bundle: snacks and a film they missed', tags: ['movies', 'cozy'], occasions: 'any' },
  { text: 'A streaming rental of a film you can watch together', tags: ['movies', 'experiences'], occasions: 'any' },
  { text: 'Materials for a craft they have already started', tags: ['crafts'], occasions: 'any' },
  { text: 'A workshop seat for a craft they want to try', tags: ['crafts', 'experiences'], occasions: 'any' },
  { text: 'Simple studs, a chain, or a repair of a piece they own', tags: ['jewelry'], occasions: ['birthday', 'christmas', 'wedding'] },
  { text: 'A small dish for the jewelry they leave on the dresser', tags: ['jewelry', 'home'], occasions: 'any' },
  { text: 'An experience you do with them, not an object', tags: ['experiences'], occasions: 'any' },
  { text: 'A reservation at a place they have mentioned', tags: ['experiences', 'foodie'], occasions: 'any' },
  { text: 'Slippers or a robe in their size', tags: ['cozy', 'home'], occasions: ['christmas', 'birthday'] },
  { text: 'A hot-chocolate or soup kit for a cold night', tags: ['cozy', 'foodie'], occasions: ['christmas'] },
  { text: 'A nice bottle of olive oil, honey, or hot sauce', tags: ['foodie', 'cooking'], occasions: 'any' },
  { text: 'A dessert from a bakery they like', tags: ['foodie'], occasions: 'any' },
  { text: 'A framed photo from a day you shared', tags: ['home'], occasions: ['wedding', 'birthday', 'christmas', 'anniversary', 'mothers-day', 'fathers-day'] },
  { text: 'Flowers or a card that says why they matter', tags: ['experiences'], occasions: ['valentines', 'anniversary', 'mothers-day', 'thank-you', 'teacher'] },
  { text: 'A meal out, just the two of you', tags: ['foodie', 'experiences'], occasions: ['anniversary', 'valentines', 'just-because'] },
  { text: 'Something small for the new place: a plant, a bowl, a key hook', tags: ['home'], occasions: ['housewarming', 'wedding'] },
  { text: 'A soft keepsake for the new baby, plus a note for the parents', tags: ['kids'], occasions: ['birth', 'baby-shower'] },
  { text: 'A card and a practical help, like a meal or a ride', tags: ['experiences'], occasions: ['sympathy', 'get-well'] },
  { text: 'A book or pen for the next chapter', tags: ['books'], occasions: ['graduation', 'promotion', 'retirement'] },
  { text: 'A contribution toward a registry item they still need', tags: ['home'], occasions: ['wedding'] },
  { text: 'A nice set of glasses or a cake server', tags: ['home', 'wedding'], occasions: ['wedding'] },
  { text: 'A letter about a favorite memory, plus one small useful thing', tags: ['experiences'], occasions: 'any' },
  { text: 'Seeds or bulbs timed for their garden', tags: ['plants', 'outdoors'], occasions: ['birthday'] },
  { text: 'A puzzle you can leave on a table together', tags: ['games', 'cozy'], occasions: ['christmas'] },
  { text: 'Ornaments or a shared decoration you pick together', tags: ['home'], occasions: ['christmas'] },
  { text: 'A small treat bag or a pumpkin to carve together', tags: ['kids', 'foodie'], occasions: ['halloween'] },
  { text: 'Flowers or a brunch for the day', tags: ['experiences', 'foodie'], occasions: ['easter', 'mothers-day'] },
  { text: 'A candle, a game, and something sweet for the first night', tags: ['cozy', 'games'], occasions: ['hanukkah'] },
  { text: 'Sweets or a light for the festival', tags: ['foodie'], occasions: ['diwali', 'eid-fitr', 'eid-adha', 'lunar-new-year'] },
  { text: 'A small surprise from a shared wish list', tags: ['games'], occasions: ['secret-santa', 'christmas'] },
  { text: 'A card and a favorite treat to start the year', tags: ['foodie'], occasions: ['new-year'] },
];

const QUERY_STOP = new Set(['a', 'an', 'the', 'and', 'or', 'for', 'to', 'of', 'with', 'from', 'their', 'they', 'them', 'that', 'this', 'you', 'your', 'just', 'plus', 'one', 'into', 'can', 'use']);

const TOPIC_NOUN: Record<string, string> = {
  books: 'book',
  cooking: 'cooking',
  coffee: 'coffee',
  tea: 'tea',
  games: 'game',
  outdoors: 'outdoor',
  music: 'music',
  sports: 'sports',
  fitness: 'fitness',
  tech: 'tech',
  fashion: 'fashion',
  beauty: 'beauty',
  home: 'home',
  plants: 'plant',
  art: 'art',
  travel: 'travel',
  kids: 'kid',
  pets: 'pet',
  movies: 'movie',
  crafts: 'craft',
  jewelry: 'jewelry',
  experiences: 'experience',
  cozy: 'cozy',
  foodie: 'food',
};

function reasonKind(lower: string): 'keepsake' | 'experience' | 'useful' {
  if (/\b(letter|memory|poem|toast)\b/i.test(lower)) {
    return 'keepsake';
  }
  if (/\b(class|classes|ticket|tickets|reservation|workshop|museum|brunch|meal|show)\b/i.test(lower)) {
    return 'experience';
  }
  return 'useful';
}

/** A reason that matches the gift, and names a real interest when the gift is something to use. */
export function ideaReason(text: string, topic: string | null): string {
  const gift = text.replace(/\.$/, '');
  const lower = gift.charAt(0).toLocaleLowerCase() + gift.slice(1);
  const kind = reasonKind(lower);
  if (kind === 'keepsake') {
    return `A letter or keepsake: ${lower}.`;
  }
  if (kind === 'experience') {
    return `Something to do together: ${lower}.`;
  }
  if (!topic) {
    return `Something they can use: ${lower}.`;
  }
  const noun = TOPIC_NOUN[topic] ?? topic;
  const article = /^[aeiou]/i.test(noun) ? 'An' : 'A';
  return `${article} ${noun} idea they can use: ${lower}.`;
}

function searchQueryFor(text: string): string {
  const words = text.toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/).filter(word => word.length > 2 && !QUERY_STOP.has(word));
  const picked = words.slice(0, 6);
  while (picked.length < 3) {
    picked.push('gift');
  }
  return picked.join(' ');
}

function priceBand(tags: string[]): [number, number] {
  if (tags.some(tag => tag === 'jewelry' || tag === 'tech' || tag === 'experiences')) {
    return [40, 120];
  }
  if (tags.some(tag => tag === 'home' || tag === 'cooking')) {
    return [25, 80];
  }
  return [15, 45];
}

const ADULT_ONLY = new Set([
  'Tickets to a small live show',
  'A class pass for something they have mentioned',
  'A gift card to the shop they already browse',
  'A small set of everyday fragrance or lotion',
  'A nice comb, balm, or other everyday care item',
  'Simple studs, a chain, or a repair of a piece they own',
  'A reservation at a place they have mentioned',
  'A meal out, just the two of you',
  'A candle and a soft throw for the couch',
  'A candle, a game, and something sweet for the first night',
  'A nice bottle of olive oil, honey, or hot sauce',
  'A card game small enough to bring to dinner',
  'Quality paper, pens, or paint for a current project',
]);

const CHILD_ONLY = new Set([
  'A toy or kit you can use together',
  'A building set they can build and take apart',
  'An art kit with paper and crayons',
  'A picture book or early chapter book',
  'A ball, bubbles, or a kite for outdoor play',
  'A book they can grow into, with a note in the front',
  'A small treat bag or a pumpkin to carve together',
  'A soft keepsake for the new baby, plus a note for the parents',
]);

export const CATALOG: CatalogIdea[] = RAW_CATALOG.map(item => {
  const [priceMin, priceMax] = priceBand(item.tags);
  const topic = item.tags[0] ?? 'everyday';
  const audience = ADULT_ONLY.has(item.text) ? 'adult' as const : CHILD_ONLY.has(item.text) ? 'child' as const : undefined;
  return {
    ...item,
    priceMin,
    priceMax,
    reason: ideaReason(item.text, topic),
    searchQuery: searchQueryFor(item.text),
    ...(audience ? { audience } : {}),
  };
});
