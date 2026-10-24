import { CommonActions } from '@react-navigation/native';

export type RootStack = {
  FirstOpen: undefined;
  Home: undefined;
  People: undefined;
  Person: { personId: string; section?: 'ideas' | 'occasions' | 'history' };
  AddPerson: undefined;
  Fairness: undefined;
  Settings: undefined;
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
