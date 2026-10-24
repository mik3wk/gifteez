import { mainAppOpen } from '../src/domain/onboarding';

test('first-run finishes when any living person exists', () => {
  expect(mainAppOpen({ profile: { onboarded: false }, people: [] })).toBe(false);
  expect(mainAppOpen({ profile: { onboarded: true }, people: [] })).toBe(true);
  expect(mainAppOpen({
    profile: { onboarded: false },
    people: [{ deleted: true }],
  })).toBe(false);
  expect(mainAppOpen({
    profile: { onboarded: false },
    people: [{ deleted: true }, { deleted: false }],
  })).toBe(true);
  expect(mainAppOpen({
    profile: { onboarded: false },
    people: [{}],
  })).toBe(true);
});
