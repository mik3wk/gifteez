export type ImportedVisit = { id: string; show: boolean };

/**
 * Show the imported hint only until this person has been opened.
 * The first paint can still see opened false. Once focus marks them opened, the hint goes away.
 */
export function importedVisitBanner(
  previous: ImportedVisit | null,
  person: { id: string; imported: boolean; opened: boolean } | undefined,
): ImportedVisit | null {
  if (!person) {
    return previous;
  }
  if (!person.imported || person.opened) {
    return { id: person.id, show: false };
  }
  if (previous?.id === person.id) {
    return previous;
  }
  return { id: person.id, show: true };
}
