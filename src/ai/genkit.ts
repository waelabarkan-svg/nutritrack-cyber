import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

/**
 * Configuration Genkit stabilisée pour l'API v1.
 * On force la version stable pour éviter les erreurs 404 de l'endpoint v1beta.
 */
export const ai = genkit({
  plugins: [
    googleAI(),
  ],
});
