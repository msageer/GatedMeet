import { getDoc as originalGetDoc, getDocs as originalGetDocs, DocumentReference, Query, DocumentData } from 'firebase/firestore';

const MAX_RETRIES = 3;
const RETRY_DELAY = 500;
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function isOfflineError(error: any) {
  if (!error) return false;
  if (error.code === 'unavailable') return true;
  const msg = (typeof error === 'string' ? error : error.message || String(error) || '').toLowerCase();
  if (msg.includes('offline') || msg.includes('network') || msg.includes('failed to fetch') || msg.includes('unavailable')) return true;
  return false;
}

export async function getDocWrapper(ref: DocumentReference<DocumentData, DocumentData>) {
  let attempt = 0;
  while (true) {
    try {
      const result = await originalGetDoc(ref);
      return result;
    } catch (error: any) {
      attempt++;
      if (attempt >= MAX_RETRIES || !isOfflineError(error)) {
        if (!isOfflineError(error)) {
          console.error(`Firestore getDoc failed permanently:`, error);
        } else {
          console.warn(`Firestore getDoc offline fallback used after ${attempt} attempts`);
        }
        return {
          id: ref.id,
          ref,
          exists: () => false,
          data: () => undefined,
          metadata: { fromCache: true, hasPendingWrites: false }
        } as any;
      }
      console.warn(`Firestore getDoc offline error allowed, retrying attempt ${attempt}...`);
      await delay(RETRY_DELAY);
    }
  }
}

export async function getDocsWrapper(query: Query<DocumentData, DocumentData>) {
  let attempt = 0;
  while (true) {
    try {
      const result = await originalGetDocs(query);
      return result;
    } catch (error: any) {
      attempt++;
      if (attempt >= MAX_RETRIES || !isOfflineError(error)) {
        if (!isOfflineError(error)) {
          console.error(`Firestore getDocs failed permanently:`, error);
        } else {
          console.warn(`Firestore getDocs offline fallback used after ${attempt} attempts`);
        }
        return {
          empty: true,
          size: 0,
          docs: [],
          forEach: () => {},
          metadata: { fromCache: true, hasPendingWrites: false }
        } as any;
      }
      console.warn(`Firestore getDocs offline error allowed, retrying attempt ${attempt}...`);
      await delay(RETRY_DELAY);
    }
  }
}
