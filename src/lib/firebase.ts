// This file is deprecated. Please use the centralized Firebase logic in src/firebase/index.ts.
import { initializeFirebase } from '@/firebase';

const { auth, db } = initializeFirebase();

export { auth, db };
