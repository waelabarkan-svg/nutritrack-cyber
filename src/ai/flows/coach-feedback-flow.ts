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
  dailyLog: z.object({
    calories: z.number(),
    protein: z.number(),
    carbs: z.number(),
    fat: z.number(),
  }),
  hydration: z.number().describe('Quantité d\'eau bue en verres (1 verre = 250ml)'),
});
export type CoachFeedbackInput = z.infer<typeof CoachFeedbackInputSchema>;

const CoachFeedbackOutputSchema = z.object({
  feedback: z.string(),
  status: z.enum(['urgent', 'encouragement']),
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
          
          Structure JSON attendue :
          {
            "feedback": "ton conseil ici",
            "status": "urgent" (si danger/manque grave) ou "encouragement" (si ok)
          }`
        },
        {
          role: "user",
          content: `Profil: Poids ${input.stats.weight}kg, Objectif ${input.stats.goal}.
          Conso: ${input.dailyLog.calories}kcal (P:${input.dailyLog.protein}g, G:${input.dailyLog.carbs}g, L:${input.dailyLog.fat}g).
          Refroidissement: ${input.hydration}/10 verres.
          
          Analyse et renvoie le JSON.`
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.5,
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) throw new Error("Réponse vide de Groq");

    return JSON.parse(content) as CoachFeedbackOutput;
  } catch (error) {
    console.error("Erreur Liaison Groq:", error);
    return {
      feedback: "Liaison neurale instable. Continue tes efforts, Agent !",
      status: "encouragement",
    };
  }
}
