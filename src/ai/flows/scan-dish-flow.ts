'use server';
/**
 * @fileOverview Flux IA pour l'analyse visuelle des plats.
 * Utilise un appel direct à l'API v1 stable pour contourner les erreurs de routage du SDK.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

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

/**
 * Analyse visuelle du plat via l'API Gemini v1 directe.
 */
export async function scanDish(input: ScanDishInput): Promise<ScanDishOutput> {
  return scanDishFlow(input);
}

const scanDishFlow = ai.defineFlow(
  {
    name: 'scanDishFlow',
    inputSchema: ScanDishInputSchema,
    outputSchema: ScanDishOutputSchema,
  },
  async (input) => {
    const apiKey = process.env.GOOGLE_GENAI_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("Liaison Neurale Impossible : Clé API manquante dans l'environnement.");
    }

    // Extraction des données base64
    const match = input.photoDataUri.match(/^data:(image\/[a-zA-Z]+);base64,(.+)$/);
    if (!match) {
      throw new Error("Format d'image corrompu.");
    }
    const mimeType = match[1];
    const base64Data = match[2];

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [
                { text: "Tu es un expert en nutrition cybernétique. Analyse cette image de nourriture. Identifie le plat, estime les portions et les macros. Réponds EXCLUSIVEMENT avec un objet JSON brut sans balises Markdown. Format attendu : { \"name\": \"nom du plat\", \"calories\": nombre, \"protein\": nombre, \"carbs\": nombre, \"fat\": nombre, \"ingredients\": [\"ingrédient 1\", ...], \"aiAnalysis\": \"phrase courte cyberpunk en français\" }" },
                { inline_data: { mime_type: mimeType, data: base64Data } }
              ]
            }],
            generationConfig: {
              temperature: 0.4,
              topP: 1,
              topK: 32,
              maxOutputTokens: 1024,
            }
          })
        }
      );

      if (!response.ok) {
        const errData = await response.json();
        if (response.status === 429) throw new Error("SERVEUR SATURÉ : Réessaie dans 60s.");
        throw new Error(`Erreur API (${response.status}) : ${errData.error?.message || 'Inconnue'}`);
      }

      const result = await response.json();
      const rawText = result.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!rawText) {
        throw new Error("Liaison neurale instable : aucune donnée reçue.");
      }

      // Extraction JSON robuste (Regex)
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      const cleanJson = jsonMatch ? jsonMatch[0] : rawText;

      return JSON.parse(cleanJson) as ScanDishOutput;
    } catch (error: any) {
      console.error('ERREUR VISION ENGINE:', error);
      throw new Error(error.message || "Échec de l'analyse optique.");
    }
  }
);
