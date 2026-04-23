/**
 * @fileOverview Logic de gamification RPG avancée pour NutriTrack.
 * Gère l'équilibrage, les quêtes journalières, l'anti-spam et les séries (streaks).
 */

export interface UserGamification {
  xp: number;
  level: number;
  dailyBonuses?: Record<string, string[]>; // date -> [bonusTypes]
  streak: number;
  lastActiveDate?: string;
}

/**
 * Nouvelle courbe d'XP : Progression lente à haut niveau.
 * Formule : XP = (Niveau ^ 2.5) * 150
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

export type Rank = "NOVICE-HACKER" | "TECH-SPECIALIST" | "BIO-CYBORG" | "NETRUNNER ELITE" | "LEGEND";

export const getRank = (level: number): Rank => {
  if (level >= 50) return "LEGEND";
  if (level >= 30) return "NETRUNNER ELITE";
  if (level >= 15) return "BIO-CYBORG";
  if (level >= 6) return "TECH-SPECIALIST";
  return "NOVICE-HACKER";
};

export const getUserGamification = (): UserGamification => {
  if (typeof window === 'undefined') return { xp: 0, level: 1, streak: 0 };
  const stored = localStorage.getItem('user_gamification');
  if (stored) {
    const data = JSON.parse(stored);
    return {
      xp: data.xp || 0,
      level: calculateLevel(data.xp || 0),
      dailyBonuses: data.dailyBonuses || {},
      streak: data.streak || 0,
      lastActiveDate: data.lastActiveDate
    };
  }
  return { xp: 0, level: 1, streak: 0 };
};

/**
 * Calcul du multiplicateur de série
 * 1-2 jours: x1.0 | 3-6 jours: x1.2 | 7+ jours: x1.5
 */
export const getXpMultiplier = (streak: number) => {
  if (streak >= 7) return 1.5;
  if (streak >= 3) return 1.2;
  return 1.0;
};

/**
 * Vérifie et ajoute de l'XP avec gestion de bonus unique par jour et multiplicateur de série.
 */
export const addXp = (amount: number, type?: 'scan' | 'water' | 'protein' | 'calories') => {
  if (typeof window === 'undefined') return;
  const current = getUserGamification();
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];
  
  // Gestion de la série (Streak)
  let newStreak = current.streak;
  if (current.lastActiveDate === yesterdayStr) {
    // Activité consécutive
    if (!current.dailyBonuses?.[today]?.length) {
       // Premier bonus de la journée
       newStreak += 1;
    }
  } else if (current.lastActiveDate !== today) {
    // Rupture de série ou premier jour
    newStreak = 1;
  }

  // Anti-Spam Scans (Max 5 par jour)
  if (type === 'scan') {
    const dailyScans = current.dailyBonuses?.[today]?.filter(t => t === 'scan').length || 0;
    if (dailyScans >= 5) return { ...current, leveledUp: false, reason: 'limit_reached' };
  }

  // Bonus Unique par jour (Eau, Prot, Cal)
  if (type && ['water', 'protein', 'calories'].includes(type)) {
    if (current.dailyBonuses?.[today]?.includes(type)) return { ...current, leveledUp: false, reason: 'already_claimed' };
  }

  const multiplier = getXpMultiplier(newStreak);
  const finalAmount = Math.floor(amount * multiplier);
  const newXp = current.xp + finalAmount;
  const newLevel = calculateLevel(newXp);
  
  const dailyBonuses = { ...current.dailyBonuses };
  if (!dailyBonuses[today]) dailyBonuses[today] = [];
  if (type) dailyBonuses[today].push(type);

  localStorage.setItem('user_gamification', JSON.stringify({ 
    xp: newXp, 
    dailyBonuses,
    streak: newStreak,
    lastActiveDate: today
  }));
  
  return { xp: newXp, level: newLevel, streak: newStreak, multiplier, leveledUp: newLevel > current.level };
};
