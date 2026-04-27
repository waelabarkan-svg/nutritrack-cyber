'use server';
/**
 * @fileOverview Flux IA pour un coaching nutritionnel personnalisé via Groq.
 * Utilise Llama-3.3-70b pour une analyse rapide et percutante.
 */

import { z } from 'genkit';
import Groq from 'groq-sdk';

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

const CoachFeedbackInputSchema = z.object({
  stats: z.object({
    weight: z.number(),
    targetWeight: z.number(),
    goal: z.string(),
    activityLevel: z.string(),
  }),
  goals: z.object({
    calories: z.number(),
    protein: z.number(),
    carbs: z.number(),
    fat: z.number(),
  }),
  dailyLog: z.object({
    calories: z.number(),
    protein: z.number(),
    carbs: z.number(),
    fat: z.number(),
  }),
  hydration: z.number().describe('Quantité d\'eau bue en verres (1 verre = 250ml)'),
  lastMeal: z.object({
    name: z.string(),
    calories: z.number(),
    fat: z.number(),
    sugar: z.number().optional(),
  }).optional(),
});
export type CoachFeedbackInput = z.infer<typeof CoachFeedbackInputSchema>;

const CoachFeedbackOutputSchema = z.object({
  feedback: z.string(),
  status: z.enum(['urgent', 'encouragement']),
  missingMacros: z.object({
    calories: z.number(),
    protein: z.number(),
    carbs: z.number(),
    fat: z.number(),
  }),
  suggestions: z.array(z.object({
    name: z.string(),
    description: z.string(),
  })).describe('3 idées de repas concrets au style Cyberpunk'),
  cyberSwap: z.string().describe('Alternative plus saine au dernier repas si nécessaire'),
});
export type CoachFeedbackOutput = z.infer<typeof CoachFeedbackOutputSchema>;

export async function getCoachFeedback(input: CoachFeedbackInput): Promise<CoachFeedbackOutput> {
  if (!process.env.GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY manquante");
  }

  try {
    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content: `Tu es un Coach Nutritionnel expert dans un futur Cyberpunk. Analyse les données de l'Agent.
          Réponds EXCLUSIVEMENT en français avec un style cyberpunk percutant.
          
          Missions :
          1. Calcule les macros manquantes pour atteindre l'objectif du jour (Objectif - Conso). Si déjà atteint, mets 0.
          2. Propose 3 idées de repas concrets adaptés au style Cyberpunk (ex: 'Séquence de protéines Alpha' pour une omelette).
          3. Suggère un 'Cyber-Swap' : si le dernier repas était trop gras ou sucré, propose une alternative moléculairement plus stable.
          
          Structure JSON attendue :
          {
            "feedback": "ton conseil global ici",
            "status": "urgent" ou "encouragement",
            "missingMacros": { "calories": n, "protein": n, "carbs": n, "fat": n },
            "suggestions": [ { "name": "Nom Cyber", "description": "Description" }, ... ],
            "cyberSwap": "ton alternative ici"
          }`
        },
        {
          role: "user",
          content: `Profil: Poids ${input.stats.weight}kg, Objectif ${input.stats.goal}.
          Objectifs Cibles: ${input.goals.calories}kcal (P:${input.goals.protein}g, G:${input.goals.carbs}g, L:${input.goals.fat}g).
          Conso Actuelle: ${input.dailyLog.calories}kcal (P:${input.dailyLog.protein}g, G:${input.dailyLog.carbs}g, L:${input.dailyLog.fat}g).
          Dernier Repas: ${input.lastMeal?.name || 'Inconnu'} (${input.lastMeal?.calories || 0}kcal, Gras: ${input.lastMeal?.fat || 0}g, Sucre: ${input.lastMeal?.sugar || 0}g).
          Refroidissement: ${input.hydration} verres.
          
          Analyse et renvoie le JSON.`
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.6,
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) throw new Error("Réponse vide de Groq");

    const result = JSON.parse(content);
    return result as CoachFeedbackOutput;
  } catch (error) {
    console.error("Erreur Liaison Groq:", error);
    return {
      feedback: "Liaison neurale instable. Continue tes efforts, Agent !",
      status: "encouragement",
      missingMacros: { calories: 0, protein: 0, carbs: 0, fat: 0 },
      suggestions: [],
      cyberSwap: "Maintien des paramètres actuels."
    };
  }
}
