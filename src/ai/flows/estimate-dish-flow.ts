
'use server';
/**
 * @fileOverview Flux de reconstruction moléculaire et coaching nutritionnel via Llama-4 Scout (Groq).
 * L'IA agit comme une aide à la décision proactive avec suggestions de Smart-Swaps.
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
  smartSwap: z.object({
    alternative: z.string(),
    explanation: z.string(),
  }).describe('Alternative avec meilleur profil macros mais goût similaire'),
});

export type EstimateDishOutput = z.infer<typeof EstimateDishOutputSchema>;

export async function estimateDish(input: { dishName: string }): Promise<EstimateDishOutput> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return {
      name: input.dishName,
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      fiber: 0,
      vitamins: "Inconnu",
      minerals: "Inconnu",
      aiAnalysis: "ERREUR: GROQ_API_KEY manquante.",
      healthAdvice: "Configurez vos variables d'environnement sur Vercel.",
      coachAnalysis: "Liaison IA impossible.",
      smartSwap: { alternative: "Inconnu", explanation: "Clé API absente." }
    };
  }

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
            content: `Tu es un coach nutritionnel d'élite et une aide à la décision proactive. 
            Ta mission est d'analyser les aliments avec une précision moléculaire.
            Tu dois SYSTEMATIQUEMENT proposer un 'smartSwap' : une alternative avec le même profil de goût mais de meilleures macros (ex: riz blanc -> quinoa).
            Explique pourquoi ce changement est bénéfique pour le 'système' (le corps de l'utilisateur).`
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
              "vitamins": "liste de vitamines",
              "minerals": "liste de minéraux",
              "aiAnalysis": "brève analyse technique",
              "healthAdvice": "conseil de santé immédiat",
              "coachAnalysis": "ton expertise proactive de coach",
              "smartSwap": {
                "alternative": "nom de l'alternative suggérée",
                "explanation": "pourquoi c'est mieux pour le système"
              }
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
    const result = JSON.parse(content);

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
      coachAnalysis: result.coachAnalysis || "Analyse proactive indisponible.",
      smartSwap: {
        alternative: result.smartSwap?.alternative || "Non suggéré",
        explanation: result.smartSwap?.explanation || "Paramètres actuels optimaux."
      }
    };
  } catch (error) {
    console.error("Erreur Reconstruction IA & Coaching:", error);
    throw error;
  }
}
