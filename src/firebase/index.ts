'use client';

import { app, auth, db } from './config';

/**
 * Initialise les services Firebase en utilisant la configuration centralisée.
 * Réutilise l'initialisation de config.ts.
 */
export function initializeFirebase() {
  return { app, auth, db };
}

export * from './provider';
export * from './auth/use-user';
export * from './firestore/use-collection';
export * from './firestore/use-doc';
