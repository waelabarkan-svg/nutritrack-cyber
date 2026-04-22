'use client';

import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

/**
 * Configuration Firebase officielle - Verrouillée en dur.
 * Source de vérité unique pour toute l'application.
 */
export const firebaseConfig = {
  apiKey: 'AIzaSyA4qB0gN6V7L00JhutP1rwSiRLF9sTUXsU',
  authDomain: 'studio-7017378573-cff64.firebaseapp.com',
  projectId: 'studio-7017378573-cff64',
  storageBucket: 'studio-7017378573-cff64.firebasestorage.app',
  messagingSenderId: '328031842182',
  appId: '1:328031842182:web:508c94a3587a90eb464607'
};

// Initialisation sécurisée : on réutilise l'app si elle existe déjà
export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Export des instances de services
export const auth = getAuth(app);
export const db = getFirestore(app);
