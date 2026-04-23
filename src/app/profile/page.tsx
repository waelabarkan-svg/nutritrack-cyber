"use client"

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useFirestore } from '@/firebase';
import { BottomNav } from '@/components/bottom-nav';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { toast } from '@/hooks/use-toast';
import { UserStats, calculateNutritionGoals } from '@/lib/nutrition-utils';
import { Database, Info, Zap, Shield, Trophy, Cpu } from 'lucide-react';
import { getUserGamification, getRank, getXpProgress, getXpForLevel } from '@/lib/gamification-utils';

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

  const [gamification, setGamification] = useState({ xp: 0, level: 1 });

  useEffect(() => {
    if (user) {
      const fetchStats = async () => {
        const docRef = doc(db, 'users', user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setStats(prev => ({ ...prev, ...data }));
        }
      };
      fetchStats();
      setGamification(getUserGamification());
    }
  }, [user, db]);

  const goals = useMemo(() => calculateNutritionGoals(stats), [stats]);
  const rank = useMemo(() => getRank(gamification.level), [gamification.level]);
  const xpProgress = useMemo(() => getXpProgress(gamification.xp), [gamification.xp]);
  const nextLevelXp = useMemo(() => getXpForLevel(gamification.level + 1), [gamification.level]);

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

  if (loading || !user) return null;

  return (
    <TooltipProvider delayDuration={0}>
      <main className="px-6 pt-16 max-w-md mx-auto pb-32 min-h-screen bg-black text-white">
        <div className="space-y-1 mb-8">
          <p className="text-primary/60 text-[9px] font-black uppercase tracking-[0.5em] neon-text-yellow">Interface: Archiviste</p>
          <h1 className="text-3xl font-black tracking-tighter uppercase neon-text-yellow">Citoyen Bio</h1>
        </div>

        {/* Section Gamification RPG */}
        <div className="cyber-card-blue p-6 mb-10 bg-black/40 border-accent/40 relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Cpu size={120} className="text-accent" />
          </div>
          <div className="relative z-10">
            <div className="flex justify-between items-center mb-6">
              <div className="space-y-1">
                <span className="text-[8px] font-black text-accent uppercase tracking-[0.4em] block neon-text-blue">{rank}</span>
                <h2 className="text-2xl font-black tracking-tighter uppercase">{user.displayName || 'AGENT'}</h2>
              </div>
              <div className="w-14 h-14 border-2 border-accent/50 flex flex-col items-center justify-center bg-black rounded-xl shadow-[0_0_15px_rgba(0,242,255,0.3)]">
                <span className="text-[8px] font-black text-accent/60 uppercase">NIV</span>
                <span className="text-xl font-black neon-text-blue">{gamification.level}</span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-end">
                <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Progression Neurale</span>
                <span className="text-[9px] font-black text-accent uppercase tracking-widest">{gamification.xp} / {nextLevelXp} XP</span>
              </div>
              <div className="h-3 w-full bg-white/5 border border-white/10 rounded-full overflow-hidden p-[2px]">
                <div 
                  className="h-full bg-gradient-to-r from-accent via-primary to-accent rounded-full transition-all duration-1000 shadow-[0_0_10px_rgba(0,242,255,0.8)]"
                  style={{ width: `${xpProgress}%` }}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-6 pt-4 border-t border-white/5">
              <div className="flex items-center gap-2">
                <Shield size={14} className="text-accent" />
                <span className="text-[8px] font-black text-muted-foreground uppercase">Système Intègre</span>
              </div>
              <div className="flex items-center gap-2 justify-end">
                <Trophy size={14} className="text-primary" />
                <span className="text-[8px] font-black text-muted-foreground uppercase">Mérite : {gamification.level * 10}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="cyber-card-yellow p-6 mb-10 bg-black/40 border-primary/30 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-2 opacity-20">
            <Database size={40} className="text-primary" />
          </div>
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-2">
              <p className="text-[8px] font-black uppercase tracking-[0.3em] text-primary/80">Projection Énergétique</p>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info size={12} className="text-primary/40 cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="max-w-[220px]">
                  CALCULÉ SELON LA FORMULE DE MIFFLIN-ST JEOR.
                </TooltipContent>
              </Tooltip>
            </div>
            <div className="flex items-baseline gap-2 mb-6">
              <span className="text-4xl font-black neon-text-yellow">{goals.calories}</span>
              <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">KCAL / JOUR</span>
            </div>
            
            <div className="grid grid-cols-3 gap-2 pt-4 border-t border-white/5">
              <div className="text-center">
                <p className="text-[7px] font-black text-muted-foreground uppercase tracking-widest mb-1">PROTÉINES</p>
                <p className="text-xs font-black text-white">{goals.protein}G</p>
              </div>
              <div className="text-center">
                <p className="text-[7px] font-black text-muted-foreground uppercase tracking-widest mb-1">GLUCIDES</p>
                <p className="text-xs font-black text-white">{goals.carbs}G</p>
              </div>
              <div className="text-center">
                <p className="text-[7px] font-black text-muted-foreground uppercase tracking-widest mb-1">LIPIDES</p>
                <p className="text-xs font-black text-white">{goals.fat}G</p>
              </div>
            </div>
          </div>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-[8px] font-black uppercase tracking-widest text-muted-foreground ml-1">Génotype</Label>
              <Select 
                value={stats.gender} 
                onValueChange={(v: any) => setStats({...stats, gender: v})}
              >
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
              <Input 
                type="number" 
                className="bg-white/5 border-primary/20 h-12 font-black uppercase text-[10px] tracking-widest focus:border-primary transition-all rounded-[10px]" 
                value={stats.age}
                onChange={(e) => setStats({...stats, age: parseInt(e.target.value) || 0})}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-[8px] font-black uppercase tracking-widest text-muted-foreground ml-1">Altitude (CM)</Label>
              <Input 
                type="number" 
                className="bg-white/5 border-primary/20 h-12 font-black uppercase text-[10px] tracking-widest focus:border-primary transition-all rounded-[10px]" 
                value={stats.height}
                onChange={(e) => setStats({...stats, height: parseInt(e.target.value) || 0})}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[8px] font-black uppercase tracking-widest text-muted-foreground ml-1">Masse (KG)</Label>
              <Input 
                type="number" 
                className="bg-white/5 border-primary/20 h-12 font-black uppercase text-[10px] tracking-widest focus:border-primary transition-all rounded-[10px]" 
                value={stats.weight}
                onChange={(e) => setStats({...stats, weight: parseInt(e.target.value) || 0})}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-[8px] font-black uppercase tracking-widest text-muted-foreground ml-1">Objectif Primaire</Label>
            <Select 
              value={stats.goal} 
              onValueChange={(v: any) => setStats({...stats, goal: v})}
            >
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

        <BottomNav />
      </main>
    </TooltipProvider>
  );
}
