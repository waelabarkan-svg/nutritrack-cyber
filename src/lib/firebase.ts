// This file is now redundant as we use src/firebase/index.ts
// Exporting the initialized instances from the new location for compatibility
import { initializeFirebase } from '@/firebase';

const { auth, db } = initializeFirebase();

export { auth, db };
