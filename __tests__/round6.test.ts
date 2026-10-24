import { ageFromNotes, ideasTooSimilar, mergeIdeaBatches, resolveAge, suggestIdeas } from '../src/domain/ideas';
import { parseBirthYear } from '../src/domain/logic';
import type { GiftIdea } from '../src/domain/types';

function idea(title: string): GiftIdea {
  return { title, priceMin: 20, priceMax: 40, reason: 'A practical gift.', searchQuery: 'practical gift idea' };
}

const ADULT_TITLES = [
  'Tickets to a small live show',
  'A small set of everyday fragrance or lotion',
  'A meal out, just the two of you',
];

test('age prefers a birthday year, then birth year, then notes, then relationship', () => {
  const today = new Date(2026, 5, 1);
  const birthday = resolveAge({
    occasions: [{ personId: 'p', type: 'birthday', year: 2020, month: 1, day: 1 }],
    personId: 'p',
    birthYear: 1990,
    notes: 'Age 40, loves wine',
    relationship: 'sister',
    today,
  });
  expect(birthday).toEqual({ years: 6, band: 'kid' });

  const field = resolveAge({
    occasions: [],
    personId: 'p',
    birthYear: 2018,
    notes: 'Age 40',
    relationship: 'sister',
    today: new Date(2026, 0, 1),
  });
  expect(field).toEqual({ years: 8, band: 'kid' });

  expect(ageFromNotes('Age 6, loves LEGO')).toBe(6);
  const noted = resolveAge({ occasions: [], personId: 'p', notes: 'Age 6, loves LEGO' });
  expect(noted).toEqual({ years: 6, band: 'kid' });

  const sister = resolveAge({ occasions: [], personId: 'p', relationship: 'sister' });
  expect(sister).toEqual({ years: null, band: 'adult' });
  const child = resolveAge({ occasions: [], personId: 'p', relationship: 'niece' });
  expect(child).toEqual({ years: null, band: 'kid' });
});

test('kids miss adult-only gifts and a LEGO note lifts games', () => {
  const ideas = suggestIdeas({
    personId: 'p',
    name: 'Should Not Matter',
    tags: [],
    occasion: 'birthday',
    feedback: [],
    salt: 2,
    notes: 'Age 6, loves LEGO',
    band: 'kid',
  });
  expect(ideas.some(item => ADULT_TITLES.includes(item.title))).toBe(false);
  expect(ideas.some(item => /toy|game|puzzle|board/i.test(item.title))).toBe(true);
  expect(JSON.stringify(ideas)).not.toContain('Should Not Matter');
});

test('an adult relationship does not get child-only gifts', () => {
  const ideas = suggestIdeas({
    personId: 'p',
    name: 'Ada',
    tags: ['kids'],
    occasion: 'birthday',
    feedback: [],
    salt: 3,
    band: 'adult',
  });
  expect(ideas.map(item => item.title)).not.toContain('A toy or kit you can use together');
  expect(ideas.map(item => item.title)).not.toContain('A soft keepsake for the new baby, plus a note for the parents');
});

test('near-duplicate ideas collapse and the earlier title stays', () => {
  expect(ideasTooSimilar('Pottery wheel class', 'Pottery studio class voucher')).toBe(true);
  expect(ideasTooSimilar('Wool socks', 'A linen apron')).toBe(false);
  const merged = mergeIdeaBatches(
    [idea('Pottery wheel class'), idea('Wool socks')],
    [idea('Pottery studio class voucher'), idea('A linen apron')],
  );
  expect(merged.ideas.map(item => item.title)).toEqual(['Pottery wheel class', 'Wool socks', 'A linen apron']);
  expect(merged.added.map(item => item.title)).toEqual(['A linen apron']);
});

test('birth year is optional and rejects a year that is not four digits in range', () => {
  expect(parseBirthYear('')).toBeNull();
  expect(parseBirthYear('2019', new Date(2026, 0, 1))).toBe(2019);
  expect(parseBirthYear('1899', new Date(2026, 0, 1))).toBeNull();
  expect(parseBirthYear('20', new Date(2026, 0, 1))).toBeNull();
});
