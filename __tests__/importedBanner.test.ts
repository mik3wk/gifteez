import { importedVisitBanner } from '../src/domain/importedBanner';

test('the imported hint hides once the person has been opened', () => {
  const first = importedVisitBanner(null, { id: 'ada', imported: true, opened: false });
  expect(first).toEqual({ id: 'ada', show: true });
  expect(importedVisitBanner(first, { id: 'ada', imported: true, opened: true })).toEqual({ id: 'ada', show: false });
  expect(importedVisitBanner(null, { id: 'ada', imported: true, opened: true })).toEqual({ id: 'ada', show: false });
  expect(importedVisitBanner(first, { id: 'bea', imported: false, opened: true })).toEqual({ id: 'bea', show: false });
});
