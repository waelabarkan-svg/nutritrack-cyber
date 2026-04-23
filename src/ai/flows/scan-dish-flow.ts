'use server';
/**
 * @fileOverview Flux IA pour l'analyse visuelle des plats (Vision Engine).
 * Utilise un parsing JSON manuel pour éviter l'erreur Unknown name "responseMimeType".
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const ScanDishInputSchema = z.object({
  photoDataUri: z.string(),
});
export type ScanDishInput = z.infer<typeof ScanDishInputSchema>;

const ScanDishOutputSchema = z.object({
  name: z.string(),
  calories: z.number(),
  protein: z.number(),
  carbs: z.number(),
  fat: z.number(),
  ingredients: z.array(z.string()),
  aiAnalysis: z.string(),
});
export type ScanDishOutput = z.infer<typeof ScanDishOutputSchema>;

export async function scanDish(input: ScanDishInput): Promise<ScanDishOutput> {
  return scanDishFlow(input);
}

const prompt = ai.definePrompt({
  name: 'scanDishPrompt',
  model: 'googleai/gemini-1.5-flash',
  input: { schema: ScanDishInputSchema },
  prompt: `Tu es un expert en nutrition cybernétique. Analyse cette image. 
  
  Image: {{media url=photoDataUri}}
  
  Identifie le plat, estime les portions et les macros.
  Réponds UNIQUEMENT au format JSON brut suivant sans balises Markdown :
  {
    "name": "nom du plat",
    "calories": nombre,
    "protein": nombre,
    "carbs": nombre,
    "fat": nombre,
    "ingredients": ["ingrédient 1", ...],
    "aiAnalysis": "phrase courte cyberpunk en français"
  }`,
});

const scanDishFlow = ai.defineFlow(
  {
    name: 'scanDishFlow',
    inputSchema: ScanDishInputSchema,
    outputSchema: ScanDishOutputSchema,
  },
  async (input) => {
    try {
      const { text } = await prompt(input);
      // Nettoyage rigoureux du JSON pour éviter les erreurs de parsing
      const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim();
      return JSON.parse(cleanJson) as ScanDishOutput;
    } catch (error: any) {
      console.error('Genkit Vision Flow Error:', error);
      throw new Error("Échec de la liaison neurale : format de données invalide.");
    }
  }
);
