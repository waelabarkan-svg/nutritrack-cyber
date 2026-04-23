"use client"

import React, { useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useFirestore, useCollection, useDoc } from '@/firebase';
import { BottomNav } from '@/components/bottom-nav';
import { CircularProgress } from '@/components/circular-progress';
import { HydrationCard } from '@/components/hydration-card';
import { Plus, Flame, Beef, Wheat, Droplet } from 'lucide-react';
import { collection, query, where, doc } from 'firebase/firestore';
import { calculateNutritionGoals, UserStats } from '@/lib/nutrition-utils';

export default function Home() {
  const { user, loading: authLoading } = useUser();
  const db = useFirestore();
  const router = useRouter();
  const today = useMemo(() => new Date().toISOString().split('T')[0], []);

  const profileRef = useMemo(() => user ? doc(db, 'users', user.uid) : null, [db, user]);
  const { data: stats, loading: statsLoading } = useDoc<UserStats>(profileRef as any);

  const mealsQuery = useMemo(() => {
    if (!user) return null;
    return query(collection(db, 'users', user.uid, 'meals'), where('date', '==', today));
  }, [db, user, today]);
  const { data: meals } = useCollection(mealsQuery);

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

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    } else if (!authLoading && user && !statsLoading && stats && !stats.weight) {
      router.push('/profile');
    }
  }, [user, authLoading, stats, statsLoading, router]);

  if (authLoading || statsLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black">
        <div className="w-12 h-12 border border-accent border-t-transparent animate-spin shadow-[0_0_25px_rgba(0,242,255,0.7)] rounded-full"></div>
      </div>
    );
  }

  const displayStats: UserStats = (stats as UserStats) || {
    gender: 'male',
    age: 25,
    height: 175,
    weight: 70,
    targetWeight: 70,
    activityLevel: 'moderate',
    goal: 'maintain'
  };
  
  const goals = calculateNutritionGoals(displayStats);
  const calProgress = goals.calories > 0 ? dailyLog.calories / goals.calories : 0;

  return (
    <main className="px-6 pt-16 max-w-md mx-auto min-h-screen bg-black text-white selection:bg-accent/30">
      <header className="flex justify-between items-start mb-16">
        <div className="space-y-1">
          <p className="text-accent/60 text-[9px] font-black uppercase tracking-[0.5em] neon-text-blue">System Online</p>
          <h1 className="text-xl font-black tracking-[0.2em] neon-text-blue uppercase">NutriTrack</h1>
        </div>
        <div className="flex flex-col items-end">
          <div className="w-11 h-11 border border-primary/50 bg-black flex items-center justify-center shadow-[0_0_15px_rgba(253,224,71,0.4)] rounded-[12px]">
            <span className="font-black text-primary text-sm neon-text-yellow">{user?.displayName?.[0] || 'A'}</span>
          </div>
          <span className="text-[8px] font-black text-muted-foreground mt-2 uppercase tracking-widest">USER_ID: {user?.uid.substring(0, 8)}</span>
        </div>
      </header>

      <section className="flex flex-col items-center mb-16 relative py-4">
        <CircularProgress 
          size={250} 
          strokeWidth={2} 
          progress={calProgress} 
          color="#00f2ff"
        >
          <div className="flex flex-col items-center">
            <span className="text-[10px] text-muted-foreground uppercase font-black tracking-[0.5em] mb-2">Energy Flux</span>
            <span className="text-6xl font-black tracking-tighter neon-text-blue">{dailyLog.calories}</span>
            <div className="w-20 h-[1px] bg-accent/50 my-5 shadow-[0_0_20px_rgba(0,242,255,0.8)]" />
            <span className="text-[9px] text-primary uppercase font-black tracking-[0.4em] neon-text-yellow">Target {goals.calories}</span>
          </div>
        </CircularProgress>
      </section>

      <div className="laser-line-blue" />

      <section className="grid grid-cols-3 gap-6 mb-12">
        <div className="flex flex-col items-center text-center space-y-4">
          <div className="w-12 h-12 border border-primary/40 flex items-center justify-center bg-black shadow-[0_0_15px_rgba(253,224,71,0.2)] group rounded-[12px]">
             <Beef className="text-primary group-hover:scale-110 transition-transform" size={18} />
          </div>
          <div className="space-y-1">
            <span className="text-xl font-black block neon-text-yellow tracking-tight">{dailyLog.protein}g</span>
            <span className="text-[8px] text-muted-foreground uppercase font-black tracking-widest block">Proteins</span>
          </div>
        </div>
        <div className="flex flex-col items-center text-center space-y-4 border-x border-white/5 px-2">
          <div className="w-12 h-12 border border-accent/40 flex items-center justify-center bg-black shadow-[0_0_15px_rgba(0,242,255,0.2)] group rounded-[12px]">
             <Wheat className="text-accent group-hover:scale-110 transition-transform" size={18} />
          </div>
          <div className="space-y-1">
            <span className="text-xl font-black block neon-text-blue tracking-tight">{dailyLog.carbs}g</span>
            <span className="text-[8px] text-muted-foreground uppercase font-black tracking-widest block">Carbs</span>
          </div>
        </div>
        <div className="flex flex-col items-center text-center space-y-4">
          <div className="w-12 h-12 border border-accent/40 flex items-center justify-center bg-black shadow-[0_0_15px_rgba(0,242,255,0.2)] group rounded-[12px]">
             <Droplet className="text-accent group-hover:scale-110 transition-transform" size={18} />
          </div>
          <div className="space-y-1">
            <span className="text-xl font-black block neon-text-blue tracking-tight">{dailyLog.fat}g</span>
            <span className="text-[8px] text-muted-foreground uppercase font-black tracking-widest block">Lipids</span>
          </div>
        </div>
      </section>

      <div className="laser-line-yellow" />

      <div className="mb-20">
        <HydrationCard />
      </div>

      <button 
        onClick={() => router.push('/journal')}
        className="fixed bottom-32 right-8 w-16 h-16 bg-black text-primary border-2 border-primary shadow-[0_0_30px_rgba(253,224,71,0.6)] flex items-center justify-center hover:scale-110 active:scale-95 transition-all z-40 rounded-[20px] group"
      >
        <Plus size={28} strokeWidth={3} className="group-hover:neon-text-yellow" />
      </button>

      <BottomNav />
    </main>
  );
}