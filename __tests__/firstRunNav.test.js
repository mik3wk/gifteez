const fs = require('fs');
const path = require('path');
const { CommonActions, StackRouter } = require('@react-navigation/routers');
const { cancelAddAction, FIRST_RUN_ROUTES, homeTabReset, MAIN_ROUTES, routeAfterFirstPeople } = require('../src/app/navigation');

function routerOptions(routeNames) {
  return {
    routeNames: [...routeNames],
    routeParamList: {},
    routeGetIdList: {},
    routeKeyChanges: [],
  };
}

test('a first-run contacts import lands on Home and Cancel is not an unhandled GO_BACK', () => {
  const source = fs.readFileSync(path.join(__dirname, '../src/app/ReadyApp.tsx'), 'utf8');
  expect(source).toContain('name="FirstAddPerson"');
  expect(source.match(/name="AddPerson"/g)).toHaveLength(1);
  expect(FIRST_RUN_ROUTES).toEqual(['FirstOpen', 'FirstAddPerson']);

  const welcome = StackRouter({});
  const firstOptions = routerOptions(FIRST_RUN_ROUTES);
  const started = welcome.getInitialState(firstOptions);
  const adding = welcome.getStateForAction(started, CommonActions.navigate('FirstAddPerson'), firstOptions);
  expect(adding.routes.map(route => route.name)).toEqual(['FirstOpen', 'FirstAddPerson']);

  expect(routeAfterFirstPeople({
    previousPeople: 0,
    nextPeople: 2,
    routes: adding.routes,
  })).toEqual({ type: 'reset', ...homeTabReset() });

  const mainOptions = routerOptions(MAIN_ROUTES);
  const swapped = welcome.getStateForRouteNamesChange(adding, {
    routeNames: [...MAIN_ROUTES],
    routeParamList: {},
    routeGetIdList: {},
    routeKeyChanges: [],
  });
  expect(swapped.routes.map(route => route.name)).toEqual(['Home']);
  const home = welcome.getStateForAction(swapped, CommonActions.reset(homeTabReset()), mainOptions);
  expect(home.index).toBe(0);
  expect(home.routes.map(route => route.name)).toEqual(['Home']);

  const sharedNames = ['FirstOpen', 'AddPerson'];
  const sharedOptions = routerOptions(sharedNames);
  const shared = StackRouter({});
  const onAdd = shared.getStateForAction(
    shared.getInitialState(sharedOptions),
    CommonActions.navigate('AddPerson'),
    sharedOptions,
  );
  const collapsed = shared.getStateForRouteNamesChange(onAdd, {
    routeNames: [...MAIN_ROUTES],
    routeParamList: {},
    routeGetIdList: {},
    routeKeyChanges: [],
  });
  expect(collapsed.routes.map(route => route.name)).toEqual(['AddPerson']);
  expect(collapsed.index).toBe(0);
  expect(shared.getStateForAction(collapsed, CommonActions.goBack(), mainOptions)).toBeNull();

  const cancel = cancelAddAction(collapsed.index > 0);
  expect(cancel.type).toBe('RESET');
  const afterCancel = shared.getStateForAction(collapsed, cancel, mainOptions);
  expect(afterCancel.routes.map(route => route.name)).toEqual(['Home']);
  expect(afterCancel.index).toBe(0);

  expect(routeAfterFirstPeople({
    previousPeople: 0,
    nextPeople: 2,
    routes: collapsed.routes,
  })).toEqual({ type: 'reset', ...homeTabReset() });
  expect(routeAfterFirstPeople({
    previousPeople: 0,
    nextPeople: 2,
    routes: [{ name: 'Home' }],
  })).toEqual({ type: 'stay' });
});
