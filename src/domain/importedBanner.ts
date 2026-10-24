export type ImportedVisit = { id: string; show: boolean };

/**
 * The first paint of an imported person still has opened false. focusPerson
 * then marks them opened, so a render that reads the live flag never stays.
 * Remember the first sight of this id and keep it for the rest of the visit.
 */
export function importedVisitBanner(
  previous: ImportedVisit | null,
  person: { id: string; imported: boolean; opened: boolean } | undefined,
): ImportedVisit | null {
  if (!person) {
    return previous;
  }
  if (previous?.id === person.id) {
    return previous;
  }
  return { id: person.id, show: person.imported && !person.opened };
}
