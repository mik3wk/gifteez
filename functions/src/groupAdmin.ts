export type AccountGroup = {
  id: string;
  ownerId: string;
  memberIds: string[];
};

export type AccountPlan =
  | { groupId: string; action: 'delete' }
  | { groupId: string; action: 'transfer-and-remove'; nextOwnerId: string }
  | { groupId: string; action: 'remove' };

export function planAccountDeletion(groups: AccountGroup[], uid: string): AccountPlan[] {
  return groups
    .filter(group => group.memberIds.includes(uid))
    .map(group => {
      const others = group.memberIds.filter(id => id !== uid);
      if (group.ownerId === uid && others.length === 0) {
        return { groupId: group.id, action: 'delete' as const };
      }
      if (group.ownerId === uid) {
        return { groupId: group.id, action: 'transfer-and-remove' as const, nextOwnerId: others[0] };
      }
      return { groupId: group.id, action: 'remove' as const };
    });
}

export function canReceiveList(input: { entitled: boolean; ownedGroupIds: string[]; groupId: string }): boolean {
  if (input.entitled) {
    return true;
  }
  const others = input.ownedGroupIds.filter(id => id !== input.groupId);
  return others.length === 0;
}

export function decideRotationClaim(input: {
  needsRotation: boolean;
  rotatingBy: string;
  uid: string;
  member: boolean;
}): boolean {
  if (!input.member || !input.needsRotation) {
    return false;
  }
  return !input.rotatingBy || input.rotatingBy === input.uid;
}
