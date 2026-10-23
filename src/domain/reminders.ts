import { dateInYear, isOneTimeOccasion, nextOccurrence } from './logic';
import type { Occasion, Person } from './types';

export type ReminderKind = 'week' | 'day';

export type ReminderSlot = {
  id: string;
  at: number;
  kind: ReminderKind;
  personName: string;
  occasionType: Occasion['type'];
  occasionId: string;
};

function atMorning(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 9, 0, 0, 0);
}

function daysBefore(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() - days, 9, 0, 0, 0);
}

/** Day-of and one week before, at 9:00 local. Past times are skipped. */
export function planReminders(input: {
  people: Person[];
  occasions: Occasion[];
  now: Date;
  enabled: boolean;
}): ReminderSlot[] {
  if (!input.enabled) {
    return [];
  }
  const slots: ReminderSlot[] = [];
  const now = input.now.getTime();
  input.occasions.filter(occasion => !occasion.deleted).forEach(occasion => {
    const person = input.people.find(item => item.id === occasion.personId && !item.deleted);
    if (!person) {
      return;
    }
    let when: Date;
    if (isOneTimeOccasion(occasion)) {
      const year = occasion.year && occasion.year > 0 ? occasion.year : input.now.getFullYear();
      when = dateInYear(occasion.month, occasion.day, year);
      if (when.getTime() < new Date(input.now.getFullYear(), input.now.getMonth(), input.now.getDate()).getTime()) {
        return;
      }
    } else {
      when = nextOccurrence(occasion.month, occasion.day, input.now);
    }
    const year = when.getFullYear();
    const candidates: Array<{ kind: ReminderKind; at: Date }> = [
      { kind: 'week', at: daysBefore(when, 7) },
      { kind: 'day', at: atMorning(when) },
    ];
    candidates.forEach(candidate => {
      if (candidate.at.getTime() <= now) {
        return;
      }
      slots.push({
        id: `gifteez-${occasion.id}-${year}-${candidate.kind}`,
        at: candidate.at.getTime(),
        kind: candidate.kind,
        personName: person.name,
        occasionType: occasion.type,
        occasionId: occasion.id,
      });
    });
  });
  return slots.sort((a, b) => a.at - b.at || a.id.localeCompare(b.id));
}
