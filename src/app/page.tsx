"use client"

import React, { useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useFirestore, useCollection, useDoc } from '@/firebase';
import { BottomNav } from '@/components/bottom-nav';
import { CircularProgress } from '@/components/circular-progress';
import { HydrationCard } from '@/components/hydration-card';
import { Card } from '@/components/ui/card';
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
    } else if (!authLoading && user && !statsLoading && !stats?.weight) {
      router.push('/profile');
    }
  }, [user, authLoading, stats, statsLoading, router]);

  if (authLoading || statsLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black">
        <div className="w-8 h-8 border border-primary border-t-transparent rounded-full animate-spin shadow-[0_0_10px_rgba(255,0,0,0.5)]"></div>
      </div>
    );
  }

  const displayStats = stats || {
    gender: 'male' as const,
    age: 25,
    height: 175,
    weight: 70,
    targetWeight: 70,
    activityLevel: 'moderate' as const,
    goal: 'maintain' as const
  };
  
  const goals = calculateNutritionGoals(displayStats);
  const calProgress = dailyLog.calories / goals.calories;

  return (
    <main className="px-6 pt-12 max-w-md mx-auto min-h-screen bg-black text-white selection:bg-primary/30">
      <header className="flex justify-between items-center mb-12">
        <div className="space-y-1">
          <p className="text-primary/60 text-[10px] font-black uppercase tracking-[0.4em] neon-text">System Active</p>
          <h1 className="text-3xl font-black tracking-tighter">AGENT {user?.displayName?.split(' ')[0].toUpperCase() || 'UNKNOWN'}</h1>
        </div>
        <div className="w-10 h-10 rounded-full border border-primary/40 bg-black flex items-center justify-center shadow-[0_0_15px_rgba(255,0,0,0.2)]">
          <span className="font-black text-primary text-sm">{user?.displayName?.[0] || 'A'}</span>
        </div>
      </header>

      <section className="flex flex-col items-center mb-12 relative py-4">
        <CircularProgress 
          size={260} 
          strokeWidth={4} 
          progress={calProgress} 
          color="#FF0000"
        >
          <div className="flex flex-col items-center">
            <span className="text-5xl font-black tracking-tighter neon-text">{dailyLog.calories}</span>
            <div className="w-12 h-[1px] bg-primary/30 my-2" />
            <span className="text-[9px] text-muted-foreground uppercase font-black tracking-[0.3em]">Goal {goals.calories}</span>
          </div>
        </CircularProgress>
      </section>

      <div className="laser-line-h" />

      <section className="grid grid-cols-3 gap-4 mb-8">
        <div className="flex flex-col items-center text-center space-y-2">
          <div className="w-8 h-8 rounded-full border border-primary/30 flex items-center justify-center mb-1">
             <Beef className="text-primary" size={14} />
          </div>
          <span className="text-lg font-black">{dailyLog.protein}g</span>
          <span className="text-[8px] text-muted-foreground uppercase font-bold tracking-widest">Protein</span>
        </div>
        <div className="flex flex-col items-center text-center space-y-2 border-x border-white/5">
          <div className="w-8 h-8 rounded-full border border-accent/30 flex items-center justify-center mb-1">
             <Wheat className="text-accent" size={14} />
          </div>
          <span className="text-lg font-black">{dailyLog.carbs}g</span>
          <span className="text-[8px] text-muted-foreground uppercase font-bold tracking-widest">Carbs</span>
        </div>
        <div className="flex flex-col items-center text-center space-y-2">
          <div className="w-8 h-8 rounded-full border border-accent/30 flex items-center justify-center mb-1">
             <Droplet className="text-accent" size={14} />
          </div>
          <span className="text-lg font-black">{dailyLog.fat}g</span>
          <span className="text-[8px] text-muted-foreground uppercase font-bold tracking-widest">Lipids</span>
        </div>
      </section>

      <div className="laser-line-h" />

      <div className="mb-12">
        <HydrationCard />
      </div>

      <button 
        onClick={() => router.push('/journal')}
        className="fixed bottom-24 right-6 w-14 h-14 bg-black text-primary rounded-full shadow-[0_0_15px_rgba(255,0,0,0.5)] flex items-center justify-center hover:scale-110 active:scale-95 transition-all z-40 border border-primary"
      >
        <Plus size={24} strokeWidth={3} />
      </button>

      <BottomNav />
    </main>
  );
}