import { draftsFromEvents, eventDraft, initiallyChosen } from '../src/domain/calendarImport';

test('calendar titles become occasions and other events are ignored', () => {
  expect(eventDraft("Ada's birthday", '2026-04-02')).toMatchObject({
    name: 'Ada',
    occasion: 'birthday',
    month: 4,
    day: 2,
  });
  expect(eventDraft('Birthday: Sam', '2026-04-02T00:00:00.000Z')).toMatchObject({
    name: 'Sam',
    occasion: 'birthday',
    month: 4,
    day: 2,
  });
  expect(eventDraft("Mom's anniversary", '2026-06-01')).toMatchObject({
    name: 'Mom',
    occasion: 'anniversary',
    month: 6,
    day: 1,
  });
  expect(eventDraft('Alex wedding', '2026-09-12')).toMatchObject({
    name: 'Alex',
    occasion: 'wedding',
    month: 9,
    day: 12,
  });
  expect(eventDraft('Dentist', '2026-04-02')).toBeNull();
  expect(eventDraft('Anniversary', '2026-04-02')).toMatchObject({
    name: '',
    occasion: 'anniversary',
    nameEditable: true,
  });
  expect(eventDraft('Birthday', '2026-04-02')).toMatchObject({
    name: '',
    occasion: 'birthday',
    nameEditable: true,
  });
});

test('calendar names drop the age and keep titles that will not parse', () => {
  expect(eventDraft('Kate Bell’s 49th', '2026-03-01')).toMatchObject({
    name: 'Kate Bell',
    occasion: 'birthday',
  });
  expect(eventDraft("David Taylor's 29th", '2026-03-02')).toMatchObject({
    name: 'David Taylor',
    occasion: 'birthday',
  });
  expect(eventDraft('Zoe (49)', '2026-03-03')).toMatchObject({ name: 'Zoe', occasion: 'birthday' });
  expect(eventDraft("Sam's 12th birthday", '2026-03-04')).toMatchObject({ name: 'Sam', occasion: 'birthday' });
  expect(eventDraft('Birthday – Zoe', '2026-03-05')).toMatchObject({ name: 'Zoe', occasion: 'birthday' });
  expect(eventDraft('Test Birthday Zoe', '2026-03-06')).toMatchObject({ name: 'Test Zoe', occasion: 'birthday' });
  expect(eventDraft('Zoe Bday', '2026-03-07')).toMatchObject({ name: 'Zoe', occasion: 'birthday' });
  expect(eventDraft('Anniversary: X & Y', '2026-03-08')).toMatchObject({
    name: 'X & Y',
    occasion: 'anniversary',
  });
  expect(eventDraft('49th birthday', '2026-03-09')?.nameEditable).toBe(true);
  expect(eventDraft('49th birthday', '2026-03-09')?.name).toBe('');
  expect(eventDraft('Birthday Test', '2026-03-10')).toMatchObject({ name: 'Test', occasion: 'birthday' });
});

test('drafts match a living person and collapse the same date', () => {
  const drafts = draftsFromEvents([
    { title: "Ada's birthday", startDate: '2026-04-02' },
    { title: "ada's birthday", startDate: '2026-04-02' },
    { title: "Bea's anniversary", startDate: '2026-06-01' },
    { title: 'Team meeting', startDate: '2026-06-01' },
  ], [
    { id: 'ada', name: 'Ada' },
    { id: 'gone', name: 'Bea', deleted: true },
  ]);
  expect(drafts.map(item => [item.name, item.occasion, item.personId])).toEqual([
    ['Ada', 'birthday', 'ada'],
    ['Bea', 'anniversary', null],
  ]);
  const birthday = eventDraft('Birthday', '2026-05-01');
  const named = eventDraft("Ada's birthday", '2026-05-02');
  expect(initiallyChosen(birthday!)).toBe(false);
  expect(initiallyChosen(named!)).toBe(true);
});
