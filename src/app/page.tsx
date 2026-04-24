
"use client"

import React, { useMemo, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useFirestore, useCollection, useDoc } from '@/firebase';
import { BottomNav } from '@/components/bottom-nav';
import { CircularProgress } from '@/components/circular-progress';
import { HydrationCard } from '@/components/hydration-card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Plus, Flame, Beef, Wheat, Droplet, Zap, AlertTriangle, Loader2, Cpu } from 'lucide-react';
import { collection, query, where, doc, onSnapshot } from 'firebase/firestore';
import { calculateNutritionGoals, UserStats } from '@/lib/nutrition-utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { getCoachFeedback, CoachFeedbackOutput } from '@/ai/flows/coach-feedback-flow';
import { cn } from '@/lib/utils';

export default function Home() {
  const { user, loading: authLoading } = useUser();
  const db = useFirestore();
  const router = useRouter();
  const isMobile = useIsMobile();
  const [mounted, setMounted] = useState(false);
  
  const [isCoachOpen, setIsCoachOpen] = useState(false);
  const [coachResponse, setCoachResponse] = useState<CoachFeedbackOutput | null>(null);
  const [isCoachLoading, setIsCoachLoading] = useState(false);
  const [currentHydration, setCurrentHydration] = useState(0);

  const today = useMemo(() => new Date().toISOString().split('T')[0], []);

  const profileRef = useMemo(() => user ? doc(db, 'users', user.uid) : null, [db, user]);
  const { data: stats } = useDoc<UserStats>(profileRef as any);

  const mealsQuery = useMemo(() => {
    if (!user) return null;
    return query(collection(db, 'users', user.uid, 'meals'), where('date', '==', today));
  }, [db, user, today]);
  const { data: meals } = useCollection(mealsQuery);

  useEffect(() => {
    if (!user) return;
    const hydRef = doc(db, 'users', user.uid, 'hydration', today);
    const unsub = onSnapshot(hydRef, (snap) => {
      setCurrentHydration(snap.exists() ? snap.data().amount : 0);
    });
    return () => unsub();
  }, [user, db, today]);

  const dailyLog = useMemo(() => {
    let totals = { calories: 0, protein: 0, carbs: 0, fat: 0 };
    if (meals) {
      meals.forEach((meal: any) => {
        totals.calories += (meal.calories || 0);
        totals.protein += (meal.protein || 0);
        totals.carbs += (meal.carbs || 0);
        totals.fat += (meal.fat || 0);
      });
    }
    return totals;
  }, [meals]);

  const displayStats: UserStats = (stats as UserStats) || {
    gender: 'male', age: 25, height: 175, weight: 70, targetWeight: 70, activityLevel: 'moderate', goal: 'maintain'
  };
  
  const goals = calculateNutritionGoals(displayStats);
  const calProgress = goals.calories > 0 ? dailyLog.calories / goals.calories : 0;

  const handleCoachClick = async () => {
    if (isCoachLoading) return;
    setIsCoachLoading(true);
    setIsCoachOpen(true);
    try {
      const result = await getCoachFeedback({
        stats: {
          weight: displayStats.weight,
          targetWeight: displayStats.targetWeight,
          goal: displayStats.goal,
          activityLevel: displayStats.activityLevel,
        },
        dailyLog,
        hydration: currentHydration
      });
      setCoachResponse(result);
    } catch (error) {
      setCoachResponse({
        feedback: "ERREUR DE LIAISON NEURALE. TENTEZ UNE RECONNEXION.",
        status: "encouragement"
      });
    } finally {
      setIsCoachLoading(false);
    }
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <TooltipProvider delayDuration={0}>
      <main className="px-4 sm:px-6 pt-12 sm:pt-16 max-w-md mx-auto min-h-screen bg-black text-white pb-32">
        <header className="flex justify-between items-start mb-12 sm:mb-16">
          <div className="space-y-1">
            <p className="text-[#a855f7]/60 text-[8px] sm:text-[9px] font-black uppercase tracking-[0.4em] sm:tracking-[0.5em] neon-text-violet">Système en ligne</p>
            <h1 className="text-lg sm:text-xl font-black tracking-[0.15em] sm:tracking-[0.2em] neon-text-violet uppercase">Accueil</h1>
          </div>
          <div className="flex flex-col items-end gap-2">
            <Button 
              onClick={handleCoachClick}
              className="h-9 px-4 bg-black border-[#a855f7]/40 text-[#a855f7] text-[9px] font-black uppercase tracking-widest rounded-lg hover:bg-[#a855f7]/10 hover:border-[#a855f7] shadow-[0_0_15px_rgba(168,85,247,0.2)]"
            >
              <Zap size={14} className="mr-2" />
              Liaison Coach
            </Button>
            <div className="text-right">
              <span className="text-[7px] sm:text-[8px] font-black text-white/40 uppercase tracking-widest">ID: {user?.uid.substring(0, 8) || 'GUEST'}</span>
            </div>
          </div>
        </header>

        <Dialog open={isCoachOpen} onOpenChange={setIsCoachOpen}>
          <DialogContent className={cn(
            "bg-black/95 backdrop-blur-2xl border-2 rounded-none p-8 max-w-sm transition-all duration-500 shadow-[0_0_50px_rgba(0,0,0,0.8)]",
            coachResponse?.status === 'urgent' ? "border-destructive neon-glow-red" : "border-[#a855f7] neon-glow-violet"
          )}>
            <DialogHeader>
              <DialogTitle className="sr-only">Diagnostic du Coach IA</DialogTitle>
              <DialogDescription className="sr-only">Analyse neurale de vos performances biométriques.</DialogDescription>
            </DialogHeader>

            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "w-12 h-12 border flex items-center justify-center",
                  coachResponse?.status === 'urgent' ? "border-destructive text-destructive" : "border-[#a855f7] text-[#a855f7]"
                )}>
                  {isCoachLoading ? <Loader2 className="animate-spin" size={24} /> : coachResponse?.status === 'urgent' ? <AlertTriangle size={24} className="animate-pulse" /> : <Cpu size={24} />}
                </div>
                <div>
                  <h3 className={cn(
                    "text-[10px] font-black uppercase tracking-[0.4em]",
                    coachResponse?.status === 'urgent' ? "text-destructive neon-text-red" : "text-[#a855f7] neon-text-violet"
                  )}>
                    {isCoachLoading ? "Synchronisation..." : "Diagnostic Neural"}
                  </h3>
                  <p className="text-[8px] text-white/40 font-black uppercase tracking-widest">Moteur: Groq Llama-3.3</p>
                </div>
              </div>

              <div className="min-h-[100px] flex items-center">
                {isCoachLoading ? (
                  <div className="w-full space-y-2">
                    <div className="h-2 w-full bg-white/5 animate-pulse" />
                    <div className="h-2 w-3/4 bg-white/5 animate-pulse" />
                    <div className="h-2 w-1/2 bg-white/5 animate-pulse" />
                  </div>
                ) : (
                  <p className="text-sm font-medium leading-relaxed tracking-wide text-white uppercase italic">
                    {coachResponse?.feedback}
                  </p>
                )}
              </div>

              <Button 
                onClick={() => setIsCoachOpen(false)}
                className={cn(
                  "w-full h-12 font-black text-[10px] tracking-[0.3em] rounded-none border-2 bg-black",
                  coachResponse?.status === 'urgent' ? "border-destructive text-destructive hover:bg-destructive/10" : "border-[#a855f7] text-[#a855f7] hover:bg-[#a855f7]/10"
                )}
              >
                COMPRIS_AGENT
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <section className="flex flex-col items-center mb-12 sm:mb-16 relative py-4">
          {isMobile ? (
            <Dialog>
              <DialogTrigger asChild>
                <div className="cursor-pointer active:scale-95 transition-transform">
                  <CircularProgress 
                    size={220} 
                    strokeWidth={4} 
                    progress={calProgress} 
                    color="#ff003c"
                  >
                    <div className="flex flex-col items-center">
                      <span className="text-[8px] text-white/40 uppercase font-black tracking-[0.5em] mb-1 text-center">Flux Énergie</span>
                      <span className="text-4xl font-black tracking-tighter neon-text-red">{dailyLog.calories}</span>
                      <div className="w-16 h-[1px] bg-destructive/50 my-4 shadow-[0_0_20px_rgba(255,0,60,0.8)]" />
                      <span className="text-[8px] text-primary uppercase font-black tracking-[0.3em] neon-text-yellow">Objectif {goals.calories}</span>
                    </div>
                  </CircularProgress>
                </div>
              </DialogTrigger>
              <DialogContent className="bg-black/95 border-destructive neon-glow-red rounded-2xl p-6 max-w-[90vw]">
                <DialogHeader>
                  <DialogTitle className="text-destructive font-black uppercase tracking-widest text-sm mb-4">Diagnostic Énergie</DialogTitle>
                </DialogHeader>
                <p className="text-xs font-medium uppercase leading-relaxed text-white">
                  DÉPENSE QUOTIDIENNE TOTALE CALCULÉE POUR VOTRE PROFIL BIOMÉTRIQUE.
                </p>
              </DialogContent>
            </Dialog>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="cursor-help">
                  <CircularProgress 
                    size={260} 
                    strokeWidth={4} 
                    progress={calProgress} 
                    color="#ff003c"
                  >
                    <div className="flex flex-col items-center">
                      <span className="text-[10px] text-white/40 uppercase font-black tracking-[0.5em] mb-2 text-center">Flux Énergie</span>
                      <span className="text-6xl font-black tracking-tighter neon-text-red">{dailyLog.calories}</span>
                      <div className="w-20 h-[1px] bg-destructive/50 my-5 shadow-[0_0_20px_rgba(255,0,60,0.8)]" />
                      <span className="text-[9px] text-primary uppercase font-black tracking-[0.4em] neon-text-yellow">Objectif {goals.calories}</span>
                    </div>
                  </CircularProgress>
                </div>
              </TooltipTrigger>
              <TooltipContent className="max-w-[200px]">
                DÉPENSE QUOTIDIENNE TOTALE CALCULÉE POUR VOTRE PROFIL.
              </TooltipContent>
            </Tooltip>
          )}
        </section>

        <div className="laser-line-violet mb-12" />

        <section className="grid grid-cols-3 gap-2 sm:gap-6 mb-12">
          {/* Protéines */}
          {isMobile ? (
            <Dialog>
              <DialogTrigger asChild>
                <div className="flex flex-col items-center text-center space-y-3 cursor-pointer active:scale-95 transition-transform">
                  <div className="w-10 h-10 border border-primary/40 flex items-center justify-center bg-black shadow-[0_0_15px_rgba(253,224,71,0.2)]">
                     <Beef className="text-primary" size={16} />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] font-black block neon-text-yellow tracking-tight">{dailyLog.protein}g / {goals.protein}g</span>
                    <span className="text-[7px] text-white/40 uppercase font-black tracking-widest block">Protéines</span>
                  </div>
                </div>
              </DialogTrigger>
              <DialogContent className="bg-black/95 border-primary neon-glow-yellow rounded-2xl p-6 max-w-[90vw]">
                <DialogHeader>
                  <DialogTitle className="text-primary font-black uppercase tracking-widest text-sm mb-4">Synthèse Protéique</DialogTitle>
                </DialogHeader>
                <p className="text-xs font-medium uppercase leading-relaxed text-white">CIBLE : {goals.protein}G POUR LE MAINTIEN DE LA MASSE SÈCHE.</p>
              </DialogContent>
            </Dialog>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex flex-col items-center text-center space-y-4 cursor-help">
                  <div className="w-12 h-12 border border-primary/40 flex items-center justify-center bg-black shadow-[0_0_15px_rgba(253,224,71,0.2)]">
                     <Beef className="text-primary" size={16} />
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs font-black block neon-text-yellow tracking-tight">{dailyLog.protein}g / {goals.protein}g</span>
                    <span className="text-[8px] text-white/40 uppercase font-black tracking-widest block">Protéines</span>
                  </div>
                </div>
              </TooltipTrigger>
              <TooltipContent>CIBLE : {goals.protein}G.</TooltipContent>
            </Tooltip>
          )}

          {/* Glucides */}
          {isMobile ? (
            <Dialog>
              <DialogTrigger asChild>
                <div className="flex flex-col items-center text-center space-y-3 border-x border-white/5 px-1 cursor-pointer active:scale-95 transition-transform">
                  <div className="w-10 h-10 border border-accent/40 flex items-center justify-center bg-black shadow-[0_0_15px_rgba(0,242,255,0.2)]">
                     <Wheat className="text-accent" size={16} />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] font-black block neon-text-blue tracking-tight">{dailyLog.carbs}g / {goals.carbs}g</span>
                    <span className="text-[7px] text-white/40 uppercase font-black tracking-widest block">Glucides</span>
                  </div>
                </div>
              </DialogTrigger>
              <DialogContent className="bg-black/95 border-accent neon-glow-blue rounded-2xl p-6 max-w-[90vw]">
                <DialogHeader>
                  <DialogTitle className="text-accent font-black uppercase tracking-widest text-sm mb-4">Flux Glucides</DialogTitle>
                </DialogHeader>
                <p className="text-xs font-medium uppercase leading-relaxed text-white">CIBLE : {goals.carbs}G POUR LE CARBURANT NEURAL.</p>
              </DialogContent>
            </Dialog>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex flex-col items-center text-center space-y-4 border-x border-white/5 px-1 cursor-help">
                  <div className="w-12 h-12 border border-accent/40 flex items-center justify-center bg-black shadow-[0_0_15px_rgba(0,242,255,0.2)]">
                     <Wheat className="text-accent" size={16} />
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs font-black block neon-text-blue tracking-tight">{dailyLog.carbs}g / {goals.carbs}g</span>
                    <span className="text-[8px] text-white/40 uppercase font-black tracking-widest block">Glucides</span>
                  </div>
                </div>
              </TooltipTrigger>
              <TooltipContent>CIBLE : {goals.carbs}G.</TooltipContent>
            </Tooltip>
          )}

          {/* Lipides */}
          {isMobile ? (
            <Dialog>
              <DialogTrigger asChild>
                <div className="flex flex-col items-center text-center space-y-3 cursor-pointer active:scale-95 transition-transform">
                  <div className="w-10 h-10 border border-[#a855f7]/40 flex items-center justify-center bg-black shadow-[0_0_15px_rgba(168,85,247,0.2)]">
                     <Droplet className="text-[#a855f7]" size={16} />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] font-black block neon-text-violet tracking-tight">{dailyLog.fat}g / {goals.fat}g</span>
                    <span className="text-[7px] text-white/40 uppercase font-black tracking-widest block">Lipides</span>
                  </div>
                </div>
              </DialogTrigger>
              <DialogContent className="bg-black/95 border-[#a855f7] neon-glow-violet rounded-2xl p-6 max-w-[90vw]">
                <DialogHeader>
                  <DialogTitle className="text-[#a855f7] font-black uppercase tracking-widest text-sm mb-4">Système Lipidique</DialogTitle>
                </DialogHeader>
                <p className="text-xs font-medium uppercase leading-relaxed text-white">CIBLE : {goals.fat}G POUR L'INTÉGRITÉ CELLULAIRE.</p>
              </DialogContent>
            </Dialog>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex flex-col items-center text-center space-y-4 cursor-help">
                  <div className="w-12 h-12 border border-[#a855f7]/40 flex items-center justify-center bg-black shadow-[0_0_15px_rgba(168,85,247,0.2)]">
                     <Droplet className="text-[#a855f7]" size={16} />
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs font-black block neon-text-violet tracking-tight">{dailyLog.fat}g / {goals.fat}g</span>
                    <span className="text-[8px] text-white/40 uppercase font-black tracking-widest block">Lipides</span>
                  </div>
                </div>
              </TooltipTrigger>
              <TooltipContent>CIBLE : {goals.fat}G.</TooltipContent>
            </Tooltip>
          )}
        </section>

        <div className="laser-line-red mb-12" />

        <div className="mb-20">
          <HydrationCard />
        </div>

        <button 
          onClick={() => router.push('/journal')}
          className="fixed bottom-32 right-6 sm:right-8 w-14 h-14 sm:w-16 sm:h-16 bg-black text-destructive border-2 border-destructive shadow-[0_0_30px_rgba(255,0,60,0.6)] flex items-center justify-center hover:scale-110 active:scale-95 transition-all z-40 rounded-none group"
        >
          <Plus size={24} strokeWidth={3} className="group-hover:neon-text-red" />
        </button>

        <BottomNav />
      </main>
    </TooltipProvider>
  );
}
