import { importedVisitBanner } from '../src/domain/importedBanner';

test('the imported banner stays for the first visit and is gone the next time', () => {
  const first = importedVisitBanner(null, { id: 'ada', imported: true, opened: false });
  expect(first).toEqual({ id: 'ada', show: true });
  expect(importedVisitBanner(first, { id: 'ada', imported: true, opened: true })).toBe(first);
  expect(importedVisitBanner(null, { id: 'ada', imported: true, opened: true })).toEqual({ id: 'ada', show: false });
  expect(importedVisitBanner(first, { id: 'bea', imported: false, opened: true })).toEqual({ id: 'bea', show: false });
});
