import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, indexedDBLocalPersistence, inMemoryPersistence, setPersistence } from 'firebase/auth';
import { getFirestore, initializeFirestore, memoryLocalCache } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

// Configure Firestore with simple memory cache and long polling to avoid "client offline" errors in iframe
export const db = initializeFirestore(app, {
  experimentalAutoDetectLongPolling: true
});

export const auth = getAuth(app);

// In-memory cache for Google Workspace access token
let cachedAccessToken: string | null = null;

export const setCachedAccessToken = (token: string | null) => {
  cachedAccessToken = token;
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

auth.onAuthStateChanged((user) => {
  if (!user) {
    cachedAccessToken = null;
  }
});

// Attempt to set persistence to handle network drops in the preview iframe
setPersistence(auth, indexedDBLocalPersistence).catch((err) => {
  console.warn("Auth persistence failed (falling back to inMemory):", err);
  setPersistence(auth, inMemoryPersistence).catch(() => {});
});

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
