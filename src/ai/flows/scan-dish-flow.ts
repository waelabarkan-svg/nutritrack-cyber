
'use server';

/**
 * @fileOverview Flux de scan optique utilisant GROQ avec le modèle Llama 4 Scout.
 * Analyse approfondie incluant macros, sucre, caféine et micro-nutriments.
 * Support avancé des liquides et alertes glycémiques.
 */

export async function scanDish(input: { photoDataUri: string }) {
  const apiKey = process.env.GROQ_API_KEY;
  
  if (!apiKey) {
    throw new Error("Clé API GROQ_API_KEY manquante dans l'environnement.");
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
            role: "user",
            content: [
              {
                type: "text",
                text: `Analyse visuellement ce plat ou cette boisson. 
                Détermine s'il s'agit d'un liquide ou d'un solide.
                Estime les ingrédients, les calories, les macros (P/G/L) et spécifiquement le SUCRE (en g). 
                Si c'est une boisson, estime la CAFÉINE (en mg) et identifie les ADDITIFS/ÉDULCORANTS.
                
                Réponds EXCLUSIVEMENT avec un objet JSON pur (sans balises markdown) respectant cette structure exacte : 
                {
                  "name": "nom du plat ou boisson",
                  "isLiquid": boolean,
                  "unit": "ml" ou "g",
                  "calories": nombre,
                  "protein": nombre,
                  "carbs": nombre,
                  "fat": nombre,
                  "sugar": nombre (g),
                  "caffeine": nombre (mg),
                  "micronutrients": {
                    "vitamines": ["Vitamine B12", "Vitamine C"],
                    "mineraux": ["Fer", "Magnésium"],
                    "fibres": "nombre + g",
                    "additives": ["Aspartame", "E120"],
                    "hydrationRate": 0.0 a 1.0 (ex: Eau=1.0, Soda=0.85, Café=0.7)
                  },
                  "aiAnalysis": "courte phrase style cyberpunk (max 10 mots)",
                  "healthAdvice": "ton conseil nutritionnel avec du caractère"
                }`
              },
              {
                type: "image_url",
                image_url: {
                  url: input.photoDataUri
                }
              }
            ]
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.1,
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || "Erreur API Groq Vision");
    }

    const data = await response.json();
    const result = JSON.parse(data.choices[0].message.content);
    
    return {
      ...result,
      sugar: parseFloat(result.sugar) || 0,
      caffeine: parseFloat(result.caffeine) || 0,
      fiber: parseFloat(result.micronutrients?.fibres) || 0,
      vitamins: result.micronutrients?.vitamines?.join(', '),
      minerals: result.micronutrients?.mineraux?.join(', '),
      additives: result.micronutrients?.additives?.join(', '),
      isLiquid: !!result.isLiquid,
      unit: result.unit || (result.isLiquid ? 'ml' : 'g'),
      hydrationRate: result.micronutrients?.hydrationRate || (result.isLiquid ? 0.85 : 0)
    };

  } catch (error: any) {
    console.error("Erreur Vision Engine (Groq):", error);
    throw new Error(error.message || "Échec de l'analyse optique via Groq.");
  }
}
