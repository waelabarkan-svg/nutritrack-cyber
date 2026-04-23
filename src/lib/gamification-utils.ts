/**
 * @fileOverview Logic de gamification RPG avancée pour NutriTrack.
 * Gère l'équilibrage, les quêtes journalières et l'anti-spam.
 */

export interface UserGamification {
  xp: number;
  level: number;
  dailyBonuses?: Record<string, string[]>; // date -> [bonusTypes]
}

/**
 * Nouvelle courbe d'XP : Progression lente à haut niveau.
 * Formule : XP = (Niveau ^ 2.5) * 150
 * Inverse : Niveau = (XP / 150) ^ (1 / 2.5)
 */
export const calculateLevel = (xp: number) => {
  if (xp < 150) return 1;
  return Math.floor(Math.pow(xp / 150, 1 / 2.5));
};

export const getXpForLevel = (level: number) => {
  return Math.floor(Math.pow(level, 2.5) * 150);
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
  if (level >= 30) return "NETRUNNER ELITE";
  if (level >= 15) return "BIO-CYBORG";
  if (level >= 6) return "TECH-SPECIALIST";
  return "NOVICE-HACKER";
};

export const getUserGamification = (): UserGamification => {
  if (typeof window === 'undefined') return { xp: 0, level: 1 };
  const stored = localStorage.getItem('user_gamification');
  if (stored) {
    const data = JSON.parse(stored);
    return {
      xp: data.xp || 0,
      level: calculateLevel(data.xp || 0),
      dailyBonuses: data.dailyBonuses || {}
    };
  }
  return { xp: 0, level: 1 };
};

/**
 * Vérifie et ajoute de l'XP avec gestion de bonus unique par jour.
 */
export const addXp = (amount: number, type?: 'scan' | 'water' | 'protein' | 'calories') => {
  if (typeof window === 'undefined') return;
  const current = getUserGamification();
  const today = new Date().toISOString().split('T')[0];
  
  // Anti-Spam Scans (Max 5 par jour)
  if (type === 'scan') {
    const dailyScans = current.dailyBonuses?.[today]?.filter(t => t === 'scan').length || 0;
    if (dailyScans >= 5) return { ...current, leveledUp: false, reason: 'limit_reached' };
  }

  // Bonus Unique par jour (Eau, Prot, Cal)
  if (type && ['water', 'protein', 'calories'].includes(type)) {
    if (current.dailyBonuses?.[today]?.includes(type)) return { ...current, leveledUp: false, reason: 'already_claimed' };
  }

  const newXp = current.xp + amount;
  const newLevel = calculateLevel(newXp);
  
  const dailyBonuses = { ...current.dailyBonuses };
  if (!dailyBonuses[today]) dailyBonuses[today] = [];
  if (type) dailyBonuses[today].push(type);

  localStorage.setItem('user_gamification', JSON.stringify({ 
    xp: newXp, 
    dailyBonuses 
  }));
  
  return { xp: newXp, level: newLevel, leveledUp: newLevel > current.level };
};
