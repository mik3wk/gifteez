import { monthDayFromStored } from './calendarDate';
import { birthdayNameFromTitle } from './logic';

export type CalendarOccasion = 'birthday' | 'anniversary' | 'wedding';

export type CalendarDraft = {
  key: string;
  name: string;
  month: number;
  day: number;
  occasion: CalendarOccasion;
  title: string;
  personId: string | null;
};

const OCCASION_WORD: Array<{ occasion: CalendarOccasion; pattern: RegExp }> = [
  { occasion: 'birthday', pattern: /birthday|b-?day/i },
  { occasion: 'anniversary', pattern: /anniversary/i },
  { occasion: 'wedding', pattern: /wedding/i },
];

/** Pull a person and an occasion out of a calendar title. Other events are ignored. */
export function eventDraft(title: string, start: string): Omit<CalendarDraft, 'key' | 'personId'> | null {
  const cleaned = title.trim();
  const dated = monthDayFromStored(start);
  if (!cleaned || !dated) {
    return null;
  }
  const kind = OCCASION_WORD.find(item => item.pattern.test(cleaned));
  if (!kind) {
    return null;
  }
  const birthday = kind.occasion === 'birthday' ? birthdayNameFromTitle(cleaned) : null;
  const possessive = /^(.*?)['’]s\s+(?:birthday|b-?day|anniversary|wedding)$/i.exec(cleaned);
  const leading = /^(?:birthday|b-?day|anniversary|wedding)[:\s-]+(.+)$/i.exec(cleaned);
  const trailing = /^(.+?)\s+(?:birthday|b-?day|anniversary|wedding)$/i.exec(cleaned);
  const name = (birthday || possessive?.[1] || leading?.[1] || trailing?.[1] || '').trim();
  if (!name || OCCASION_WORD.some(item => item.pattern.test(name) && name.split(/\s+/).length === 1)) {
    return null;
  }
  return {
    name,
    month: dated.month,
    day: dated.day,
    occasion: kind.occasion,
    title: cleaned,
  };
}

export function draftsFromEvents(
  events: Array<{ title?: string | null; startDate?: string | null }>,
  people: Array<{ id: string; name: string; deleted?: boolean }>,
): CalendarDraft[] {
  const living = people.filter(person => !person.deleted);
  const seen = new Set<string>();
  const drafts: CalendarDraft[] = [];
  events.forEach(event => {
    const draft = eventDraft(event.title ?? '', String(event.startDate ?? ''));
    if (!draft) {
      return;
    }
    const key = `${draft.name.toLowerCase()}|${draft.occasion}|${draft.month}|${draft.day}`;
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    const match = living.find(person => person.name.trim().toLowerCase() === draft.name.toLowerCase());
    drafts.push({ ...draft, key, personId: match?.id ?? null });
  });
  return drafts;
}
