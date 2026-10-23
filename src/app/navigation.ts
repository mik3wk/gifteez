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
