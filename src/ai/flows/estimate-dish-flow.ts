'use server';
/**
 * @fileOverview Flux de reconstruction moléculaire et coaching nutritionnel via Llama-4 Scout (Groq).
 * L'IA agit comme un agent autonome prodiguant des conseils proactifs.
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
  coachAnalysis: z.string().describe('Analyse approfondie et conseils proactifs du coach IA'),
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
            role: "system",
            content: `Tu es un coach nutritionnel d'élite, proactif et expert. 
            Ta mission est d'analyser les aliments avec une précision moléculaire tout en agissant comme un mentor. 
            Tu dois identifier les pièges nutritionnels, suggérer des alternatives plus saines si nécessaire, et féliciter l'utilisateur pour les bons choix. 
            Ton ton est expert, direct et encourageant.`
          },
          {
            role: "user",
            content: `Analyse cet aliment : "${input.dishName}". 
            
            Réponds EXCLUSIVEMENT avec un objet JSON pur respectant cette structure exacte :
            {
              "name": "nom de l'aliment",
              "calories": nombre,
              "protein": nombre,
              "carbs": nombre,
              "fat": nombre,
              "fiber": nombre,
              "vitamins": "liste de vitamines détectées",
              "minerals": "liste de minéraux détectés",
              "aiAnalysis": "brève analyse technique",
              "healthAdvice": "conseil de santé immédiat",
              "coachAnalysis": "ton expertise proactive : analyse l'équilibre, propose des alternatives ou des optimisations, et donne ton avis de coach sur ce choix."
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
      healthAdvice: result.healthAdvice || "Maintien des paramètres conseillé.",
      coachAnalysis: result.coachAnalysis || "Analyse proactive indisponible pour le moment."
    };
  } catch (error) {
    console.error("Erreur Reconstruction IA & Coaching:", error);
    throw error;
  }
}
