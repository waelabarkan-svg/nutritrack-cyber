'use client';

import { initializeApp, getApps, FirebaseApp, getApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { firebaseConfig } from './config';

let app: FirebaseApp;
let auth: Auth;
let db: Firestore;

export function initializeFirebase() {
  const isValidConfig = firebaseConfig.apiKey && firebaseConfig.apiKey !== "undefined" && firebaseConfig.apiKey.length > 5;

  if (getApps().length === 0) {
    app = initializeApp(isValidConfig ? firebaseConfig : { apiKey: "PLACEHOLDER_KEY_FOR_STABILITY" });
  } else {
    app = getApp();
  }

  auth = getAuth(app);
  db = getFirestore(app);

  return { app, auth, db };
}

export * from './provider';
export * from './auth/use-user';
export * from './firestore/use-collection';
export * from './firestore/use-doc';
