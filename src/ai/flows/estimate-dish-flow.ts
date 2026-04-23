'use server';
/**
 * @fileOverview Flux IA pour l'estimation nutritionnelle textuelle.
 * Modèle gemini-1.5-flash-latest.
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
  model: 'googleai/gemini-1.5-flash-latest',
  input: { schema: EstimateDishInputSchema },
  prompt: `Tu es un Expert Nutritionniste Cyberpunk. Analyse le plat : "{{{dishName}}}".
  
  Estime les valeurs pour une portion standard.
  
  IMPORTANT : Réponds EXCLUSIVEMENT avec un objet JSON brut. 
  Ne mets aucun texte avant ou après. Pas de balises Markdown. 
  Ta réponse doit commencer par { et finir par }.

  Structure JSON :
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
    
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const rawContent = jsonMatch ? jsonMatch[0] : text;
    const cleanJson = rawContent.replace(/```json/g, '').replace(/```/g, '').trim();

    try {
      return JSON.parse(cleanJson) as EstimateDishOutput;
    } catch (error) {
      console.error('ERREUR DE PARSING IA [ESTIMATE]:', error);
      console.error('CONTENU BRUT REÇU:', text);
      throw new Error("Échec de l'analyse neurale du plat.");
    }
  }
);
