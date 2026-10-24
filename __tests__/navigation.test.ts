import { peopleThenPerson } from '../src/app/navigation';

test('the first person opens with People underneath', () => {
  expect(peopleThenPerson('ada')).toEqual({
    index: 1,
    routes: [
      { name: 'People' },
      { name: 'Person', params: { personId: 'ada', section: 'ideas' } },
    ],
  });
});
