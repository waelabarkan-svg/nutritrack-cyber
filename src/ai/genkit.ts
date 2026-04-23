import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

/**
 * Configuration Genkit stabilisée pour le Vision Engine.
 * Utilise gemini-1.5-flash pour une meilleure gestion des quotas et de la stabilité.
 */
export const ai = genkit({
  plugins: [googleAI()],
  model: 'googleai/gemini-1.5-flash',
});
