import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

/**
 * Configuration Genkit stabilisée.
 * Utilise l'API v1 par défaut du plugin.
 */
export const ai = genkit({
  plugins: [
    googleAI(),
  ],
});
