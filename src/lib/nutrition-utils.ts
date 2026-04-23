export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
export type Goal = 'lose' | 'maintain' | 'gain';
export type Gender = 'male' | 'female';

export interface UserStats {
  gender: Gender;
  age: number;
  height: number;
  weight: number;
  targetWeight: number;
  activityLevel: ActivityLevel;
  goal: Goal;
}

const activityFactors: Record<ActivityLevel, number> = {
  sedentary: 1.2,    // Bureau, peu de sport
  light: 1.375,      // 1-2 séances/semaine
  moderate: 1.55,    // 3-5 séances/semaine
  active: 1.725,     // 6-7 séances sportives
  very_active: 1.9,  // Athlète / Métier physique
};

/**
 * Calcule les objectifs nutritionnels via la formule de Mifflin-St Jeor.
 */
export function calculateNutritionGoals(stats: UserStats) {
  const { gender, age, height, weight, activityLevel, goal } = stats;

  if (!weight || !height || !age) {
    return { bmr: 0, tdee: 0, calories: 2000, carbs: 200, protein: 150, fat: 65, hydrationMl: 2500 };
  }

  // Formule de Mifflin-St Jeor pour le BMR
  let bmr = (10 * weight) + (6.25 * height) - (5 * age);
  if (gender === 'male') {
    bmr += 5;
  } else {
    bmr -= 161;
  }

  const tdee = bmr * activityFactors[activityLevel];

  let targetCalories = tdee;
  if (goal === 'lose') targetCalories -= 500;
  if (goal === 'gain') targetCalories += 500;

  // Calcul des macros précis
  // Protéines : 2g/kg (prise), 1.8g/kg (perte), 1.5g/kg (maintien)
  let proteinPerKg = 1.5;
  if (goal === 'gain') proteinPerKg = 2.0;
  if (goal === 'lose') proteinPerKg = 1.8;
  
  const protein = weight * proteinPerKg;
  
  // Lipides : ~25% des calories totales
  const fat = (targetCalories * 0.25) / 9;
  
  // Glucides : le reste des calories
  const carbs = (targetCalories - (protein * 4) - (fat * 9)) / 4;

  // Calcul personnalisé de l'hydratation : 35ml par kg + bonus activité
  let hydrationMl = weight * 35;
  if (activityLevel === 'active') hydrationMl += 800;
  if (activityLevel === 'very_active') hydrationMl += 1500;

  return {
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    calories: Math.round(targetCalories),
    carbs: Math.round(carbs),
    protein: Math.round(protein),
    fat: Math.round(fat),
    hydrationMl: Math.round(hydrationMl),
  };
}
