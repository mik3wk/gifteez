import { nextOccasionDate, occasionLabel } from './logic';
import type { Occasion, Person } from './types';

export type ReminderKind = 'week' | 'day';

export type ReminderSlot = {
  id: string;
  at: number;
  kind: ReminderKind;
  personName: string;
  personId: string;
  occasionName: string;
  occasionType: Occasion['type'];
  occasionId: string;
};

function atHour(date: Date, hour: number, minute: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), hour, minute, 0, 0);
}

function daysBefore(date: Date, days: number, hour: number, minute: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() - days, hour, minute, 0, 0);
}

/** Day-of and one week before, at 9:00 local. Past times are skipped. */
export function planReminders(input: {
  people: Person[];
  occasions: Occasion[];
  now: Date;
  enabled: boolean;
  leadDays?: number;
  hour?: number;
  minute?: number;
}): ReminderSlot[] {
  if (!input.enabled) {
    return [];
  }
  const slots: ReminderSlot[] = [];
  const now = input.now.getTime();
  const leadDays = input.leadDays != null && input.leadDays >= 0 ? input.leadDays : 7;
  const hour = input.hour != null && input.hour >= 0 && input.hour <= 23 ? input.hour : 9;
  const minute = input.minute != null && input.minute >= 0 && input.minute <= 59 ? Math.round(input.minute) : 0;
  input.occasions.filter(occasion => !occasion.deleted).forEach(occasion => {
    const person = input.people.find(item => item.id === occasion.personId && !item.deleted);
    if (!person) {
      return;
    }
    const when = nextOccasionDate(occasion, input.now);
    if (!when) {
      return;
    }
    const year = when.getFullYear();
    const candidates: Array<{ kind: ReminderKind; at: Date }> = [
      { kind: 'week', at: daysBefore(when, leadDays, hour, minute) },
      { kind: 'day', at: atHour(when, hour, minute) },
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
        personId: person.id,
        occasionName: occasionLabel(occasion),
        occasionType: occasion.type,
        occasionId: occasion.id,
      });
    });
  });
  return slots.sort((a, b) => a.at - b.at || a.id.localeCompare(b.id));
}
