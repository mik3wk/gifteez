import { CommonActions } from '@react-navigation/native';

export type RootStack = {
  FirstOpen: undefined;
  Home: undefined;
  People: undefined;
  Person: { personId: string; section?: 'ideas' | 'occasions' | 'history' };
  AddPerson: undefined;
  Fairness: undefined;
  Settings: undefined;
  ThemeGallery: undefined;
};

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
