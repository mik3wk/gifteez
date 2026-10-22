/** Keep in sync with GROUP_MAX_MEMBERS and src/domain/logic.ts DEFAULT_GROUP_MAX_MEMBERS. */
export const DEFAULT_GROUP_MAX_MEMBERS = 10;

export function groupHasRoom(memberCount: number, cap: number): boolean {
  return memberCount < cap;
}
