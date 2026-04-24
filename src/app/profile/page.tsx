"use client"

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useFirestore } from '@/firebase';
import { BottomNav } from '@/components/bottom-nav';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TooltipProvider } from '@/components/ui/tooltip';
import { 
  doc, 
  getDoc, 
  setDoc, 
  collection, 
  query, 
  where, 
  onSnapshot, 
  updateDoc, 
  getDocs, 
  deleteDoc 
} from 'firebase/firestore';
import { toast } from '@/hooks/use-toast';
import { UserStats, calculateNutritionGoals } from '@/lib/nutrition-utils';
import { Cpu, Target, CheckCircle2, Circle, Flame, Zap, Award, AlertTriangle, Trash2 } from 'lucide-react';
import { getUserGamification, getRank, getXpProgress, getXpForLevel, addXp, getXpMultiplier, Rank } from '@/lib/gamification-utils';
import { cn } from '@/lib/utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function ProfilePage() {
  const { user, loading } = useUser();
  const db = useFirestore();
  const router = useRouter();
  const [stats, setStats] = useState<UserStats>({
    gender: 'male',
    age: 25,
    height: 175,
    weight: 70,
    targetWeight: 70,
    activityLevel: 'moderate',
    goal: 'maintain'
  });

  const [gamification, setGamification] = useState(getUserGamification());
  const [dailyProgress, setDailyProgress] = useState({ calories: 0, protein: 0, hydration: 0 });

  const today = useMemo(() => new Date().toISOString().split('T')[0], []);

  useEffect(() => {
    if (user) {
      const fetchStats = async () => {
        const docRef = doc(db, 'users', user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setStats(prev => ({ ...prev, ...docSnap.data() }));
        }
      };
      fetchStats();

      const mealsQuery = query(collection(db, 'users', user.uid, 'meals'), where('date', '==', today));
      const unsubMeals = onSnapshot(mealsQuery, (snap) => {
        let cal = 0, prot = 0;
        snap.forEach(d => {
          cal += d.data().calories || 0;
          prot += d.data().protein || 0;
        });
        setDailyProgress(prev => ({ ...prev, calories: cal, protein: prot }));
      });

      const hydRef = doc(db, 'users', user.uid, 'hydration', today);
      const unsubHyd = onSnapshot(hydRef, (snap) => {
        setDailyProgress(prev => ({ ...prev, hydration: snap.exists() ? snap.data().amount : 0 }));
      });

      return () => { unsubMeals(); unsubHyd(); };
    }
  }, [user, db, today]);

  const goals = useMemo(() => calculateNutritionGoals(stats), [stats]);
  const rank = useMemo(() => getRank(gamification.level), [gamification.level]);
  const xpProgress = useMemo(() => getXpProgress(gamification.xp), [gamification.xp]);
  const nextLevelXp = useMemo(() => getXpForLevel(gamification.level + 1), [gamification.level]);
  const multiplier = useMemo(() => getXpMultiplier(gamification.streak), [gamification.streak]);

  useEffect(() => {
    if (!user) return;
    const targetHydrationGlasses = Math.ceil(goals.hydrationMl / 250);
    
    if (dailyProgress.hydration >= targetHydrationGlasses) {
      const res = addXp(100, 'water');
      if (res && res.xp > gamification.xp) {
        setGamification(getUserGamification());
        toast({ title: "OBJECTIF FLUIDE ATTEINT", description: `+${Math.floor(100 * (res.multiplier || 1))} XP`, className: "bg-accent text-black font-black" });
      }
    }

    if (dailyProgress.protein >= goals.protein) {
      const res = addXp(150, 'protein');
      if (res && res.xp > gamification.xp) {
        setGamification(getUserGamification());
        toast({ title: "SYNTHÈSE PROTÉIQUE OK", description: `+${Math.floor(150 * (res.multiplier || 1))} XP`, className: "bg-primary text-black font-black" });
      }
    }

    const calMargin = goals.calories * 0.1;
    if (dailyProgress.calories >= goals.calories - calMargin && dailyProgress.calories <= goals.calories + calMargin) {
      const res = addXp(100, 'calories');
      if (res && res.xp > gamification.xp) {
        setGamification(getUserGamification());
        toast({ title: "FLUX ÉNERGÉTIQUE STABLE", description: `+${Math.floor(100 * (res.multiplier || 1))} XP`, className: "bg-primary text-black font-black shadow-[0_0_20px_rgba(253,224,71,0.5)]" });
      }
    }
  }, [dailyProgress, goals, user, gamification.xp]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    try {
      await setDoc(doc(db, 'users', user.uid), stats, { merge: true });
      toast({ title: "SYSTÈME PRÊT", description: "Paramètres biométriques synchronisés." });
    } catch (e) {
      toast({ variant: "destructive", title: "ERREUR", description: "Échec de la mise à jour." });
    }
  };

  const handleResetAllData = async () => {
    if (!user) return;
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        weight: 70,
        targetWeight: 70,
        goal: 'maintain',
        xp: 0,
        level: 1,
        streak: 0,
        lastActiveDate: null
      });

      const mealsRef = collection(db, 'users', user.uid, 'meals');
      const mealsSnap = await getDocs(mealsRef);
      const deleteMeals = mealsSnap.docs.map(d => deleteDoc(d.ref));
      await Promise.all(deleteMeals);

      const hydRef = collection(db, 'users', user.uid, 'hydration');
      const hydSnap = await getDocs(hydRef);
      const deleteHyd = hydSnap.docs.map(d => deleteDoc(d.ref));
      await Promise.all(deleteHyd);

      localStorage.removeItem('user_gamification');
      localStorage.removeItem('biometric_memory');

      setGamification({ xp: 0, level: 1, streak: 0, dailyBonuses: {} });
      setStats({
        gender: 'male',
        age: 25,
        height: 175,
        weight: 70,
        targetWeight: 70,
        activityLevel: 'moderate',
        goal: 'maintain'
      });

      toast({ 
        title: "FORMATAGE USINE TERMINÉ", 
        description: "Mémoire effacée. Système réinitialisé.",
        className: "bg-destructive text-white border-none font-black uppercase"
      });
      
    } catch (e) {
      toast({ variant: "destructive", title: "ERREUR DE FORMATAGE", description: "Échec de la purge système." });
    }
  };

  if (loading || !user) return null;

  const currentBonuses = gamification.dailyBonuses?.[today] || [];

  const getRankStyles = (r: Rank) => {
    switch (r) {
      case "LEGEND":
        return {
          font: "font-['Orbitron']",
          cardClass: "border-primary neon-glow-yellow",
          nameClass: "legend-gold-glow uppercase tracking-[0.2em] font-black",
          badge: <Award size={24} className="text-primary neon-glow-yellow" />
        };
      case "NETRUNNER ELITE":
        return {
          font: "font-['Orbitron']",
          cardClass: "animate-neon-border",
          nameClass: "text-accent neon-text-blue uppercase tracking-widest font-bold",
          badge: <Zap size={20} className="text-accent" />
        };
      case "BIO-CYBORG":
        return {
          font: "font-['Orbitron']",
          cardClass: "border-accent shadow-[0_0_15px_rgba(0,242,255,0.4)]",
          nameClass: "text-white uppercase font-bold",
          badge: <Cpu size={20} className="text-accent/60" />
        };
      case "TECH-SPECIALIST":
        return {
          font: "font-['JetBrains_Mono']",
          cardClass: "border-white/20",
          nameClass: "text-white/90 uppercase font-bold",
          badge: null
        };
      default:
        return {
          font: "font-body",
          cardClass: "border-white/10",
          nameClass: "text-white/70 uppercase",
          badge: null
        };
    }
  };

  const rankStyles = getRankStyles(rank);

  return (
    <TooltipProvider delayDuration={0}>
      <main className="px-6 pt-16 max-w-md mx-auto pb-32 min-h-screen bg-black text-white">
        <div className="space-y-1 mb-8">
          <p className="text-primary/60 text-[9px] font-black uppercase tracking-[0.5em] neon-text-yellow">Interface: Archiviste</p>
          <h1 className="text-3xl font-black tracking-tighter uppercase neon-text-yellow">Citoyen Bio</h1>
        </div>

        <div className={cn(
          "p-6 mb-8 relative rounded-[16px] transition-all duration-700 bg-black/40 border",
          rankStyles.cardClass
        )}>
          <div className="relative z-10">
            <div className="flex justify-between items-start mb-6">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                   <span className={cn("text-[9px] font-black tracking-[0.4em] block", rank === "LEGEND" ? "text-primary neon-text-yellow" : "text-accent neon-text-blue")}>
                    {rank}
                  </span>
                  {rankStyles.badge}
                </div>
                <h2 className={cn("text-2xl tracking-tighter", rankStyles.nameClass, rankStyles.font)}>
                  {user.displayName || 'AGENT'}
                </h2>
                
                <div className="flex items-center gap-3 bg-white/5 px-3 py-1.5 rounded-full border border-white/10 w-fit">
                   <div className="flex items-center gap-1.5">
                     <Flame size={14} className={cn(gamification.streak > 0 ? "text-primary animate-pulse" : "text-white/20")} />
                     <span className="text-[10px] font-black text-white">{gamification.streak}D SERIE</span>
                   </div>
                   {multiplier > 1 && (
                     <div className="h-3 w-[1px] bg-white/10" />
                   )}
                   {multiplier > 1 && (
                     <span className="text-[10px] font-black text-primary">x{multiplier} XP</span>
                   )}
                </div>
              </div>
              
              <div className="w-16 h-16 border-2 border-accent/30 flex flex-col items-center justify-center bg-black rounded-xl shadow-[0_0_15px_rgba(0,242,255,0.2)]">
                <span className="text-[8px] font-black text-accent/60 uppercase">NIV</span>
                <span className="text-2xl font-black neon-text-blue">{gamification.level}</span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-end">
                <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Évolution Neurale</span>
                <span className="text-[9px] font-black text-accent uppercase tracking-widest">{Math.floor(gamification.xp)} / {nextLevelXp} XP</span>
              </div>
              <div className="h-3 w-full bg-white/5 border border-white/10 rounded-full overflow-hidden p-[2px]">
                <div 
                  className="h-full bg-gradient-to-r from-accent via-primary to-accent rounded-full transition-all duration-1000 shadow-[0_0_10px_rgba(0,242,255,0.8)]"
                  style={{ width: `${xpProgress}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="cyber-card-yellow p-6 mb-10 bg-black border-primary/20">
          <div className="flex items-center gap-2 mb-4">
            <Target size={16} className="text-primary" />
            <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-primary">Contrats du Cycle</h3>
          </div>
          <div className="space-y-3">
            {[
              { type: 'water', label: 'Refroidissement', xp: 100, current: dailyProgress.hydration, target: Math.ceil(goals.hydrationMl / 250), unit: 'verres' },
              { type: 'protein', label: 'Synthèse Protéique', xp: 150, current: dailyProgress.protein, target: goals.protein, unit: 'g' },
              { type: 'calories', label: 'Flux Énergie', xp: 100, current: dailyProgress.calories, target: goals.calories, unit: 'kcal' }
            ].map((quest) => {
              const isDone = currentBonuses.includes(quest.type);
              const bonusXp = Math.floor(quest.xp * multiplier);
              return (
                <div key={quest.type} className={cn(
                  "flex items-center justify-between p-3 border rounded-lg transition-all",
                  isDone ? "bg-primary/10 border-primary/40 shadow-[0_0_10px_rgba(253,224,71,0.1)]" : "bg-white/5 border-white/5"
                )}>
                  <div className="space-y-1">
                    <p className={cn("text-[10px] font-black uppercase tracking-widest", isDone ? "text-primary" : "text-white/60")}>{quest.label}</p>
                    <p className="text-[8px] text-muted-foreground font-black uppercase">{quest.current} / {quest.target} {quest.unit}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={cn("text-[9px] font-black", isDone ? "text-primary" : "text-white/40")}>+{bonusXp} XP</span>
                    {isDone ? <CheckCircle2 size={16} className="text-primary" /> : <Circle size={16} className="text-white/10" />}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-8 mb-12">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-[8px] font-black uppercase tracking-widest text-muted-foreground ml-1">Génotype</Label>
              <Select value={stats.gender} onValueChange={(v: any) => setStats({...stats, gender: v})}>
                <SelectTrigger className="bg-white/5 border-primary/20 h-12 font-black uppercase text-[10px] tracking-widest focus:border-primary transition-all rounded-[10px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-black border-primary/20 text-white">
                  <SelectItem value="male">HOMME</SelectItem>
                  <SelectItem value="female">FEMME</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-[8px] font-black uppercase tracking-widest text-muted-foreground ml-1">Âge Chrono</Label>
              <Input type="number" className="bg-white/5 border-primary/20 h-12 font-black uppercase text-[10px] tracking-widest focus:border-primary transition-all rounded-[10px]" value={stats.age} onChange={(e) => setStats({...stats, age: parseInt(e.target.value) || 0})} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-[8px] font-black uppercase tracking-widest text-muted-foreground ml-1">Altitude (CM)</Label>
              <Input type="number" className="bg-white/5 border-primary/20 h-12 font-black uppercase text-[10px] tracking-widest focus:border-primary transition-all rounded-[10px]" value={stats.height} onChange={(e) => setStats({...stats, height: parseInt(e.target.value) || 0})} />
            </div>
            <div className="space-y-2">
              <Label className="text-[8px] font-black uppercase tracking-widest text-muted-foreground ml-1">Masse (KG)</Label>
              <Input type="number" className="bg-white/5 border-primary/20 h-12 font-black uppercase text-[10px] tracking-widest focus:border-primary transition-all rounded-[10px]" value={stats.weight} onChange={(e) => setStats({...stats, weight: parseInt(e.target.value) || 0})} />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-[8px] font-black uppercase tracking-widest text-muted-foreground ml-1">Objectif Primaire</Label>
            <Select value={stats.goal} onValueChange={(v: any) => setStats({...stats, goal: v})}>
              <SelectTrigger className="bg-white/5 border-primary/20 h-12 font-black uppercase text-[10px] tracking-widest focus:border-primary transition-all rounded-[10px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-black border-primary/20 text-white">
                <SelectItem value="lose">PERTE_DE_POIDS</SelectItem>
                <SelectItem value="maintain">MAINTENANCE</SelectItem>
                <SelectItem value="gain">PRISE_DE_MASSE</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button type="submit" className="w-full h-16 font-black text-xs tracking-[0.4em] border-primary neon-glow-yellow mt-6 rounded-[12px] group relative overflow-hidden">
            <span className="relative z-10 group-hover:neon-text-yellow transition-all">MISE_À_JOUR_DES_PARAMÈTRES</span>
          </Button>
        </form>

        <div className="pt-12 border-t border-destructive/20">
          <div className="flex items-center gap-2 mb-4 px-1">
            <AlertTriangle className="text-destructive" size={16} />
            <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-destructive">Protocole de Sécurité</h3>
          </div>
          
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" className="w-full h-14 border-destructive/40 text-destructive bg-black hover:bg-destructive/10 font-black text-[10px] tracking-[0.2em] rounded-[12px] flex items-center justify-center gap-2">
                <Trash2 size={16} />
                RÉINITIALISER TOUTES LES DONNÉES
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="bg-black border-destructive text-white rounded-[24px]">
              <AlertDialogHeader>
                <AlertDialogTitle className="text-destructive uppercase font-black tracking-widest">ALERTE DANGER</AlertDialogTitle>
                <AlertDialogDescription className="text-white/60 font-medium">
                  Cette opération va formater intégralement votre archive biométrique. L'XP, les repas, l'hydratation et vos paramètres de profil seront définitivement effacés. Cette action est irréversible.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="bg-white/5 border-white/10 text-white hover:bg-white/10 rounded-xl">ANNULER</AlertDialogCancel>
                <AlertDialogAction onClick={handleResetAllData} className="bg-destructive text-white font-black hover:bg-destructive/80 rounded-xl">
                  CONFIRMER LA PURGE
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        <BottomNav />
      </main>
    </TooltipProvider>
  );
}
