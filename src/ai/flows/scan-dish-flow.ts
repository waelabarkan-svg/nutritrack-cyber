'use server';

/**
 * @fileOverview Flux de scan optique utilisant GROQ (Llama 3.2 Vision) pour une performance maximale.
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
        model: "llama-3.2-11b-vision-preview",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Analyse visuellement ce plat. Estime les ingrédients, le poids approximatif, les calories et les macros (P/G/L). 
                Réponds EXCLUSIVEMENT en français avec un objet JSON pur (sans balises markdown) respectant cette structure : 
                {
                  "name": "nom du plat",
                  "calories": nombre,
                  "protein": nombre,
                  "carbs": nombre,
                  "fat": nombre,
                  "aiAnalysis": "courte phrase style cyberpunk (max 10 mots)",
                  "healthAdvice": "un conseil nutritionnel humain, varié et avec du caractère (sois sarcastique si c'est de la malbouffe, ou encourageant si c'est sain)"
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
