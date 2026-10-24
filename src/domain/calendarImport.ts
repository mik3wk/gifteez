import { monthDayFromStored } from './calendarDate';

export type CalendarOccasion = 'birthday' | 'anniversary' | 'wedding';

export type CalendarDraft = {
  key: string;
  name: string;
  month: number;
  day: number;
  occasion: CalendarOccasion;
  title: string;
  personId: string | null;
  /** The title matched an occasion, but the name could not be split out. */
  nameEditable?: boolean;
};

const ORDINAL = String.raw`\d{1,3}(?:st|nd|rd|th)`;
const BIRTHDAY_WORD = String.raw`birthdays?|b-?days?`;
const ANNIVERSARY_WORD = String.raw`anniversar(?:y|ies)`;
const WEDDING_WORD = String.raw`weddings?`;

/** Pull a person and an occasion out of a calendar title. Other events are ignored. */
export function eventDraft(title: string, start: string): Omit<CalendarDraft, 'key' | 'personId'> | null {
  const cleaned = title.trim().replace(/\s+/g, ' ');
  const dated = monthDayFromStored(start);
  if (!cleaned || !dated) {
    return null;
  }
  const occasion = occasionOf(cleaned);
  if (!occasion) {
    return null;
  }
  const parsed = extractName(cleaned, occasion);
  return {
    name: parsed.name,
    month: dated.month,
    day: dated.day,
    occasion,
    title: cleaned,
    ...(parsed.editable ? { nameEditable: true } : {}),
  };
}

/** Clear names start selected. Unclear titles, including a bare "Birthday", start off. */
export function initiallyChosen(draft: { name: string; nameEditable?: boolean }): boolean {
  return !draft.nameEditable && Boolean(draft.name.trim());
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
    const identity = draft.name.trim()
      ? draft.name.trim().toLowerCase()
      : `untitled:${draft.title.toLowerCase()}`;
    const key = `${identity}|${draft.occasion}|${draft.month}|${draft.day}`;
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    const match = draft.nameEditable
      ? null
      : living.find(person => person.name.trim().toLowerCase() === draft.name.toLowerCase());
    drafts.push({ ...draft, key, personId: match?.id ?? null });
  });
  return drafts;
}

function occasionOf(title: string): CalendarOccasion | null {
  if (/anniversary/i.test(title)) {
    return 'anniversary';
  }
  if (/wedding/i.test(title)) {
    return 'wedding';
  }
  if (/birthday|b-?day/i.test(title) || looksLikeAge(title)) {
    return 'birthday';
  }
  return null;
}

function looksLikeAge(title: string): boolean {
  if (new RegExp(String.raw`['’]s\s*${ORDINAL}\b`, 'i').test(title)) {
    return true;
  }
  if (new RegExp(String.raw`\b${ORDINAL}\s+birthdays?\b`, 'i').test(title)) {
    return true;
  }
  const paren = /\((\d{1,3})\)/.exec(title);
  if (!paren) {
    return false;
  }
  const age = Number(paren[1]);
  return age >= 1 && age <= 120;
}

function stripAge(title: string): string {
  return title
    .replace(new RegExp(String.raw`['’]s\s*${ORDINAL}(?:\s+birthdays?)?`, 'ig'), '')
    .replace(new RegExp(String.raw`\b${ORDINAL}\s+birthdays?\b`, 'ig'), '')
    .replace(/\s*\(\s*\d{1,3}\s*\)\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function wordFor(occasion: CalendarOccasion): string {
  if (occasion === 'anniversary') {
    return ANNIVERSARY_WORD;
  }
  if (occasion === 'wedding') {
    return WEDDING_WORD;
  }
  return BIRTHDAY_WORD;
}

function extractName(title: string, occasion: CalendarOccasion): { name: string; editable: boolean } {
  const stripped = stripAge(title);
  const word = wordFor(occasion);
  const withoutOccasion = tidy(stripped.replace(new RegExp(String.raw`\b(?:${word})\b`, 'ig'), ' '));
  const possessive = /^(.*?)['’]s$/i.exec(withoutOccasion);
  const name = tidy(possessive?.[1] ?? withoutOccasion);
  if (!name || isOccasionWord(name)) {
    return { name: '', editable: true };
  }
  return { name, editable: false };
}

function tidy(value: string): string {
  return value.replace(/^[\s\-–—:]+|[\s\-–—:]+$/g, '').replace(/\s+/g, ' ').trim();
}

function isOccasionWord(name: string): boolean {
  return /^(?:birthday|b-?day|anniversary|anniversaries|wedding)s?$/i.test(name);
}
