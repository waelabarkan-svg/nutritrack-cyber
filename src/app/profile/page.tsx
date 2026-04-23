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
import { Database, Info, Zap } from 'lucide-react';

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
    }
  }, [user, db]);

  const goals = useMemo(() => calculateNutritionGoals(stats), [stats]);

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
        <div className="space-y-1 mb-12">
          <p className="text-primary/60 text-[9px] font-black uppercase tracking-[0.5em] neon-text-yellow">Protocole: Identité</p>
          <h1 className="text-3xl font-black tracking-tighter uppercase neon-text-yellow">Paramètres</h1>
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

            <div className="grid grid-cols-2 gap-4 mt-6 pt-4 border-t border-white/5">
              <div>
                <div className="flex items-center gap-1">
                  <span className="text-[7px] font-black text-muted-foreground uppercase tracking-widest">BMR</span>
                  <Tooltip>
                    <TooltipTrigger asChild><Info size={8} className="text-muted-foreground/40 cursor-help" /></TooltipTrigger>
                    <TooltipContent className="max-w-[180px]">
                      MÉTABOLISME DE BASE : ÉNERGIE BRÛLÉE AU REPOS TOTAL.
                    </TooltipContent>
                  </Tooltip>
                </div>
                <p className="text-xs font-black text-white">{goals.bmr} KCAL</p>
              </div>
              <div>
                <div className="flex items-center gap-1">
                  <span className="text-[7px] font-black text-muted-foreground uppercase tracking-widest">TDEE</span>
                  <Tooltip>
                    <TooltipTrigger asChild><Info size={8} className="text-muted-foreground/40 cursor-help" /></TooltipTrigger>
                    <TooltipContent className="max-w-[180px]">
                      DÉPENSE TOTALE INCLUANT TES ACTIVITÉS ET TON SPORT.
                    </TooltipContent>
                  </Tooltip>
                </div>
                <p className="text-xs font-black text-white">{goals.tdee} KCAL</p>
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
            <div className="flex items-center gap-2 mb-1">
              <Label className="text-[8px] font-black uppercase tracking-widest text-muted-foreground ml-1">Protocole d'Activité</Label>
              <Tooltip>
                <TooltipTrigger asChild><Info size={12} className="text-muted-foreground/40 cursor-help" /></TooltipTrigger>
                <TooltipContent className="max-w-[250px] space-y-3">
                  <p><span className="text-primary">SÉDENTAIRE :</span> BUREAU, PEU DE SPORT.</p>
                  <p><span className="text-primary">LÉGER :</span> 1-2 SÉANCES / SEMAINE.</p>
                  <p><span className="text-primary">MODÉRÉ :</span> 3-5 SÉANCES / SEMAINE.</p>
                  <p><span className="text-primary">INTENSE :</span> 6-7 SÉANCES INTENSIVES.</p>
                  <p><span className="text-primary">ATHLÈTE :</span> + DE 10H DE SPORT INTENSIF / SEMAINE.</p>
                </TooltipContent>
              </Tooltip>
            </div>
            <Select 
              value={stats.activityLevel} 
              onValueChange={(v: any) => setStats({...stats, activityLevel: v})}
            >
              <SelectTrigger className="bg-white/5 border-primary/20 h-12 font-black uppercase text-[10px] tracking-widest focus:border-primary transition-all rounded-[10px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-black border-primary/20 text-white">
                <SelectItem value="sedentary">01_SÉDENTAIRE</SelectItem>
                <SelectItem value="light">02_LÉGER</SelectItem>
                <SelectItem value="moderate">03_MODÉRÉ</SelectItem>
                <SelectItem value="active">04_INTENSE</SelectItem>
                <SelectItem value="very_active">05_ATHLÈTE</SelectItem>
              </SelectContent>
            </Select>
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
            <div className="absolute inset-0 bg-primary/10 translate-y-full group-hover:translate-y-0 transition-transform duration-500" />
          </Button>
        </form>

        <BottomNav />
      </main>
    </TooltipProvider>
  );
}
