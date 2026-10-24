import { amazonSearchUrl, shopNounPhrase, shopSearchQuery } from '../src/domain/amazon';
import { CATALOG } from '../src/domain/catalog';

test('amazon search keeps the associate tag only when Remote Config has one', () => {
  expect(amazonSearchUrl('wool scarf cold weather', 'gifteez-20')).toBe(
    'https://www.amazon.com/s?k=wool+scarf+cold+weather&tag=gifteez-20',
  );
  expect(amazonSearchUrl('  ceramic everyday mug  ', '')).toBe('https://www.amazon.com/s?k=ceramic+everyday+mug');
  expect(amazonSearchUrl('ceramic everyday mug', '   ')).toBe('https://www.amazon.com/s?k=ceramic+everyday+mug');
  expect(amazonSearchUrl('ceramic everyday mug', 'gifteez-20').includes('tag=')).toBe(true);
  expect(amazonSearchUrl('ceramic everyday mug', '').includes('tag=')).toBe(false);
});

test('shop search uses the title and keywords, never the reason', () => {
  const reason = 'A cooking idea they can use: a cookbook focused on weeknight meals.';
  const fromReason = shopSearchQuery({
    title: 'A cookbook focused on weeknight meals',
    searchQuery: reason,
    reason,
  });
  expect(fromReason.toLowerCase()).not.toContain('idea they can use');
  expect(fromReason).toBe('cookbook weeknight meals');
  expect(shopSearchQuery({
    title: 'A cookbook focused on weeknight meals',
    searchQuery: 'cookbook weeknight meals',
    reason,
  })).toBe('cookbook weeknight meals');
  expect(shopSearchQuery('A wool scarf')).toBe('wool scarf gift');
  expect(shopNounPhrase('A board game that plays well with two to five people')).toBe('board game for 2-5 players');
  expect(shopSearchQuery({
    title: 'A board game that plays well with two to five people',
    searchQuery: 'board game plays well two five',
    reason: 'A game idea they can use: a board game that plays well with two to five people.',
  })).toBe('board game for 2-5 players');
  const cookbook = CATALOG.find(idea => /cookbook/i.test(idea.text));
  expect(cookbook?.reason.toLowerCase()).toContain('idea they can use');
  const shopped = { title: cookbook!.text, searchQuery: cookbook!.searchQuery, reason: cookbook!.reason };
  expect(shopSearchQuery(shopped).toLowerCase()).not.toContain('idea they can use');
  expect(shopSearchQuery(shopped)).toBe(cookbook!.searchQuery);
});
