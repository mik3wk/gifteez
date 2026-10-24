/** The main app is open once welcome is finished or any living person is on the list.
 *  The navigator reads this from the current snapshot, so a person added during
 *  first-run (contacts, calendar, or typed in) leaves the welcome immediately. */
export function mainAppOpen(snapshot: {
  profile: { onboarded: boolean };
  people: Array<{ deleted?: boolean }>;
}): boolean {
  return snapshot.profile.onboarded || snapshot.people.some(person => !person.deleted);
}
