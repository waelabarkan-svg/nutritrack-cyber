import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

/**
 * Configuration Genkit stabilisée.
 * Force l'utilisation de l'API v1 stable pour éviter les erreurs 404/v1beta.
 */
export const ai = genkit({
  plugins: [
    googleAI({
      apiVersion: 'v1',
    }),
  ],
});
