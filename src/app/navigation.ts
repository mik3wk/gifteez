import { CommonActions } from '@react-navigation/native';
import { t } from '../i18n';

export type RootStack = {
  FirstOpen: undefined;
  /** First-run add. A separate name so it is not kept when the main stack replaces welcome. */
  FirstAddPerson: undefined;
  Home: undefined;
  People: undefined;
  Person: { personId: string; section?: 'ideas' | 'occasions' | 'history' };
  AddPerson: undefined;
  Fairness: undefined;
  Settings: undefined;
  ThemeGallery: undefined;
};

export const FIRST_RUN_ROUTES = ['FirstOpen', 'FirstAddPerson'] as const;
export const MAIN_ROUTES = ['Home', 'People', 'Person', 'AddPerson', 'Fairness', 'Settings', 'ThemeGallery'] as const;

export function homeTabReset() {
  return { index: 0 as const, routes: [{ name: 'Home' as const }] };
}

/** The person screen names the screen underneath. Fairness stays Fairness. */
export function personBackLabel(previousName?: string): string {
  if (previousName === 'Home') {
    return t('people.home');
  }
  if (previousName === 'Fairness') {
    return t('people.fairness');
  }
  return t('people.title');
}

/** Cancel leaves the add screen. With nothing underneath, it opens Home instead of an unhandled GO_BACK. */
export function cancelAddAction(canGoBack: boolean) {
  if (canGoBack) {
    return CommonActions.goBack();
  }
  return CommonActions.reset(homeTabReset());
}

/**
 * The first person added from welcome replaces that stack with Home.
 * A lone AddPerson route is the regression where welcome and main shared one name.
 */
export function routeAfterFirstPeople(input: {
  previousPeople: number;
  nextPeople: number;
  routes: Array<{ name: string }>;
}): { type: 'stay' } | ReturnType<typeof homeTabReset> & { type: 'reset' } {
  if (!(input.previousPeople === 0 && input.nextPeople > 0)) {
    return { type: 'stay' };
  }
  const names = input.routes.map(route => route.name);
  const welcome = names.some(name => (FIRST_RUN_ROUTES as readonly string[]).includes(name));
  const loneAdd = names.length > 0 && names.every(name => name === 'AddPerson' || name === 'FirstAddPerson');
  if (!welcome && !loneAdd) {
    return { type: 'stay' };
  }
  return { type: 'reset', ...homeTabReset() };
}

export const TAB_ROUTES = ['Home', 'People', 'Fairness', 'Settings'] as const;
export type TabRoute = (typeof TAB_ROUTES)[number];

/** Tabs are stack routes. Replace the stack so a switch does not push or swipe back. */
export function openTab(
  navigation: { dispatch: (action: ReturnType<typeof CommonActions.reset>) => void },
  route: TabRoute,
) {
  navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: route }] }));
}

/** People list under the person, so the first save can go back. */
export function peopleThenPerson(personId: string) {
  return {
    index: 1 as const,
    routes: [
      { name: 'People' as const },
      { name: 'Person' as const, params: { personId, section: 'ideas' as const } },
    ],
  };
}
