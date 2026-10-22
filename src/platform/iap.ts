import { Platform } from 'react-native';
import {
  fetchProducts,
  finishTransaction,
  getAvailablePurchases,
  initConnection,
  purchaseErrorListener,
  purchaseUpdatedListener,
  requestPurchase,
  type Purchase,
} from 'react-native-iap';

export type StoreProduct = {
  id: string;
  title: string;
  displayPrice: string;
};

export async function connectStore(productId: string): Promise<
  { ok: true; product: StoreProduct | null } | { ok: false; reason: string }
> {
  try {
    const connected = await initConnection();
    if (!connected) {
      return { ok: false, reason: 'unavailable' };
    }
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : 'unavailable' };
  }
  try {
    const products = await fetchProducts({ skus: [productId], type: 'in-app' });
    const first = Array.isArray(products) ? products[0] : undefined;
    if (first && 'id' in first && 'displayPrice' in first) {
      return {
        ok: true,
        product: {
          id: String(first.id),
          title: 'title' in first && first.title ? String(first.title) : productId,
          displayPrice: String(first.displayPrice),
        },
      };
    }
  } catch {
    return { ok: true, product: null };
  }
  return { ok: true, product: null };
}

export function listenToPurchases(
  onPurchase: (purchase: Purchase) => void,
  onError: (message: string) => void,
): () => void {
  const updated = purchaseUpdatedListener(purchase => onPurchase(purchase));
  const failed = purchaseErrorListener(error => onError(error.message || 'purchase'));
  return () => {
    updated.remove();
    failed.remove();
  };
}

export async function buyUnlock(productId: string): Promise<void> {
  await requestPurchase({
    type: 'in-app',
    request: {
      apple: { sku: productId },
      google: { skus: [productId] },
    },
  });
}

export async function loadOwned(productId: string): Promise<Purchase[]> {
  const purchases = await getAvailablePurchases();
  return (purchases ?? []).filter(purchase => purchase.productId === productId);
}

export async function finishOwned(purchase: Purchase): Promise<void> {
  await finishTransaction({ purchase, isConsumable: false });
}

export function purchaseProof(purchase: Purchase): {
  transactionId: string;
  token: string;
  platform: 'ios' | 'android';
} {
  const transactionId =
    'transactionId' in purchase && purchase.transactionId
      ? purchase.transactionId
      : purchase.id;
  return {
    transactionId,
    token: purchase.purchaseToken || transactionId,
    platform: Platform.OS === 'android' ? 'android' : 'ios',
  };
}
