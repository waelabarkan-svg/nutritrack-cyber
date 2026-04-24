'use server';

/**
 * @fileOverview Flux de scan optique utilisant GROQ avec le modèle Llama 4 Scout.
 * Analyse approfondie incluant macros et micro-nutriments spécifiques.
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
                text: `Analyse visuellement ce plat. Estime les ingrédients, les calories et les macros (P/G/L). 
                Analyse moléculaire profonde requise pour : 
                - Fibres (g)
                - Vitamines (Priorité: A, C, D, B12)
                - Sels Minéraux (Priorité: Fer, Magnésium, Zinc)
                
                Réponds EXCLUSIVEMENT en français avec un objet JSON pur (sans balises markdown) respectant cette structure : 
                {
                  "name": "nom du plat",
                  "calories": nombre,
                  "protein": nombre,
                  "carbs": nombre,
                  "fat": nombre,
                  "fiber": nombre,
                  "vitamins": "Liste formatée (ex: Vitamine B12 (élevée), B6)",
                  "minerals": "Liste formatée (ex: Fer (riche), Zinc)",
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
        temperature: 0.7,
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || "Erreur API Groq Vision");
    }

    const data = await response.json();
    const result = JSON.parse(data.choices[0].message.content);
    
    return result;

  } catch (error: any) {
    console.error("Erreur Vision Engine (Groq):", error);
    throw new Error(error.message || "Échec de l'analyse optique via Groq.");
  }
}
