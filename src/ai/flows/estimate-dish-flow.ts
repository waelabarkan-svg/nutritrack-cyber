
'use server';
/**
 * @fileOverview AI Flow for estimating nutritional values of complex dishes.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const EstimateDishInputSchema = z.object({
  dishName: z.string().describe('The name of the dish to estimate.'),
});
export type EstimateDishInput = z.infer<typeof EstimateDishInputSchema>;

const EstimateDishOutputSchema = z.object({
  name: z.string().describe('Standardized name of the dish.'),
  calories: z.number().describe('Estimated calories for a standard portion.'),
  protein: z.number().describe('Estimated protein in grams.'),
  carbs: z.number().describe('Estimated carbohydrates in grams.'),
  fat: z.number().describe('Estimated fat in grams.'),
  aiAnalysis: z.string().describe('A short, punchy cyberpunk-style comment about the dish (max 10 words).'),
});
export type EstimateDishOutput = z.infer<typeof EstimateDishOutputSchema>;

export async function estimateDish(input: EstimateDishInput): Promise<EstimateDishOutput> {
  return estimateDishFlow(input);
}

const prompt = ai.definePrompt({
  name: 'estimateDishPrompt',
  input: { schema: EstimateDishInputSchema },
  output: { schema: EstimateDishOutputSchema },
  prompt: `You are a Cyberpunk Nutritionist Agent. Analyze the dish: "{{{dishName}}}".
  
  Provide a realistic estimation of its nutritional values for a single standard portion.
  Include a punchy comment for the user.
  
  Format the name clearly.`,
});

const estimateDishFlow = ai.defineFlow(
  {
    name: 'estimateDishFlow',
    inputSchema: EstimateDishInputSchema,
    outputSchema: EstimateDishOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    if (!output) throw new Error('AI failed to estimate the dish.');
    return output;
  }
);
