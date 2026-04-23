'use server';
/**
 * @fileOverview Flux IA pour un coaching nutritionnel personnalisé en français.
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
  input: { schema: CoachFeedbackInputSchema },
  output: { schema: CoachFeedbackOutputSchema },
  prompt: `Tu es un Coach Nutritionnel expert dans un futur Cyberpunk. Analyse les données suivantes pour l'utilisateur.
  
  Profil Utilisateur:
  - Poids actuel: {{{stats.weight}}} kg
  - Cible: {{{stats.targetWeight}}} kg
  - Objectif: {{{stats.goal}}}
  - Activité: {{{stats.activityLevel}}}
  
  Consommation du jour:
  - Calories: {{{dailyLog.calories}}} kcal
  - Protéines: {{{dailyLog.protein}}} g
  - Glucides: {{{dailyLog.carbs}}} g
  - Lipides: {{{dailyLog.fat}}} g
  
  Réponds EXCLUSIVEMENT en français.
  Donne un conseil court (max 2 phrases), percutant et stylé cyberpunk. 
  Si les calories sont dépassées ou si les protéines manquent gravement, utilise le statut "urgent".
  Sinon, utilise "encouragement".`,
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
      console.error('Échec de la liaison neurale:', error);
      return {
        feedback: "Liaison neurale instable. Analyse en attente... continue tes efforts, Agent !",
        status: "encouragement",
      };
    }
  }
);
