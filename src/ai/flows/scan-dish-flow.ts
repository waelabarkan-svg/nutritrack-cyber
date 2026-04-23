'use server';
/**
 * @fileOverview Flux IA pour l'analyse visuelle des plats (Vision Engine).
 * Modèle gemini-1.5-flash sur API v1 stable.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const ScanDishInputSchema = z.object({
  photoDataUri: z.string().describe("Photo du plat en data URI base64."),
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
  
  IMPORTANT : Réponds EXCLUSIVEMENT avec un objet JSON brut. 
  Ne mets aucun texte avant ou après. Pas de balises Markdown. 
  Ta réponse doit commencer par { et finir par }.
  
  Format attendu :
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
    const { text } = await prompt(input);
    
    // Extraction JSON robuste
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const rawContent = jsonMatch ? jsonMatch[0] : text;
    const cleanJson = rawContent.replace(/```json/g, '').replace(/```/g, '').trim();

    try {
      return JSON.parse(cleanJson) as ScanDishOutput;
    } catch (error) {
      console.error('ERREUR DE PARSING IA [SCAN]:', error);
      console.error('CONTENU BRUT REÇU:', text);
      throw new Error("Échec de la liaison neurale : format de données corrompu.");
    }
  }
);
