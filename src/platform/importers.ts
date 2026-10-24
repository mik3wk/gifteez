import Contacts from 'react-native-contacts';
import CalendarEvents from 'react-native-calendar-events';
import { draftsFromEvents, type CalendarDraft } from '../domain/calendarImport';
import { monthDayFromStored } from '../domain/calendarDate';
import { birthdayNameFromTitle } from '../domain/logic';
import type { ImportedPerson } from '../domain/logic';

export async function importContacts(): Promise<ImportedPerson[] | 'denied'> {
  const permission = await Contacts.requestPermission();
  if (permission !== 'authorized' && permission !== 'limited') {
    return 'denied';
  }
  const contacts = await Contacts.getAllWithoutPhotos();
  return contacts.flatMap(contact => {
    const name = [contact.givenName, contact.familyName].filter(Boolean).join(' ').trim();
    if (!name) {
      return [];
    }
    const birthday = contact.birthday;
    const person: ImportedPerson = { name, budgetCents: null, tags: [] };
    if (birthday?.month != null) {
      person.month = birthday.month + 1;
    }
    if (birthday?.day != null) {
      person.day = birthday.day;
    }
    return [person];
  });
}

/** Read the next year of events. Nothing is written back to the calendar. */
export async function scanCalendar(people: Array<{ id: string; name: string; deleted?: boolean }>): Promise<CalendarDraft[] | 'denied'> {
  const permission = await CalendarEvents.requestPermissions(true);
  if (permission !== 'authorized') {
    return 'denied';
  }
  const start = new Date();
  const end = new Date();
  end.setMonth(end.getMonth() + 12);
  const events = await CalendarEvents.fetchAllEvents(start.toISOString(), end.toISOString());
  return draftsFromEvents(events, people);
}

export async function sweepBirthdays(): Promise<ImportedPerson[] | 'denied'> {
  const permission = await CalendarEvents.requestPermissions(true);
  if (permission !== 'authorized') {
    return 'denied';
  }
  const start = new Date();
  start.setMonth(start.getMonth() - 1);
  const end = new Date();
  end.setMonth(end.getMonth() + 18);
  const events = await CalendarEvents.fetchAllEvents(start.toISOString(), end.toISOString());
  const seen = new Set<string>();
  const people: ImportedPerson[] = [];
  events.forEach(event => {
    const name = birthdayNameFromTitle(event.title || '');
    if (!name) {
      return;
    }
    const key = name.toLowerCase();
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    const parts = monthDayFromStored(String(event.startDate ?? ''));
    people.push({
      name,
      budgetCents: null,
      month: parts?.month,
      day: parts?.day,
      tags: [],
    });
  });
  return people;
}
