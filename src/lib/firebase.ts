/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { 
  getFirestore, 
  getDocFromServer,
  doc as firestoreDoc,
  collection as firestoreCollection,
  query as firestoreQuery,
  where as firestoreWhere,
  onSnapshot as firestoreOnSnapshot,
  setDoc as firestoreSetDoc,
  updateDoc as firestoreUpdateDoc,
  getDocs as firestoreGetDocs,
  getDoc as firestoreGetDoc,
  serverTimestamp as firestoreServerTimestamp,
  limit as firestoreLimit,
  orderBy as firestoreOrderBy
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize the Firebase app
const app = initializeApp(firebaseConfig);

// Initialize Auth
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Initialize Firestore
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

// Core operation typing for rule instrumentation as specified by Firebase Skill
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

/**
 * Catches Firestore "Missing or insufficient permissions" errors and maps them to standard JSON errors
 * to allow real-time diagnostic reporting and safety assurance.
 */
export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errMessage = error instanceof Error ? error.message : String(error);
  
  const errInfo: FirestoreErrorInfo = {
    error: errMessage,
    operationType,
    path,
    authInfo: {
      userId: auth.currentUser?.uid || null,
      email: auth.currentUser?.email || null,
      emailVerified: auth.currentUser?.emailVerified || null,
      isAnonymous: auth.currentUser?.isAnonymous || null,
      tenantId: auth.currentUser?.tenantId || null,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    }
  };

  console.error('Firestore Rule Violation / Operation Failed: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// MANDATORY VALIDATOR CONNECTION TO FIRESTORE (From SKILL.md guidelines)
async function testConnection() {
  if (checkDemoMode()) return;
  try {
    // Attempting a brief live network handshake read to confirm DB state
    await getDocFromServer(firestoreDoc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn("Firestore connection check warning: Client is offline or disconnected.");
    }
  }
}

// --- DUAL-MODE LOCALSTORAGE MOCK FIRESTORE ENGINE ---
type ListenerCallback = (snapshot: any) => void;
const listeners = new Map<string, Set<ListenerCallback>>();

export function checkDemoMode(): boolean {
  return localStorage.getItem('fembet_demo_mode') === 'true';
}

function notifyCollectionListeners(collectionName: string) {
  const collectionListeners = listeners.get(collectionName);
  if (collectionListeners) {
    const rawData = localStorage.getItem(`fembet_db_${collectionName}`);
    const dataArray = rawData ? JSON.parse(rawData) : [];
    
    const snapshot = {
      forEach: (callback: (doc: any) => void) => {
        dataArray.forEach((item: any) => {
          callback({
            id: item.id || item.userId || item.matchId,
            data: () => item
          });
        });
      },
      empty: dataArray.length === 0,
      size: dataArray.length,
      docs: dataArray.map((item: any) => ({
        id: item.id || item.userId || item.matchId,
        data: () => item
      }))
    };

    collectionListeners.forEach(listener => {
      try {
        listener(snapshot);
      } catch (err) {
        console.error("Error in mock onSnapshot listener:", err);
      }
    });
  }
}

// Wrapper for doc
export function doc(dbOrCollection: any, pathOrCreateIdOrDocId?: string, ...additionalPaths: string[]): any {
  if (checkDemoMode()) {
    let finalPath = '';
    let finalId = '';
    
    if (typeof dbOrCollection === 'string') {
      finalPath = dbOrCollection;
      finalId = pathOrCreateIdOrDocId || '';
    } else if (dbOrCollection && dbOrCollection.path) {
      finalPath = dbOrCollection.path;
      finalId = pathOrCreateIdOrDocId || '';
    } else {
      finalPath = pathOrCreateIdOrDocId || '';
      if (additionalPaths.length > 0) {
        finalId = additionalPaths[additionalPaths.length - 1];
        finalPath = [pathOrCreateIdOrDocId, ...additionalPaths.slice(0, -1)].join('/');
      }
    }
    
    return {
      type: 'doc',
      path: finalPath,
      id: finalId,
    };
  }
  
  return firestoreDoc(dbOrCollection, pathOrCreateIdOrDocId!, ...additionalPaths);
}

// Wrapper for collection
export function collection(dbArg: any, path: string, ...additionalPaths: string[]): any {
  if (checkDemoMode()) {
    const finalPath = [path, ...additionalPaths].join('/');
    return {
      type: 'collection',
      path: finalPath
    };
  }
  return firestoreCollection(dbArg, path, ...additionalPaths);
}

// Wrapper for query
export function query(collectionRef: any, ...queryConstraints: any[]): any {
  if (checkDemoMode()) {
    return {
      type: 'query',
      path: collectionRef.path,
      constraints: queryConstraints
    };
  }
  return firestoreQuery(collectionRef, ...queryConstraints);
}

// Wrapper for where
export function where(fieldPath: string, opStr: any, value: any): any {
  if (checkDemoMode()) {
    return {
      type: 'where',
      fieldPath,
      opStr,
      value
    };
  }
  return firestoreWhere(fieldPath, opStr, value);
}

// Wrapper for limit
export function limit(value: number): any {
  if (checkDemoMode()) {
    return { type: 'limit', value };
  }
  return firestoreLimit(value);
}

// Wrapper for orderBy
export function orderBy(fieldPath: string, directionStr?: 'asc' | 'desc'): any {
  if (checkDemoMode()) {
    return { type: 'orderBy', fieldPath, directionStr };
  }
  return firestoreOrderBy(fieldPath, directionStr || 'asc');
}

// Wrapper for onSnapshot
export function onSnapshot(ref: any, onNext: any, onError?: any): any {
  if (checkDemoMode()) {
    const collectionName = ref.path;
    
    if (!listeners.has(collectionName)) {
      listeners.set(collectionName, new Set());
    }
    listeners.get(collectionName)!.add(onNext);
    
    const rawData = localStorage.getItem(`apex_db_${collectionName}`);
    let dataArray = rawData ? JSON.parse(rawData) : [];
    
    // Auto seeding for matches collection if empty in local storage
    if (collectionName === 'matches' && dataArray.length === 0) {
      dataArray = [
        {
          id: 'match_fb_el_clasico',
          sport: 'football',
          homeTeam: 'Real Madrid',
          awayTeam: 'FC Barcelona',
          commencesAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
          status: 'upcoming',
          odds: { homeWin: 1.95, awayWin: 2.35, draw: 3.40 },
          score: { home: 0, away: 0 },
          minute: 0,
          result: 'pending',
          createdAt: new Date().toISOString()
        },
        {
          id: 'match_bb_nba_finals',
          sport: 'basketball',
          homeTeam: 'LA Lakers',
          awayTeam: 'Boston Celtics',
          commencesAt: new Date(Date.now() + 25 * 60 * 1000).toISOString(),
          status: 'upcoming',
          odds: { homeWin: 1.80, awayWin: 2.10, draw: 12.00 },
          score: { home: 0, away: 0 },
          minute: 0,
          result: 'pending',
          createdAt: new Date().toISOString()
        },
        {
          id: 'match_es_worlds',
          sport: 'esports',
          homeTeam: 'T1 esports',
          awayTeam: 'G2 Gaming',
          commencesAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
          status: 'upcoming',
          odds: { homeWin: 1.45, awayWin: 2.75, draw: 6.50 },
          score: { home: 0, away: 0 },
          minute: 0,
          result: 'pending',
          createdAt: new Date().toISOString()
        },
        {
          id: 'match_tn_nadal_djoko',
          sport: 'tennis',
          homeTeam: 'Carlos Alcaraz',
          awayTeam: 'Jannik Sinner',
          commencesAt: new Date(Date.now() + 45 * 60 * 1000).toISOString(),
          status: 'upcoming',
          odds: { homeWin: 1.68, awayWin: 2.15, draw: 22.00 },
          score: { home: 0, away: 0 },
          minute: 0,
          result: 'pending',
          createdAt: new Date().toISOString()
        }
      ];
      localStorage.setItem(`fembet_db_matches`, JSON.stringify(dataArray));
    }
    
    const snapshot = {
      forEach: (callback: (doc: any) => void) => {
        dataArray.forEach((item: any) => {
          callback({
            id: item.id || item.userId || item.matchId,
            data: () => item
          });
        });
      },
      empty: dataArray.length === 0,
      size: dataArray.length,
      docs: dataArray.map((item: any) => ({
        id: item.id || item.userId || item.matchId,
        data: () => item
      }))
    };
    
    try {
      setTimeout(() => onNext(snapshot), 10);
    } catch (err) {
      console.error(err);
    }
    
    return () => {
      listeners.get(collectionName)?.delete(onNext);
    };
  }
  
  return firestoreOnSnapshot(ref, onNext, onError);
}

// Wrapper for setDoc
export async function setDoc(docRef: any, data: any, options?: any): Promise<void> {
  if (checkDemoMode()) {
    const collectionName = docRef.path;
    const docId = docRef.id;
    
    const rawData = localStorage.getItem(`apex_db_${collectionName}`);
    const dataArray = rawData ? JSON.parse(rawData) : [];
    
    const cleanData = JSON.parse(JSON.stringify(data, (key, value) => {
      if (value && typeof value === 'object' && value.isServerTimestamp) {
        return new Date().toISOString();
      }
      return value;
    }));
    
    const preparedItem = {
      ...cleanData,
      id: docId || cleanData.id || `doc_${Date.now()}`
    };
    
    const keyField = collectionName === 'users' ? 'userId' : 'id';
    const index = dataArray.findIndex((item: any) => item[keyField] === (docId || preparedItem[keyField]));
    
    if (index > -1) {
      dataArray[index] = { ...dataArray[index], ...preparedItem };
    } else {
      dataArray.push(preparedItem);
    }
    
    localStorage.setItem(`fembet_db_${collectionName}`, JSON.stringify(dataArray));
    notifyCollectionListeners(collectionName);
    return;
  }
  
  return firestoreSetDoc(docRef, data, options);
}

// Wrapper for updateDoc
export async function updateDoc(docRef: any, data: any): Promise<void> {
  if (checkDemoMode()) {
    const collectionName = docRef.path;
    const docId = docRef.id;
    
    const rawData = localStorage.getItem(`apex_db_${collectionName}`);
    const dataArray = rawData ? JSON.parse(rawData) : [];
    
    const cleanData = JSON.parse(JSON.stringify(data, (key, value) => {
      if (value && typeof value === 'object' && value.isServerTimestamp) {
        return new Date().toISOString();
      }
      return value;
    }));
    
    const keyField = collectionName === 'users' ? 'userId' : 'id';
    const index = dataArray.findIndex((item: any) => item[keyField] === docId);
    
    if (index > -1) {
      dataArray[index] = { ...dataArray[index], ...cleanData };
      localStorage.setItem(`fembet_db_${collectionName}`, JSON.stringify(dataArray));
      notifyCollectionListeners(collectionName);
    } else {
      console.warn(`Doc not found for update: ${collectionName}/${docId}`);
    }
    return;
  }
  
  return firestoreUpdateDoc(docRef, data);
}

// Wrapper for getDocs
export async function getDocs(queryRef: any): Promise<any> {
  if (checkDemoMode()) {
    const collectionName = queryRef.path;
    const rawData = localStorage.getItem(`apex_db_${collectionName}`);
    let dataArray = rawData ? JSON.parse(rawData) : [];
    
    if (queryRef.constraints) {
      queryRef.constraints.forEach((constraint: any) => {
        if (constraint && constraint.fieldPath) {
          const { fieldPath, opStr, value } = constraint;
          dataArray = dataArray.filter((item: any) => {
            if (opStr === '==' || opStr === '===') {
              return item[fieldPath] === value;
            }
            return true;
          });
        }
      });
    }
    
    return {
      empty: dataArray.length === 0,
      size: dataArray.length,
      docs: dataArray.map((item: any) => ({
        id: item.id || item.userId || item.matchId,
        data: () => item
      }))
    };
  }
  
  return firestoreGetDocs(queryRef);
}

// Wrapper for getDoc
export async function getDoc(docRef: any): Promise<any> {
  if (checkDemoMode()) {
    const collectionName = docRef.path;
    const docId = docRef.id;
    
    const rawData = localStorage.getItem(`apex_db_${collectionName}`);
    const dataArray = rawData ? JSON.parse(rawData) : [];
    
    const keyField = collectionName === 'users' ? 'userId' : 'id';
    const match = dataArray.find((item: any) => item[keyField] === docId);
    
    return {
      exists: () => !!match,
      data: () => match
    };
  }
  
  return firestoreGetDoc(docRef);
}

// Wrapper for serverTimestamp
export function serverTimestamp(): any {
  if (checkDemoMode()) {
    return { isServerTimestamp: true };
  }
  return firestoreServerTimestamp();
}

testConnection();

