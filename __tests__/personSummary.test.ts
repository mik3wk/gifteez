import { initialPersonSection, summaryPrimary, summaryPrimaryLabel } from '../src/screens/personSummary';

test('the person summary primary follows the occasion, and a soon date opens Occasions', () => {
  expect(initialPersonSection(0)).toBe('occasions');
  expect(initialPersonSection(7)).toBe('occasions');
  expect(initialPersonSection(8)).toBe('ideas');
  expect(initialPersonSection(null)).toBe('ideas');
  const base = {
    hidden: false,
    locked: false,
    hasOccasion: true,
    purchased: false,
    claimedByMe: false,
    claimedByOther: false,
    savedIdea: false,
  };
  expect(summaryPrimary({ ...base, hasOccasion: false })).toBe('add');
  expect(summaryPrimary(base)).toBe('find');
  expect(summaryPrimary({ ...base, savedIdea: true })).toBe('log');
  expect(summaryPrimary({ ...base, claimedByMe: true })).toBe('find');
  expect(summaryPrimary({ ...base, purchased: true })).toBe('logged');
  expect(summaryPrimary({ ...base, claimedByOther: true, savedIdea: false })).toBe('find');
  expect(summaryPrimary({ ...base, hidden: true })).toBeNull();
});

test('the People hero and the person summary use one label for the same state', () => {
  const base = {
    hidden: false,
    locked: false,
    hasOccasion: true,
    purchased: false,
    claimedByMe: false,
    claimedByOther: false,
    savedIdea: false,
  };
  const words: Record<string, string> = {
    add: 'Add occasion',
    find: 'Find a gift',
    log: 'Log purchase',
    logged: 'Logged ✓',
  };
  const cases = [
    base,
    { ...base, hasOccasion: false },
    { ...base, savedIdea: true },
    { ...base, claimedByMe: true, savedIdea: true },
    { ...base, purchased: true },
    { ...base, claimedByOther: true, savedIdea: true },
    { ...base, hidden: true, savedIdea: true },
    { ...base, locked: true },
  ];
  cases.forEach(input => {
    const action = summaryPrimary(input);
    expect(summaryPrimaryLabel(input)).toBe(action ? words[action] : null);
  });
  expect(summaryPrimaryLabel({ ...base, savedIdea: true })).toBe('Log purchase');
  expect(summaryPrimaryLabel(base)).toBe('Find a gift');
});
