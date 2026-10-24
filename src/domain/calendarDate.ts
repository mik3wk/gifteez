const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** yyyy-mm-dd from the local calendar, never from a UTC instant. */
export function localIso(date = new Date()): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Parse a stored calendar date in local time. `new Date('yyyy-mm-dd')` is UTC midnight and shifts the day. */
export function parseLocalDate(value: string): Date | null {
  const match = DATE_ONLY.exec(value.trim());
  if (!match) {
    return null;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }
  return date;
}

/**
 * Calendar month and day from a stored date or a calendar-event string.
 * A date-only value, or midnight UTC (how all-day events are often written), keeps the written day.
 * A real timestamp uses the local calendar day.
 */
export function monthDayFromStored(value: string): { month: number; day: number } | undefined {
  const trimmed = value.trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})(.*)$/.exec(trimmed);
  if (!match) {
    return undefined;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const rest = match[4];
  const dateOnly = rest === '' || /^T00:00:00(?:\.0+)?Z$/.test(rest);
  if (dateOnly) {
    const date = new Date(year, month - 1, day);
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
      return undefined;
    }
    return { month, day };
  }
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }
  return { month: parsed.getMonth() + 1, day: parsed.getDate() };
}

/** Store a calendar field as local yyyy-mm-dd. */
export function normalizeStoredDate(value: string, fallback = new Date()): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return localIso(fallback);
  }
  const direct = parseLocalDate(trimmed);
  if (direct) {
    return localIso(direct);
  }
  const parts = monthDayFromStored(trimmed);
  if (!parts) {
    return localIso(fallback);
  }
  const yearMatch = /^(\d{4})/.exec(trimmed);
  const year = yearMatch ? Number(yearMatch[1]) : fallback.getFullYear();
  return localIso(new Date(year, parts.month - 1, parts.day));
}
