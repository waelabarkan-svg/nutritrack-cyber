'use server';
/**
 * @fileOverview Flux IA pour l'estimation nutritionnelle textuelle.
 * Utilise un parsing JSON manuel.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const EstimateDishInputSchema = z.object({
  dishName: z.string(),
});
export type EstimateDishInput = z.infer<typeof EstimateDishInputSchema>;

const EstimateDishOutputSchema = z.object({
  name: z.string(),
  calories: z.number(),
  protein: z.number(),
  carbs: z.number(),
  fat: z.number(),
  aiAnalysis: z.string(),
});
export type EstimateDishOutput = z.infer<typeof EstimateDishOutputSchema>;

export async function estimateDish(input: EstimateDishInput): Promise<EstimateDishOutput> {
  return estimateDishFlow(input);
}

const prompt = ai.definePrompt({
  name: 'estimateDishPrompt',
  model: 'googleai/gemini-1.5-flash',
  input: { schema: EstimateDishInputSchema },
  prompt: `Tu es un Expert Nutritionniste Cyberpunk. Analyse le plat : "{{{dishName}}}".
  
  Estime les valeurs pour une portion standard.
  Réponds UNIQUEMENT au format JSON brut suivant sans balises Markdown :
  {
    "name": "nom standardisé",
    "calories": nombre,
    "protein": nombre,
    "carbs": nombre,
    "fat": nombre,
    "aiAnalysis": "phrase courte cyberpunk (max 10 mots)"
  }`,
});

const estimateDishFlow = ai.defineFlow(
  {
    name: 'estimateDishFlow',
    inputSchema: EstimateDishInputSchema,
    outputSchema: EstimateDishOutputSchema,
  },
  async (input) => {
    const { text } = await prompt(input);
    const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleanJson) as EstimateDishOutput;
  }
);
