import { CommonActions } from '@react-navigation/native';

export type RootStack = {
  FirstOpen: undefined;
  Join: undefined;
  JoinConfirm: { url: string };
  People: undefined;
  Person: { personId: string };
  SamePerson: { personId: string; sourcePersonId?: string; sourceGroupId?: string };
  AddPerson: undefined;
  Fairness: undefined;
  Group: undefined;
  Settings: undefined;
};

export const TAB_ROUTES = ['People', 'Fairness', 'Group', 'Settings'] as const;
export type TabRoute = (typeof TAB_ROUTES)[number];

/** Tabs are stack routes. Replace the stack so a switch does not push or swipe back. */
export function openTab(
  navigation: { dispatch: (action: ReturnType<typeof CommonActions.reset>) => void },
  route: TabRoute,
) {
  navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: route }] }));
}
