/**
 * @fileOverview Logic de gamification RPG pour NutriTrack.
 * Gère le calcul des niveaux, de l'XP et des rangs.
 */

export interface UserGamification {
  xp: number;
  level: number;
}

export const calculateLevel = (xp: number) => {
  // Formule : XP_Requis = Niveau^2 * 100 => Niveau = sqrt(XP / 100)
  // On commence au niveau 1
  if (xp < 100) return 1;
  return Math.floor(Math.sqrt(xp / 100));
};

export const getXpForLevel = (level: number) => {
  return Math.pow(level, 2) * 100;
};

export const getXpProgress = (xp: number) => {
  const currentLevel = calculateLevel(xp);
  const xpCurrentLevel = getXpForLevel(currentLevel);
  const xpNextLevel = getXpForLevel(currentLevel + 1);
  const progress = ((xp - xpCurrentLevel) / (xpNextLevel - xpCurrentLevel)) * 100;
  return Math.max(0, Math.min(100, progress));
};

export const getRank = (level: number) => {
  if (level >= 50) return "LEGEND";
  if (level >= 16) return "NETRUNNER ELITE";
  if (level >= 6) return "BIO-CYBORG";
  return "NOVICE-HACKER";
};

export const getUserGamification = (): UserGamification => {
  if (typeof window === 'undefined') return { xp: 0, level: 1 };
  const stored = localStorage.getItem('user_gamification');
  if (stored) {
    const data = JSON.parse(stored);
    return {
      xp: data.xp || 0,
      level: calculateLevel(data.xp || 0)
    };
  }
  return { xp: 0, level: 1 };
};

export const addXp = (amount: number) => {
  if (typeof window === 'undefined') return;
  const current = getUserGamification();
  const newXp = current.xp + amount;
  const newLevel = calculateLevel(newXp);
  
  localStorage.setItem('user_gamification', JSON.stringify({ xp: newXp }));
  
  return { xp: newXp, level: newLevel, leveledUp: newLevel > current.level };
};
