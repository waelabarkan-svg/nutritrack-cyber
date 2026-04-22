'use client';

import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

/**
 * Configuration Firebase officielle - Verrouillée en dur.
 * Ne pas utiliser de variables d'environnement.
 */
export const firebaseConfig = {
  apiKey: 'AIzaSyA4qB0gN6V7L00JhutP1rwSiRLF9sTUXsU',
  authDomain: 'studio-7017378573-cff64.firebaseapp.com',
  projectId: 'studio-7017378573-cff64',
  storageBucket: 'studio-7017378573-cff64.firebasestorage.app',
  messagingSenderId: '328031842182',
  appId: '1:328031842182:web:508c94a3587a90eb464607'
};

// Initialisation unique
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Export direct des instances pour bypasser les erreurs de provider
export const auth = getAuth(app);
export const db = getFirestore(app);
