import Contacts from 'react-native-contacts';
import CalendarEvents from 'react-native-calendar-events';
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
    const when = new Date(event.startDate);
    people.push({
      name,
      budgetCents: null,
      month: Number.isNaN(when.getTime()) ? undefined : when.getMonth() + 1,
      day: Number.isNaN(when.getTime()) ? undefined : when.getDate(),
      tags: [],
    });
  });
  return people;
}
