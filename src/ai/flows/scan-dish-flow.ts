'use server';
/**
 * @fileOverview AI Flow for analyzing dish images and estimating nutritional values.
 *
 * - scanDish - Function to analyze an image and return nutritional data.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const ScanDishInputSchema = z.object({
  photoDataUri: z
    .string()
    .describe(
      "A photo of a dish, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type ScanDishInput = z.infer<typeof ScanDishInputSchema>;

const ScanDishOutputSchema = z.object({
  name: z.string().describe('Identified name of the dish.'),
  calories: z.number().describe('Estimated calories for the visible portion.'),
  protein: z.number().describe('Estimated protein in grams.'),
  carbs: z.number().describe('Estimated carbohydrates in grams.'),
  fat: z.number().describe('Estimated fat in grams.'),
  ingredients: z.array(z.string()).describe('List of main identified ingredients.'),
  aiAnalysis: z.string().describe('A short, punchy cyberpunk comment about the dish (max 10 words).'),
});
export type ScanDishOutput = z.infer<typeof ScanDishOutputSchema>;

export async function scanDish(input: ScanDishInput): Promise<ScanDishOutput> {
  return scanDishFlow(input);
}

const prompt = ai.definePrompt({
  name: 'scanDishPrompt',
  input: { schema: ScanDishInputSchema },
  output: { schema: ScanDishOutputSchema },
  prompt: `Tu es un expert en nutrition cybernétique. Analyse cette image de nourriture. 
  Identifie les aliments, estime précisément les portions visibles et renvoie les données nutritionnelles.

  Image à analyser: {{media url=photoDataUri}}
  
  Instructions:
  1. Identifie le plat principal.
  2. Estime les calories et les macros (Protéines, Glucides, Lipides) pour la portion affichée.
  3. Liste les ingrédients principaux détectés.
  4. Donne une analyse courte (max 10 mots) avec un style Cyberpunk/Netrunner en français.
  
  Réponds exclusivement au format structuré demandé.`,
});

const scanDishFlow = ai.defineFlow(
  {
    name: 'scanDishFlow',
    inputSchema: ScanDishInputSchema,
    outputSchema: ScanDishOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    if (!output) throw new Error('Échec de l\'analyse optique par l\'IA.');
    return output;
  }
);
