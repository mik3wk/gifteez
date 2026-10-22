export type OccasionType = 'birthday' | 'christmas' | 'wedding';
export type GiftStatus = 'not-started' | 'idea-saved' | 'purchased';
export type IdeaSource = 'on-device' | 'cloud';

export type Person = {
  id: string;
  name: string;
  budgetCents: number | null;
  tags: string[];
  imported: boolean;
  opened: boolean;
  createdAt: number;
  updatedAt: number;
  deleted?: boolean;
};

export type Occasion = {
  id: string;
  personId: string;
  type: OccasionType;
  month: number;
  day: number;
  year?: number;
  updatedAt: number;
  deleted?: boolean;
};

export type OccasionState = {
  id: string;
  occasionId: string;
  personId: string;
  year: number;
  status: GiftStatus;
  savedIdea: string | null;
  updatedAt: number;
  deleted?: boolean;
};

export type GiftRecord = {
  id: string;
  personId: string;
  occasionId: string;
  year: number;
  title: string;
  priceCents: number;
  purchasedOn: string;
  updatedAt: number;
  deleted?: boolean;
};

export type FeedbackEntry = {
  id: string;
  personId: string;
  idea: string;
  vote: 'up' | 'down';
  createdAt: number;
};

export type IdeaCacheEntry = {
  id: string;
  personId: string;
  occasionKey: string;
  ideas: string[];
  source: IdeaSource;
  salt: number;
  generatedAt: number;
  updatedAt: number;
  deleted?: boolean;
};

export type GroupMeta = {
  id: string;
  name: string;
  ownerId: string;
  memberIds: string[];
  peopleCount: number;
  entitled: boolean;
  updatedAt: number;
};

export type GroupSummary = {
  id: string;
  name: string;
  ownerId: string;
  memberIds: string[];
  memberNames: string[];
  updatedAt: number;
};

export type Member = {
  id: string;
  uid: string;
  displayName: string;
  updatedAt: number;
  deleted?: boolean;
};

export type Profile = {
  uid: string | null;
  displayName: string;
  nameLocked: boolean;
  createdAt: number;
  upgraded: boolean;
  upgradeBannerDismissed: boolean;
  onboarded: boolean;
  groupId: string | null;
  pendingEmail: string | null;
  pendingVerificationId: string | null;
  inviteId: string | null;
};

export type DirtyMap = Record<string, true>;

export type GroupArchive = {
  group: GroupMeta;
  members: Member[];
  people: Person[];
  occasions: Occasion[];
  states: OccasionState[];
  gifts: GiftRecord[];
  ideas: IdeaCacheEntry[];
  dirty: DirtyMap;
  inviteId: string | null;
};

export type AppSnapshot = {
  version: 1;
  profile: Profile;
  roster: GroupSummary[];
  archives: Record<string, GroupArchive>;
  group: GroupMeta | null;
  members: Member[];
  people: Person[];
  occasions: Occasion[];
  states: OccasionState[];
  gifts: GiftRecord[];
  feedback: FeedbackEntry[];
  ideas: IdeaCacheEntry[];
  entitlementPaid: boolean;
  dirty: DirtyMap;
};

export type RemoteRecord = {
  collection: 'people' | 'occasions' | 'states' | 'gifts' | 'ideas' | 'members';
  id: string;
  updatedAt: number;
  deleted?: boolean;
  data: Record<string, unknown>;
};

export function emptySnapshot(now: number): AppSnapshot {
  return {
    version: 1,
    profile: {
      uid: null,
      displayName: '',
      nameLocked: false,
      createdAt: now,
      upgraded: false,
      upgradeBannerDismissed: false,
      onboarded: false,
      groupId: null,
      pendingEmail: null,
      pendingVerificationId: null,
      inviteId: null,
    },
    roster: [],
    archives: {},
    group: null,
    members: [],
    people: [],
    occasions: [],
    states: [],
    gifts: [],
    feedback: [],
    ideas: [],
    entitlementPaid: false,
    dirty: {},
  };
}

export function dirtyKey(collection: string, id: string): string {
  return `${collection}:${id}`;
}
