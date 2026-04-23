import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

/**
 * Configuration Genkit centralisée.
 * Le plugin googleAI est utilisé pour les flux textuels standards.
 */
export const ai = genkit({
  plugins: [
    googleAI(),
  ],
});
