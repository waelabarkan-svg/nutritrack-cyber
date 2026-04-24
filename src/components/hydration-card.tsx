"use client"

import React, { useState, useEffect, useMemo } from 'react';
import { Droplets, Plus, Minus, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useFirestore, useUser, useDoc } from '@/firebase';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import { calculateNutritionGoals, UserStats } from '@/lib/nutrition-utils';

export function HydrationCard() {
  const { user } = useUser();
  const db = useFirestore();
  const [glasses, setGlasses] = useState(0);
  const today = useMemo(() => new Date().toISOString().split('T')[0], []);

  // Récupération des stats utilisateur pour l'objectif personnalisé
  const profileRef = useMemo(() => user ? doc(db, 'users', user.uid) : null, [db, user]);
  const { data: stats } = useDoc<UserStats>(profileRef as any);

  const displayStats: UserStats = (stats as UserStats) || {
    gender: 'male', age: 25, height: 175, weight: 70, targetWeight: 70, activityLevel: 'moderate', goal: 'maintain'
  };

  const goals = calculateNutritionGoals(displayStats);
  const targetMl = goals.hydrationMl;
  const targetGlasses = Math.ceil(targetMl / 250);

  useEffect(() => {
    if (!user) return;
    const docRef = doc(db, 'users', user.uid, 'hydration', today);
    
    const unsubscribe = onSnapshot(docRef, (snap) => {
      if (snap.exists()) {
        setGlasses(snap.data().amount || 0);
      } else {
        setGlasses(0);
      }
    });

    return () => unsubscribe();
  }, [user, today, db]);

  const updateHydration = async (newAmount: number) => {
    if (!user) return;
    const amount = Math.max(0, newAmount);
    const docRef = doc(db, 'users', user.uid, 'hydration', today);
    setDoc(docRef, { amount }, { merge: true });
  };

  const progress = Math.min(glasses / targetGlasses, 1);
  const isComplete = glasses >= targetGlasses;

  return (
    <TooltipProvider delayDuration={0}>
      <div className={`cyber-card-blue p-6 sm:p-8 bg-black relative overflow-hidden rounded-[20px] transition-all duration-1000 ${
        isComplete 
        ? 'border-accent shadow-[0_0_50px_rgba(0,242,255,0.6)]' 
        : 'border-accent/40 shadow-[0_0_30px_rgba(0,242,255,0.2)]'
      }`}>
        <div className="relative z-10">
          <div className="flex justify-between items-center mb-10">
            <div className="flex items-center gap-4">
              <div className={`w-10 h-10 sm:w-12 sm:h-12 border-2 flex items-center justify-center bg-black rounded-[12px] transition-all duration-500 ${
                isComplete ? 'border-accent neon-glow-blue' : 'border-accent/50'
              }`}>
                <Droplets className={isComplete ? "text-accent animate-pulse" : "text-accent/60"} size={20} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-black text-[10px] uppercase tracking-[0.4em] text-accent neon-text-blue truncate">Liquide de Refroidissement</h3>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info size={12} className="text-accent/40 cursor-help shrink-0" />
                    </TooltipTrigger>
                    <TooltipContent className="bg-black/95 border-accent/40 text-[10px] font-black uppercase tracking-widest p-4 max-w-[220px] z-[100]">
                      SYSTÈME DE REFROIDISSEMENT : ({displayStats.weight}KG * 35ML) + BONUS ACTIVITÉ ({goals.hydrationMl - (displayStats.weight * 35)}ML).
                    </TooltipContent>
                  </Tooltip>
                </div>
                <p className="text-[8px] text-muted-foreground font-black uppercase tracking-widest mt-2 truncate">Intégrité : {glasses * 250}ml / {targetMl}ml</p>
                <p className="text-[9px] text-primary font-black uppercase tracking-widest mt-1 neon-text-yellow">Objectif : {(targetMl / 1000).toFixed(1)}L</p>
              </div>
            </div>
            <div className="text-right pr-1 sm:pr-0">
              <span className={`font-black text-4xl sm:text-5xl tracking-tighter transition-all duration-500 ${isComplete ? 'text-accent neon-text-blue' : 'text-accent/80'}`}>
                {glasses}
              </span>
              <span className="text-[10px] text-muted-foreground block font-black uppercase tracking-widest">UNITÉS</span>
            </div>
          </div>

          <div className="flex justify-center items-center gap-4 sm:gap-8">
            <Button 
              variant="ghost" 
              size="icon" 
              className="text-white/20 h-10 w-10 hover:bg-accent/10 border-none"
              onClick={() => updateHydration(glasses - 1)}
            >
              <Minus size={18} />
            </Button>

            <div className="flex-1 h-2 bg-white/5 relative rounded-full overflow-hidden border border-white/5">
              <div 
                className={`h-full transition-all duration-1000 ${
                  isComplete 
                  ? 'bg-accent shadow-[0_0_25px_rgba(0,242,255,1)]' 
                  : 'bg-accent/60'
                }`}
                style={{ width: `${progress * 100}%` }}
              />
            </div>

            <Button 
              variant="ghost" 
              size="icon" 
              className={`h-14 w-14 sm:h-16 sm:w-16 border-2 transition-all duration-500 rounded-[12px] flex flex-col items-center justify-center gap-1 ${
                isComplete 
                ? 'border-accent text-accent shadow-[0_0_30px_rgba(0,242,255,0.5)]' 
                : 'border-primary text-primary shadow-[0_0_20px_rgba(253,224,71,0.3)]'
              }`}
              onClick={() => updateHydration(glasses + 1)}
            >
              <Plus size={24} strokeWidth={3} />
              <span className="text-[7px] font-black uppercase tracking-tighter">250ML</span>
            </Button>
          </div>

          {isComplete && (
            <p className="text-center text-[8px] font-black text-accent uppercase tracking-[0.5em] mt-6 animate-pulse neon-text-blue">
              SYSTÈME OPTIMAL - TEMPÉRATURE STABLE
            </p>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
