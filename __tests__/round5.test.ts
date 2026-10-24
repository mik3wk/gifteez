import { deleteSharedGift } from '../src/domain/edits';
import { ageYears, mergeIdeaBatches, sentenceCaseTitle } from '../src/domain/ideas';
import { recordGift, yearSpentCents } from '../src/domain/logic';
import { emptySnapshot, type GiftIdea } from '../src/domain/types';

function idea(title: string): GiftIdea {
  return { title, priceMin: 20, priceMax: 40, reason: 'A useful thing.', searchQuery: 'useful everyday gift' };
}

test('a later cloud batch appends and keeps the earlier title', () => {
  const first = mergeIdeaBatches([], [idea('Wool socks'), idea('A mug')]);
  const second = mergeIdeaBatches(first.ideas, [idea('wool   socks'), idea('Linen apron')]);
  expect(second.ideas.map(item => item.title)).toEqual(['Wool socks', 'A mug', 'Linen apron']);
  expect(second.added.map(item => item.title)).toEqual(['Linen apron']);
  expect(sentenceCaseTitle('A Cozy Wool Blanket')).toBe('A cozy wool blanket');
  expect(mergeIdeaBatches([], [idea('A Cozy Wool Blanket')]).ideas[0].title).toBe('A cozy wool blanket');
});

test('age comes from a birthday year and never needs a name', () => {
  const occasions = [{ personId: 'a', type: 'birthday', year: 1992, month: 12, day: 1 }];
  expect(ageYears(occasions, 'a', new Date(2026, 9, 24))).toBe(33);
  expect(ageYears(occasions, 'a', new Date(2026, 11, 2))).toBe(34);
  expect(ageYears([{ personId: 'a', type: 'christmas', month: 12, day: 25 }], 'a', new Date(2026, 0, 1))).toBeNull();
});

test('a gift with no occasion still counts toward the year', () => {
  const snapshot = emptySnapshot(1);
  const next = recordGift({
    snapshot,
    gift: {
      id: 'g',
      personId: 'a',
      occasionId: '',
      year: 2026,
      title: 'Mug',
      priceCents: 2500,
      purchasedOn: '2026-03-01',
      updatedAt: 2,
    },
  });
  expect(next.gifts).toHaveLength(1);
  expect(next.gifts[0].occasionId).toBe('');
  expect(next.states).toHaveLength(0);
  expect(yearSpentCents('a', next.gifts, 2026)).toBe(2500);
  const removed = deleteSharedGift({ snapshot: next, giftId: 'g', uid: null, now: 3 });
  expect(removed.ok).toBe(true);
  if (removed.ok) {
    expect(removed.snapshot.states).toHaveLength(0);
  }
});
