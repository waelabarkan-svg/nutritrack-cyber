'use server';
/**
 * @fileOverview Flux IA pour un coaching nutritionnel personnalisé en français.
 * Version stabilisée avec parsing JSON robuste.
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
  feedback: z.string(),
  status: z.enum(['urgent', 'encouragement']),
});
export type CoachFeedbackOutput = z.infer<typeof CoachFeedbackOutputSchema>;

export async function getCoachFeedback(input: CoachFeedbackInput): Promise<CoachFeedbackOutput> {
  return coachFeedbackFlow(input);
}

const prompt = ai.definePrompt({
  name: 'coachFeedbackPrompt',
  model: 'googleai/gemini-1.5-flash',
  input: { schema: CoachFeedbackInputSchema },
  prompt: `Tu es un Coach Nutritionnel expert dans un futur Cyberpunk. Analyse les données de l'Agent.
  
  Profil: Poids {{{stats.weight}}}kg, Objectif {{{stats.goal}}}.
  Conso: {{{dailyLog.calories}}}kcal (P:{{{dailyLog.protein}}}g, G:{{{dailyLog.carbs}}}g, L:{{{dailyLog.fat}}}g).
  Refroidissement: {{{hydration}}}/10 verres.
  
  Réponds EXCLUSIVEMENT en français avec un style cyberpunk percutant.
  
  IMPORTANT : Réponds EXCLUSIVEMENT avec un objet JSON brut. 
  Ne mets aucun texte avant ou après. Pas de balises Markdown. 
  Ta réponse doit commencer par { et finir par }.

  Structure JSON :
  {
    "feedback": "ton conseil ici",
    "status": "urgent" ou "encouragement"
  }

  Priorité: 
  - Hydratation < 4 : risque de surchauffe.
  - Macros hors cible : statut "urgent".`,
});

const coachFeedbackFlow = ai.defineFlow(
  {
    name: 'coachFeedbackFlow',
    inputSchema: CoachFeedbackInputSchema,
    outputSchema: CoachFeedbackOutputSchema,
  },
  async (input) => {
    const { text } = await prompt(input);
    
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const rawContent = jsonMatch ? jsonMatch[0] : text;
    const cleanJson = rawContent.replace(/```json/g, '').replace(/```/g, '').trim();

    try {
      return JSON.parse(cleanJson) as CoachFeedbackOutput;
    } catch (error) {
      console.error('ERREUR DE PARSING IA [COACH]:', error);
      console.error('CONTENU BRUT REÇU:', text);
      return {
        feedback: "Liaison neurale instable. Analyse en attente... continue tes efforts, Agent !",
        status: "encouragement",
      };
    }
  }
);
