'use server';
/**
 * @fileOverview Flux IA pour un coaching nutritionnel personnalisé en français avec suivi d'hydratation.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

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
  feedback: z.string().describe('Le message de coaching personnalisé.'),
  status: z.enum(['urgent', 'encouragement']).describe('Le niveau d\'urgence du conseil.'),
});
export type CoachFeedbackOutput = z.infer<typeof CoachFeedbackOutputSchema>;

export async function getCoachFeedback(input: CoachFeedbackInput): Promise<CoachFeedbackOutput> {
  return coachFeedbackFlow(input);
}

const prompt = ai.definePrompt({
  name: 'coachFeedbackPrompt',
  model: 'googleai/gemini-1.5-flash',
  input: { schema: CoachFeedbackInputSchema },
  output: { schema: CoachFeedbackOutputSchema },
  prompt: `Tu es un Coach Nutritionnel expert dans un futur Cyberpunk. Analyse les données suivantes pour l'utilisateur.
  
  Profil Utilisateur:
  - Poids actuel: {{{stats.weight}}} kg
  - Objectif: {{{stats.goal}}}
  
  Consommation du jour:
  - Calories: {{{dailyLog.calories}}} kcal
  - Protéines: {{{dailyLog.protein}}} g
  - Glucides: {{{dailyLog.carbs}}} g
  - Lipides: {{{dailyLog.fat}}} g
  
  Hydratation (Refroidissement):
  - Verres bus: {{{hydration}}} / 10 (Cible: 2.5L)
  
  Réponds EXCLUSIVEMENT en français.
  Donne un conseil court (max 2 phrases), percutant et stylé cyberpunk.
  
  Priorité absolue: 
  1. Si l'hydratation est inférieure à 4 verres alors que la journée avance, signale un risque de "surchauffe du système".
  2. Si les calories sont dépassées ou les protéines manquent, utilise le statut "urgent".
  3. Sinon, encourage l'Agent.`,
});

const coachFeedbackFlow = ai.defineFlow(
  {
    name: 'coachFeedbackFlow',
    inputSchema: CoachFeedbackInputSchema,
    outputSchema: CoachFeedbackOutputSchema,
  },
  async (input) => {
    try {
      const { output } = await prompt(input);
      if (!output) throw new Error('Pas de réponse de l\'IA');
      return output;
    } catch (error) {
      return {
        feedback: "Liaison neurale instable. Analyse en attente... continue tes efforts, Agent !",
        status: "encouragement",
      };
    }
  }
);
