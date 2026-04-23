'use server';

/**
 * @fileOverview Flux de scan optique par API directe pour contourner les bugs de routage SDK.
 */

export async function scanDish(input: { photoDataUri: string }) {
  const apiKey = process.env.GOOGLE_GENAI_API_KEY;
  
  if (!apiKey) {
    throw new Error("Clé API GOOGLE_GENAI_API_KEY manquante");
  }

  // Extraction propre des données base64
  const base64Data = input.photoDataUri.split(',')[1];
  const mimeType = input.photoDataUri.split(';')[0].split(':')[1];

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [
              { 
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
                inline_data: {
                  mime_type: mimeType,
                  data: base64Data
                }
              }
            ]
          }],
          generationConfig: {
            temperature: 0.7,
            topP: 0.95,
            topK: 40,
            maxOutputTokens: 1024,
          }
        })
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || "Erreur API Vision");
    }

    const data = await response.json();
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    
    // Nettoyage rigoureux du JSON
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    const cleanJson = jsonMatch ? jsonMatch[0] : rawText;
    
    return JSON.parse(cleanJson);

  } catch (error: any) {
    console.error("Erreur Vision Engine:", error);
    throw new Error(error.message || "Échec de l'analyse optique.");
  }
}
