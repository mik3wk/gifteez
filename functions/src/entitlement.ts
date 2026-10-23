export type StoreVerdict = 'granted' | 'revoked' | 'not_configured' | 'unknown';

export function classifyAppleVerdict(input: {
  grants: boolean;
  revocationDate?: number | null;
}): StoreVerdict {
  if (input.revocationDate) {
    return 'revoked';
  }
  return input.grants ? 'granted' : 'unknown';
}

/** purchaseState 0 is purchased. 1 is canceled or refunded. Anything else is not a revoke. */
export function classifyGoogleVerdict(input: {
  purchaseState?: number;
  productMatches: boolean;
}): StoreVerdict {
  if (!input.productMatches) {
    return 'unknown';
  }
  if (input.purchaseState === 0) {
    return 'granted';
  }
  if (input.purchaseState === 1) {
    return 'revoked';
  }
  return 'unknown';
}

/** Missing store credentials must not clear anyone's unlock. */
export function shouldRevokeEntitlement(verdict: StoreVerdict): boolean {
  return verdict === 'revoked';
}

export function configuredVerdict(configured: boolean, verdict: StoreVerdict): StoreVerdict {
  if (!configured) {
    return 'not_configured';
  }
  return verdict;
}
