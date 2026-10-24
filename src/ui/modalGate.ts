type Waiter = {
  id: number;
  grant: () => void;
};

let nextId = 0;
let holding: number | null = null;
const queue: Waiter[] = [];

/** Logged when a second React Native modal has to wait. */
export const MODAL_BUSY = 'Gifteez kept a second modal queued. Only one can be presented.';

/** Take the one modal slot, or wait until the current modal releases it. */
export function claimModal(grant: () => void): number {
  const id = ++nextId;
  if (holding == null) {
    holding = id;
    grant();
    return id;
  }
  console.warn(MODAL_BUSY);
  queue.push({ id, grant });
  return id;
}

/** Drop a claim. A queued modal is granted the slot. */
export function releaseModal(id: number): void {
  const waiting = queue.findIndex(item => item.id === id);
  if (waiting >= 0) {
    queue.splice(waiting, 1);
    return;
  }
  if (holding !== id) {
    return;
  }
  holding = null;
  const next = queue.shift();
  if (!next) {
    return;
  }
  holding = next.id;
  next.grant();
}

export function modalGateHolding(): number | null {
  return holding;
}

/** Test isolation. A renderer that is thrown away must not keep the slot. */
export function resetModalGate(): void {
  nextId = 0;
  holding = null;
  queue.length = 0;
}
