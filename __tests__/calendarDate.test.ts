import { monthDayFromStored, normalizeStoredDate, parseLocalDate } from '../src/domain/calendarDate';
import { giftYear, nextOccurrence } from '../src/domain/logic';
import { planReminders } from '../src/domain/reminders';
import { formatStoredDate } from '../src/i18n';
import type { Occasion, Person } from '../src/domain/types';

const proc = (globalThis as unknown as {
  process: { env: Record<string, string | undefined>; execPath: string; cwd: () => string };
}).process;
const env = proc.env;

function person(): Person {
  return { id: 'ada', name: 'Ada', budgetCents: null, tags: [], imported: false, opened: true, createdAt: 1, updatedAt: 1 };
}

function birthday(): Occasion {
  return { id: 'bday', personId: 'ada', type: 'birthday', month: 10, day: 23, updatedAt: 1 };
}

if (env.GIFTEEZ_DATE_PROBE === '1') {
  test('calendar dates keep the written day in this process zone', () => {
    if (env.TZ === 'America/New_York') {
      expect(new Date('2026-10-23').getDate()).toBe(22);
      expect(new Date('2026-01-01').getFullYear()).toBe(2025);
      const local = parseLocalDate('2026-10-23');
      expect(local?.getFullYear()).toBe(2026);
      expect(local?.getMonth()).toBe(9);
      expect(local?.getDate()).toBe(23);
      expect(formatStoredDate('2026-10-23')).toContain('23');
      expect(formatStoredDate('2026-10-23')).not.toContain('22');
      expect(normalizeStoredDate('2026-10-23')).toBe('2026-10-23');
      expect(monthDayFromStored('2026-10-23')).toEqual({ month: 10, day: 23 });
      expect(monthDayFromStored('2026-10-23T00:00:00.000Z')).toEqual({ month: 10, day: 23 });
      expect(monthDayFromStored('2026-10-23T03:30:00Z')).toEqual({ month: 10, day: 22 });
      expect(giftYear({ purchasedOn: '2026-01-01', updatedAt: Date.parse('2026-01-01T00:00:00Z') })).toBe(2026);
      const next = nextOccurrence(1, 1, new Date(2026, 11, 31, 23, 30, 0));
      expect(next.getFullYear()).toBe(2027);
      expect(next.getMonth()).toBe(0);
      expect(next.getDate()).toBe(1);
      const slots = planReminders({
        people: [person()],
        occasions: [birthday()],
        now: new Date(2026, 9, 1, 8, 0, 0),
        enabled: true,
      });
      const at = new Date(slots.find(slot => slot.kind === 'day')?.at ?? 0);
      expect(at.getFullYear()).toBe(2026);
      expect(at.getMonth()).toBe(9);
      expect(at.getDate()).toBe(23);
      expect(at.getHours()).toBe(9);
      return;
    }
    expect(env.TZ).toBe('Pacific/Kiritimati');
    expect(new Date('2026-10-23').getDate()).toBe(23);
    expect(parseLocalDate('2026-10-23')?.getDate()).toBe(23);
    expect(monthDayFromStored('2026-10-23T12:00:00Z')).toEqual({ month: 10, day: 24 });
    expect(normalizeStoredDate('2026-10-23T12:00:00Z')).toBe('2026-10-24');
  });
} else {
  test('calendar dates stay on the written day outside UTC', () => {
    const { spawnSync } = require('node:child_process') as {
      spawnSync: (
        command: string,
        args: string[],
        options: { cwd: string; env: Record<string, string | undefined>; encoding: 'utf8' },
      ) => { status: number | null; stdout: string; stderr: string };
    };
    const path = require('node:path') as { join: (...parts: string[]) => string };
    const root = proc.cwd();
    const jestBin = path.join(root, 'node_modules/jest/bin/jest.js');
    const testFile = path.join(root, '__tests__/calendarDate.test.ts');
    for (const zone of ['America/New_York', 'Pacific/Kiritimati']) {
      const result = spawnSync(proc.execPath, [
        jestBin,
        testFile,
        '--watchman=false',
        '--forceExit',
        '--runInBand',
      ], {
        cwd: root,
        env: { ...env, TZ: zone, GIFTEEZ_DATE_PROBE: '1' },
        encoding: 'utf8',
      });
      if (result.status !== 0) {
        throw new Error(result.stdout + result.stderr);
      }
    }
  });
}
