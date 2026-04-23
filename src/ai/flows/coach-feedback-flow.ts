'use server';
/**
 * @fileOverview Flux IA pour le coaching nutritionnel personnalisé.
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
  prompt: `Tu es un Coach Nutritionnel Cyberpunk expert. Analyse les données suivantes pour l'utilisateur.
  
  Profil de l'utilisateur :
  - Poids actuel : {{{stats.weight}}} kg
  - Cible : {{{stats.targetWeight}}} kg
  - Objectif : {{{stats.goal}}}
  - Activité : {{{stats.activityLevel}}}
  
  Consommation du jour (Index actuel) :
  - Calories : {{{dailyLog.calories}}} kcal
  - Protéines : {{{dailyLog.protein}}} g
  - Glucides : {{{dailyLog.carbs}}} g
  - Lipides : {{{dailyLog.fat}}} g
  
  Donne un conseil court (max 2 phrases), percutant et stylé cyberpunk. 
  Si l'utilisateur dépasse ses calories ou manque cruellement de protéines, utilise le statut "urgent".
  Sinon, utilise le statut "encouragement".`,
});

const coachFeedbackFlow = ai.defineFlow(
  {
    name: 'coachFeedbackFlow',
    inputSchema: CoachFeedbackInputSchema,
    outputSchema: CoachFeedbackOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    return output!;
  }
);
