import { initialPersonSection, summaryPrimary } from '../src/screens/personSummary';

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
  expect(summaryPrimary({ ...base, savedIdea: true })).toBe('claim');
  expect(summaryPrimary({ ...base, claimedByMe: true })).toBe('log');
  expect(summaryPrimary({ ...base, purchased: true })).toBe('logged');
  expect(summaryPrimary({ ...base, claimedByOther: true })).toBeNull();
  expect(summaryPrimary({ ...base, hidden: true })).toBeNull();
});
