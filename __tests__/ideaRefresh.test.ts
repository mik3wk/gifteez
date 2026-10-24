import { ideaCacheId } from '../src/domain/ideas';
import { refreshLocalIdeas, shouldRefreshIdeas } from '../src/domain/ideaRefresh';
import { emptySnapshot, type AppSnapshot, type GiftIdea, type Person } from '../src/domain/types';

const today = new Date(2026, 9, 24);

function person(patch: Partial<Person> = {}): Person {
  return {
    id: 'sam',
    name: 'Sam',
    budgetCents: null,
    tags: ['cooking'],
    imported: false,
    opened: true,
    createdAt: 1,
    updatedAt: 1,
    birthYear: 1990,
    ...patch,
  };
}

function gift(title: string): GiftIdea {
  return { title, priceMin: 15, priceMax: 45, reason: 'A practical gift they can use.', searchQuery: 'practical gift idea' };
}

function snapshot(people: Person[], ideas: AppSnapshot['ideas'] = []): AppSnapshot {
  return { ...emptySnapshot(1), people, ideas };
}

test('a new birth year or a new interest asks for a fresh idea list', () => {
  const sam = person();
  expect(shouldRefreshIdeas(sam, {})).toBe(false);
  expect(shouldRefreshIdeas(sam, { tags: ['cooking'] })).toBe(false);
  expect(shouldRefreshIdeas(sam, { tags: ['Cooking'] })).toBe(false);
  expect(shouldRefreshIdeas(sam, { birthYear: 1990 })).toBe(false);
  expect(shouldRefreshIdeas(sam, { tags: ['games', 'art'] })).toBe(true);
  expect(shouldRefreshIdeas(sam, { tags: [] })).toBe(true);
  expect(shouldRefreshIdeas(sam, { birthYear: 2020 })).toBe(true);
  expect(shouldRefreshIdeas(sam, { birthYear: null })).toBe(true);
});

test('changing the birth year drops the old cache and writes ideas for that age', () => {
  const staleId = ideaCacheId('sam', 'general', 'on-device', ['cooking'], { years: 36, band: 'adult' });
  const cloudId = ideaCacheId('sam', 'general', 'cloud', ['cooking'], { years: 36, band: 'adult' });
  const before = snapshot(
    [person({ birthYear: 2020 })],
    [
      {
        id: staleId,
        personId: 'sam',
        occasionKey: 'general',
        ideas: [gift('A nice skillet or Dutch oven'), gift('A card game small enough to bring to dinner')],
        source: 'on-device',
        salt: 2,
        generatedAt: 1,
        updatedAt: 1,
      },
      {
        id: cloudId,
        personId: 'sam',
        occasionKey: 'general',
        ideas: [gift('A portrait of their pet from a photo they already took')],
        source: 'cloud',
        salt: 0,
        generatedAt: 1,
        updatedAt: 1,
      },
      {
        id: 'other',
        personId: 'ada',
        occasionKey: 'general',
        ideas: [gift('A hardcover novel from an author they already love')],
        source: 'on-device',
        salt: 0,
        generatedAt: 1,
        updatedAt: 1,
      },
    ],
  );
  const next = refreshLocalIdeas(before, 'sam', 9, today);
  const mine = next.ideas.filter(item => item.personId === 'sam');
  expect(mine).toHaveLength(1);
  expect(mine[0].id).toBe(ideaCacheId('sam', 'general', 'on-device', ['cooking'], { years: 6, band: 'kid' }));
  expect(mine[0].id).not.toBe(staleId);
  expect(next.ideas.some(item => item.id === staleId || item.id === cloudId)).toBe(false);
  expect(next.ideas.some(item => item.personId === 'ada')).toBe(true);
  expect(mine[0].ideas.some(idea => /building set|art kit|picture book|outdoor play|toy or kit|book they can grow/i.test(idea.title))).toBe(true);
  expect(mine[0].ideas.some(idea => /skillet|card game|pet portrait|paper, pens/i.test(idea.title))).toBe(false);
});

test('changing interests replaces the cached list with ideas for the new tags', () => {
  const staleId = ideaCacheId('sam', 'general', 'on-device', ['cooking'], { years: 36, band: 'adult' });
  const before = snapshot(
    [person({ tags: ['books'], birthYear: 1990 })],
    [{
      id: staleId,
      personId: 'sam',
      occasionKey: 'general',
      ideas: [gift('A nice skillet or Dutch oven')],
      source: 'on-device',
      salt: 1,
      generatedAt: 1,
      updatedAt: 1,
    }],
  );
  const next = refreshLocalIdeas(before, 'sam', 9, today);
  const mine = next.ideas.filter(item => item.personId === 'sam');
  expect(mine).toHaveLength(1);
  expect(mine[0].id).toBe(ideaCacheId('sam', 'general', 'on-device', ['books'], { years: 36, band: 'adult' }));
  expect(next.ideas.some(item => item.id === staleId)).toBe(false);
  expect(mine[0].ideas.some(idea => /book|reading|novel|bookmark/i.test(idea.title))).toBe(true);
  expect(mine[0].ideas.some(idea => /skillet/i.test(idea.title))).toBe(false);
});
