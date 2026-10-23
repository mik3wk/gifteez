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
  /** Member who must not read this person's gifts, claims, or ideas. Plaintext on the server doc. */
  linkedUid?: string;
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
  /** Member who said they would buy this year's gift. Inside the group ciphertext. */
  claimedBy?: string;
  claimedAt?: number;
  updatedAt: number;
  deleted?: boolean;
  /** Local only. Sync writes this state under hidden/{uid}. Stripped before sealing. */
  hiddenFrom?: string;
};

export type GiftRecord = {
  id: string;
  personId: string;
  occasionId: string;
  year: number;
  title: string;
  priceCents: number;
  purchasedOn: string;
  /** Member who logged the purchase. Inside the group ciphertext. Omitted on older gifts. */
  boughtBy?: string;
  updatedAt: number;
  deleted?: boolean;
  /** Local only. Sync writes this gift under hidden/{uid}. Stripped before sealing. */
  hiddenFrom?: string;
};

/** A gift kept off the shared list. Sealed with the device key, never the group key. */
export type PrivateGift = {
  id: string;
  personId: string;
  groupId: string;
  occasionId: string;
  year: number;
  title: string;
  priceCents: number;
  purchasedOn: string;
  boughtBy?: string;
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
  hiddenFrom?: string;
};

export type GroupMeta = {
  id: string;
  name: string;
  ownerId: string;
  memberIds: string[];
  peopleCount: number;
  entitled: boolean;
  updatedAt: number;
  /** ISO currency for every amount on this list. Missing on older lists means USD. */
  currency?: string;
  /** Bumped when the group key rotates. Clients cannot write it. */
  keyVersion?: number;
  /** A member was removed. A remaining member rotates the key. */
  needsRotation?: boolean;
  /** People kept after a lapse. Readable, not writable, and never deleted automatically. */
  lockedPersonIds?: string[];
  /** This phone has no key, so the cached copy is not current. */
  stale?: boolean;
};

export type GroupSummary = {
  id: string;
  name: string;
  ownerId: string;
  memberIds: string[];
  memberNames: string[];
  updatedAt: number;
  stale?: boolean;
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
  /** Per member, on this phone. Unset until the first occasion asks. */
  reminders?: 'unset' | 'on' | 'off';
};

export type DirtyMap = Record<string, true>;

export type MergeJournal = {
  sourceGroupId: string;
  sourcePersonId: string;
  targetGroupId: string;
  targetPersonId: string;
  createdOccasionIds: string[];
  createdStateIds: string[];
  createdGiftIds: string[];
  replacedStates: OccasionState[];
  privateGiftIds: string[];
  sourcePerson: Person;
  sourceOccasions: Occasion[];
  sourceStates: OccasionState[];
  sourceGifts: GiftRecord[];
  sourcePeopleCount: number;
  sourceDeleted: boolean;
};

export type PendingMembership = {
  action: 'leave' | 'remove';
  groupId: string;
  uid: string;
};

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
  /** Gifts this user unchecked during a merge. Not shared with the group. */
  privateGifts: PrivateGift[];
  feedback: FeedbackEntry[];
  ideas: IdeaCacheEntry[];
  entitlementPaid: boolean;
  /** Owned lists deleted offline. Sync calls releaseOwnedGroup so the free slot frees. */
  releasedGroupIds: string[];
  /** Last merge, so it can be undone. Cleared after undo. */
  mergeJournal?: MergeJournal | null;
  /** Membership changes the server has not confirmed yet. */
  pendingMembership?: PendingMembership[];
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
    privateGifts: [],
    feedback: [],
    ideas: [],
    entitlementPaid: false,
    releasedGroupIds: [],
    mergeJournal: null,
    pendingMembership: [],
    dirty: {},
  };
}

export function dirtyKey(collection: string, id: string): string {
  return `${collection}:${id}`;
}
