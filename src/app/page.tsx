
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
import { Plus, Flame, Beef, Wheat, Droplet, Zap, Sparkles, AlertTriangle, Loader2, Cpu } from 'lucide-react';
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
  
  // États pour le Coach
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

  // Sync Hydratation pour le coach
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

  if (!mounted) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black">
        <div className="w-12 h-12 border border-accent border-t-transparent animate-spin shadow-[0_0_25px_rgba(0,242,255,0.7)] rounded-full"></div>
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={0}>
      <main className="px-4 sm:px-6 pt-12 sm:pt-16 max-w-md mx-auto min-h-screen bg-black text-white pb-32">
        <header className="flex justify-between items-start mb-12 sm:mb-16">
          <div className="space-y-1">
            <p className="text-accent/60 text-[8px] sm:text-[9px] font-black uppercase tracking-[0.4em] sm:tracking-[0.5em] neon-text-blue">Système en ligne</p>
            <h1 className="text-lg sm:text-xl font-black tracking-[0.15em] sm:tracking-[0.2em] neon-text-blue uppercase">Accueil</h1>
          </div>
          <div className="flex flex-col items-end gap-2">
            <Button 
              onClick={handleCoachClick}
              className="h-9 px-4 bg-black border-accent/40 text-accent text-[9px] font-black uppercase tracking-widest rounded-none hover:bg-accent/10 hover:border-accent shadow-[0_0_15px_rgba(0,242,255,0.2)]"
            >
              <Zap size={14} className="mr-2" />
              Liaison Coach
            </Button>
            <div className="text-right">
              <span className="text-[7px] sm:text-[8px] font-black text-muted-foreground uppercase tracking-widest">ID: {user?.uid.substring(0, 8) || 'GUEST'}</span>
            </div>
          </div>
        </header>

        {/* Modale du Coach */}
        <Dialog open={isCoachOpen} onOpenChange={setIsCoachOpen}>
          <DialogContent className={cn(
            "bg-black/95 backdrop-blur-2xl border-2 rounded-none p-8 max-w-sm transition-colors duration-500 shadow-[0_0_50px_rgba(0,0,0,0.5)]",
            coachResponse?.status === 'urgent' ? "border-destructive neon-glow-red" : "border-accent neon-glow-blue"
          )}>
            <DialogHeader>
              <DialogTitle className="sr-only">Diagnostic du Coach IA</DialogTitle>
              <DialogDescription className="sr-only">Analyse neurale de vos performances biométriques.</DialogDescription>
            </DialogHeader>

            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "w-12 h-12 border flex items-center justify-center",
                  coachResponse?.status === 'urgent' ? "border-destructive text-destructive" : "border-accent text-accent"
                )}>
                  {isCoachLoading ? <Loader2 className="animate-spin" size={24} /> : coachResponse?.status === 'urgent' ? <AlertTriangle size={24} className="animate-pulse" /> : <Cpu size={24} />}
                </div>
                <div>
                  <h3 className={cn(
                    "text-[10px] font-black uppercase tracking-[0.4em]",
                    coachResponse?.status === 'urgent' ? "text-destructive neon-text-red" : "text-accent neon-text-blue"
                  )}>
                    {isCoachLoading ? "Synchronisation..." : "Diagnostic Neural"}
                  </h3>
                  <p className="text-[8px] text-white/40 font-black uppercase tracking-widest">Agent: Gemini-1.5-Flash</p>
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
                  coachResponse?.status === 'urgent' ? "border-destructive text-destructive hover:bg-destructive/10" : "border-accent text-accent hover:bg-accent/10"
                )}
              >
                COMPRIS_AGENT
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <section className="flex flex-col items-center mb-12 sm:mb-16 relative py-4">
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="cursor-help">
                <CircularProgress 
                  size={isMobile ? 220 : 260} 
                  strokeWidth={4} 
                  progress={calProgress} 
                  color="#ff0055"
                >
                  <div className="flex flex-col items-center">
                    <span className="text-[8px] sm:text-[10px] text-muted-foreground uppercase font-black tracking-[0.5em] mb-1 sm:mb-2 text-center">Flux Énergie</span>
                    <span className="text-4xl sm:text-6xl font-black tracking-tighter neon-text-red">{dailyLog.calories}</span>
                    <div className="w-16 sm:w-20 h-[1px] bg-destructive/50 my-4 sm:my-5 shadow-[0_0_20px_rgba(255,0,85,0.8)]" />
                    <span className="text-[8px] sm:text-[9px] text-primary uppercase font-black tracking-[0.3em] sm:tracking-[0.4em] neon-text-yellow">Objectif {goals.calories}</span>
                  </div>
                </CircularProgress>
              </div>
            </TooltipTrigger>
            <TooltipContent className="max-w-[200px]">
              FLUX ÉNERGÉTIQUE CALCULÉ SELON TON TDEE (DÉPENSE QUOTIDIENNE TOTALE).
            </TooltipContent>
          </Tooltip>
        </section>

        <div className="laser-line-blue mb-12" />

        <section className="grid grid-cols-3 gap-2 sm:gap-6 mb-12">
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex flex-col items-center text-center space-y-3 sm:space-y-4 cursor-help">
                <div className="w-10 h-10 sm:w-12 sm:h-12 border border-primary/40 flex items-center justify-center bg-black shadow-[0_0_15px_rgba(253,224,71,0.2)] rounded-none">
                   <Beef className="text-primary" size={16} />
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] sm:text-xs font-black block neon-text-yellow tracking-tight">{dailyLog.protein}g / {goals.protein}g</span>
                  <span className="text-[7px] sm:text-[8px] text-muted-foreground uppercase font-black tracking-widest block">Protéines</span>
                </div>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              CIBLE : {goals.protein}G. ESSENTIEL POUR LA RÉPARATION TISSULAIRE.
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex flex-col items-center text-center space-y-3 sm:space-y-4 border-x border-white/5 px-1 cursor-help">
                <div className="w-10 h-10 sm:w-12 sm:h-12 border border-accent/40 flex items-center justify-center bg-black shadow-[0_0_15px_rgba(0,242,255,0.2)] rounded-none">
                   <Wheat className="text-accent" size={16} />
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] sm:text-xs font-black block neon-text-blue tracking-tight">{dailyLog.carbs}g / {goals.carbs}g</span>
                  <span className="text-[7px] sm:text-[8px] text-muted-foreground uppercase font-black tracking-widest block">Glucides</span>
                </div>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              CIBLE : {goals.carbs}G. TON CARBURANT PRINCIPAL.
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex flex-col items-center text-center space-y-3 sm:space-y-4 cursor-help">
                <div className="w-10 h-10 sm:w-12 sm:h-12 border border-accent/40 flex items-center justify-center bg-black shadow-[0_0_15px_rgba(0,242,255,0.2)] rounded-none">
                   <Droplet className="text-accent" size={16} />
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] sm:text-xs font-black block neon-text-blue tracking-tight">{dailyLog.fat}g / {goals.fat}g</span>
                  <span className="text-[7px] sm:text-[8px] text-muted-foreground uppercase font-black tracking-widest block">Lipides</span>
                </div>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              CIBLE : {goals.fat}G. RÉGULATION HORMONALE.
            </TooltipContent>
          </Tooltip>
        </section>

        <div className="laser-line-red mb-12" />

        <div className="mb-20">
          <HydrationCard />
        </div>

        <button 
          onClick={() => router.push('/journal')}
          className="fixed bottom-32 right-6 sm:right-8 w-14 h-14 sm:w-16 sm:h-16 bg-black text-primary border-2 border-primary shadow-[0_0_30px_rgba(253,224,71,0.6)] flex items-center justify-center hover:scale-110 active:scale-95 transition-all z-40 rounded-none group"
        >
          <Plus size={24} strokeWidth={3} className="group-hover:neon-text-yellow" />
        </button>

        <BottomNav />
      </main>
    </TooltipProvider>
  );
}
