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
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

/**
 * Calcule les objectifs nutritionnels via la formule de Mifflin-St Jeor.
 */
export function calculateNutritionGoals(stats: UserStats) {
  const { gender, age, height, weight, activityLevel, goal } = stats;

  if (!weight || !height || !age) {
    return { calories: 2000, carbs: 200, protein: 150, fat: 65, hydrationMl: 2500 };
  }

  // Formule de Mifflin-St Jeor pour les calories
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

  // Macros par défaut : 40% Glucides, 30% Protéines, 30% Lipides
  const carbs = (targetCalories * 0.4) / 4;
  const protein = (targetCalories * 0.3) / 4;
  const fat = (targetCalories * 0.3) / 9;

  // Calcul personnalisé de l'hydratation : 35ml par kg + bonus activité
  let hydrationMl = weight * 35;
  if (activityLevel === 'active') hydrationMl += 500;
  if (activityLevel === 'very_active') hydrationMl += 1000;

  return {
    calories: Math.round(targetCalories),
    carbs: Math.round(carbs),
    protein: Math.round(protein),
    fat: Math.round(fat),
    hydrationMl: Math.round(hydrationMl),
  };
}
