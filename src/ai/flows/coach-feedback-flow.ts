
'use server';
/**
 * @fileOverview Flux IA pour un coaching nutritionnel personnalisé via Groq.
 * Utilise Llama-3.3-70b pour une analyse décisionnelle et proactive.
 */

import { z } from 'genkit';
import Groq from 'groq-sdk';

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
  remainingCalories: z.number().optional(),
  remainingProtein: z.number().optional(),
  remainingCarbs: z.number().optional(),
  remainingFat: z.number().optional(),
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
    description: z.string()
  })).describe('3 choix de plats précis pour le Plan de Fin de Journée'),
  cyberSwap: z.string().describe('Alternative plus saine au dernier repas si nécessaire'),
  endOfDayPlan: z.string().describe('Directives tactiques pour clôturer la journée'),
});
export type CoachFeedbackOutput = z.infer<typeof CoachFeedbackOutputSchema>;

export async function getCoachFeedback(input: CoachFeedbackInput): Promise<CoachFeedbackOutput> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return {
      feedback: "ERREUR CRITIQUE: GROQ_API_KEY manquante dans l'environnement. Impossible de contacter le coach.",
      status: "encouragement",
      missingMacros: { calories: 0, protein: 0, carbs: 0, fat: 0 },
      suggestions: [{ name: "Erreur Système", description: "Clé API non configurée." }],
      cyberSwap: "Vérifiez vos variables d'environnement.",
      endOfDayPlan: "Maintenance requise."
    };
  }

  const groq = new Groq({ apiKey });

  // Calcul des restants si non fournis
  const remCal = input.remainingCalories ?? Math.max(0, input.goals.calories - input.dailyLog.calories);
  const remProt = input.remainingProtein ?? Math.max(0, input.goals.protein - input.dailyLog.protein);
  const remCarbs = input.remainingCarbs ?? Math.max(0, input.goals.carbs - input.dailyLog.carbs);
  const remFat = input.remainingFat ?? Math.max(0, input.goals.fat - input.dailyLog.fat);

  try {
    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content: `Tu es un Coach Nutritionnel d'élite dans un futur Cyberpunk. Tu es une aide à la décision proactive.
          Réponds EXCLUSIVEMENT en français avec un style expert, direct et technique.
          
          Missions :
          1. Analyse les macros manquantes pour atteindre l'objectif.
          2. Plan de Fin de Journée : Suggère 3 choix de plats précis (objet avec name et description) pour combler EXACTEMENT les manques identifiés.
          3. Cyber-Swap : Si le dernier repas était sous-optimal (trop gras/sucré), propose une alternative moléculairement stable.
          
          Structure JSON attendue :
          {
            "feedback": "ton conseil global ici",
            "status": "urgent" ou "encouragement",
            "missingMacros": { "calories": n, "protein": n, "carbs": n, "fat": n },
            "suggestions": [ {"name": "Nom Cyber", "description": "détails"}, ... ],
            "cyberSwap": "ton alternative ici",
            "endOfDayPlan": "Tes directives tactiques pour la fin de cycle"
          }`
        },
        {
          role: "user",
          content: `Profil: Poids ${input.stats.weight}kg, Objectif ${input.stats.goal}.
          Objectifs Cibles: ${input.goals.calories}kcal (P:${input.goals.protein}g, G:${input.goals.carbs}g, L:${input.goals.fat}g).
          Conso Actuelle: ${input.dailyLog.calories}kcal (P:${input.dailyLog.protein}g, G:${input.dailyLog.carbs}g, L:${input.dailyLog.fat}g).
          Unités Restantes: ${remCal}kcal (P:${remProt}g, G:${remCarbs}g, L:${remFat}g).
          Dernier Repas: ${input.lastMeal?.name || 'Inconnu'} (${input.lastMeal?.calories || 0}kcal, Gras: ${input.lastMeal?.fat || 0}g, Sucre: ${input.lastMeal?.sugar || 0}g).
          Hydratation: ${input.hydration} verres.
          
          Analyse les données et génère le Plan de Fin de Journée.`
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
      suggestions: [{ name: "Séquence standard", description: "Maintien des paramètres de base." }],
      cyberSwap: "Maintien des paramètres actuels.",
      endOfDayPlan: "Stabilisation du système requise."
    };
  }
}
