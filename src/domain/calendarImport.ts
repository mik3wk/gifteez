import { monthDayFromStored } from './calendarDate';
import { t } from '../i18n';

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
  /** This person already has this occasion. */
  alreadyAdded?: boolean;
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

/** Someone already on the list starts selected when the occasion is new.
 *  People who are not on the list start off, as do unclear titles and occasions already stored. */
export function initiallyChosen(draft: {
  name: string;
  nameEditable?: boolean;
  alreadyAdded?: boolean;
  personId?: string | null;
}): boolean {
  return !draft.alreadyAdded && !draft.nameEditable && Boolean(draft.personId) && Boolean(draft.name.trim());
}

/** New names count once. Every selected row is an occasion. */
export function calendarSelection(drafts: Array<{ name: string; personId: string | null; alreadyAdded?: boolean }>): {
  people: number;
  occasions: number;
} {
  const names = new Set<string>();
  let occasions = 0;
  drafts.forEach(draft => {
    if (draft.alreadyAdded) {
      return;
    }
    const name = draft.name.trim().toLowerCase();
    if (!name) {
      return;
    }
    occasions += 1;
    if (!draft.personId) {
      names.add(name);
    }
  });
  return { people: names.size, occasions };
}

export function calendarAddLabel(people: number, occasions: number): string {
  if (people > 0 && occasions > 0) {
    const peopleText = people === 1
      ? t('importFlow.onePerson', { count: people })
      : t('importFlow.manyPeople', { count: people });
    const occasionsText = occasions === 1
      ? t('importFlow.oneOccasion', { count: occasions })
      : t('importFlow.manyOccasions', { count: occasions });
    return t('importFlow.addBoth', { people: peopleText, occasions: occasionsText });
  }
  if (people > 0) {
    return people === 1 ? t('importFlow.addPersonOne') : t('importFlow.addPersonMany', { count: people });
  }
  return occasions === 1 ? t('importFlow.addOne') : t('importFlow.addMany', { count: occasions });
}

export function draftStatus(draft: {
  name: string;
  personId: string | null;
  alreadyAdded?: boolean;
}): 'alreadyAdded' | 'addName' | 'matched' | 'newPerson' {
  if (draft.alreadyAdded) {
    return 'alreadyAdded';
  }
  if (!draft.name.trim()) {
    return 'addName';
  }
  return draft.personId ? 'matched' : 'newPerson';
}

export function draftsFromEvents(
  events: Array<{ title?: string | null; startDate?: string | null }>,
  people: Array<{ id: string; name: string; deleted?: boolean }>,
  occasions: Array<{ personId: string; type: string; month: number; day: number; deleted?: boolean }> = [],
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
    const alreadyAdded = Boolean(match && occasions.some(item => (
      !item.deleted
      && item.personId === match.id
      && item.type === draft.occasion
      && item.month === draft.month
      && item.day === draft.day
    )));
    drafts.push({
      ...draft,
      key,
      personId: match?.id ?? null,
      ...(alreadyAdded ? { alreadyAdded: true } : {}),
    });
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
