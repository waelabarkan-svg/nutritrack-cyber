'use server';
/**
 * @fileOverview AI Flow for personalized nutritional coaching.
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
  feedback: z.string().describe('The personalized coaching message.'),
  status: z.enum(['urgent', 'encouragement']).describe('The urgency level of the advice.'),
});
export type CoachFeedbackOutput = z.infer<typeof CoachFeedbackOutputSchema>;

export async function getCoachFeedback(input: CoachFeedbackInput): Promise<CoachFeedbackOutput> {
  return coachFeedbackFlow(input);
}

const prompt = ai.definePrompt({
  name: 'coachFeedbackPrompt',
  input: { schema: CoachFeedbackInputSchema },
  output: { schema: CoachFeedbackOutputSchema },
  prompt: `You are a Cyberpunk Nutritional Coach expert. Analyze the following data for the user.
  
  User Profile:
  - Current Weight: {{{stats.weight}}} kg
  - Target: {{{stats.targetWeight}}} kg
  - Goal: {{{stats.goal}}}
  - Activity: {{{stats.activityLevel}}}
  
  Daily Consumption (Current Index):
  - Calories: {{{dailyLog.calories}}} kcal
  - Protein: {{{dailyLog.protein}}} g
  - Carbs: {{{dailyLog.carbs}}} g
  - Fat: {{{dailyLog.fat}}} g
  
  Provide a short (max 2 sentences), punchy, and cyberpunk-styled advice. 
  If the user exceeds their calories or is severely lacking protein, use "urgent" status.
  Otherwise, use "encouragement". Keep it in English as the app is mostly in English.`,
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