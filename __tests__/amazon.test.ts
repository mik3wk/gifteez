import { amazonSearchUrl } from '../src/domain/amazon';

test('amazon search keeps the associate tag only when Remote Config has one', () => {
  expect(amazonSearchUrl('wool scarf cold weather', 'gifteez-20')).toBe(
    'https://www.amazon.com/s?k=wool+scarf+cold+weather&tag=gifteez-20',
  );
  expect(amazonSearchUrl('  ceramic everyday mug  ', '')).toBe('https://www.amazon.com/s?k=ceramic+everyday+mug');
  expect(amazonSearchUrl('ceramic everyday mug', '   ')).toBe('https://www.amazon.com/s?k=ceramic+everyday+mug');
  expect(amazonSearchUrl('ceramic everyday mug', 'gifteez-20').includes('tag=')).toBe(true);
  expect(amazonSearchUrl('ceramic everyday mug', '').includes('tag=')).toBe(false);
});
