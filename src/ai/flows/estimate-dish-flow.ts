'use server';
/**
 * @fileOverview Flux de reconstruction moléculaire textuelle via Llama-4 Scout (Groq).
 * Extraction stricte de données micro-nutritionnelles.
 */

import { z } from 'genkit';

const EstimateDishOutputSchema = z.object({
  name: z.string(),
  calories: z.number(),
  protein: z.number(),
  carbs: z.number(),
  fat: z.number(),
  fiber: z.number(),
  vitamins: z.string(),
  minerals: z.string(),
  aiAnalysis: z.string(),
  healthAdvice: z.string(),
});

export type EstimateDishOutput = z.infer<typeof EstimateDishOutputSchema>;

export async function estimateDish(input: { dishName: string }): Promise<EstimateDishOutput> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY manquante");

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: "meta-llama/llama-4-scout-17b-16e-instruct",
        messages: [
          {
            role: "user",
            content: `Analyse nutritionnelle textuelle pour : "${input.dishName}".
            Estime les macros et micros (Vitamines, Minéraux, Fibres).
            
            Réponds EXCLUSIVEMENT avec un objet JSON pur sans texte additionnel, respectant cette structure :
            {
              "name": "nom",
              "calories": nombre,
              "protein": nombre,
              "carbs": nombre,
              "fat": nombre,
              "fiber": nombre,
              "vitamins": "liste",
              "minerals": "liste",
              "aiAnalysis": "phrase courte",
              "healthAdvice": "conseil"
            }`
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.1,
      })
    });

    if (!response.ok) throw new Error("Erreur API Groq");

    const data = await response.json();
    const content = data.choices[0].message.content;
    
    // Parsing robuste avec Regex pour isoler le JSON
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    const result = JSON.parse(jsonMatch ? jsonMatch[0] : content);

    return {
      name: result.name || input.dishName,
      calories: Number(result.calories) || 0,
      protein: Number(result.protein) || 0,
      carbs: Number(result.carbs) || 0,
      fat: Number(result.fat) || 0,
      fiber: Number(result.fiber) || 0,
      vitamins: result.vitamins || "Non détecté",
      minerals: result.minerals || "Non détecté",
      aiAnalysis: result.aiAnalysis || "Analyse moléculaire terminée.",
      healthAdvice: result.healthAdvice || "Maintien des paramètres conseillé."
    };
  } catch (error) {
    console.error("Erreur Reconstruction IA:", error);
    throw error;
  }
}
