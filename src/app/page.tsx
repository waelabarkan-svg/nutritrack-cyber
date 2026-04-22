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
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin neon-glow"></div>
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
    <main className="px-6 pt-12 max-w-md mx-auto min-h-screen bg-black text-white">
      <header className="flex justify-between items-end mb-10">
        <div>
          <h2 className="text-primary/70 text-xs font-bold uppercase tracking-[0.3em] neon-text">Status Cyber</h2>
          <h1 className="text-4xl font-black mt-1 tracking-tighter">Salut, {user?.displayName?.split(' ')[0] || 'Agent'}</h1>
        </div>
        <div className="w-12 h-12 rounded-xl border border-primary/30 bg-black flex items-center justify-center shadow-[0_0_15px_rgba(227,0,34,0.2)]">
          <span className="font-black text-primary text-xl">{user?.displayName?.[0] || 'A'}</span>
        </div>
      </header>

      <section className="flex flex-col items-center mb-10 relative">
        <div className="absolute inset-0 bg-primary/10 blur-[120px] rounded-full" />
        <CircularProgress 
          size={280} 
          strokeWidth={16} 
          progress={calProgress} 
          color="#FF0000"
        >
          <div className="flex flex-col items-center">
            <div className="w-14 h-14 bg-primary/10 border border-primary/20 rounded-full flex items-center justify-center mb-3 neon-glow">
              <Flame className="text-primary fill-primary/20" size={28} />
            </div>
            <span className="text-6xl font-black tracking-tighter neon-text">{dailyLog.calories}</span>
            <span className="text-[10px] text-muted-foreground uppercase font-black tracking-[0.2em] mt-1">CIBLE {goals.calories} KCAL</span>
          </div>
        </CircularProgress>
      </section>

      <section className="grid grid-cols-3 gap-3 mb-8">
        <Card className="cyber-card p-4 flex flex-col items-center text-center">
          <Beef className="text-primary mb-2 neon-text" size={20} />
          <span className="text-lg font-black">{dailyLog.protein}g</span>
          <span className="text-[9px] text-muted-foreground uppercase font-bold tracking-wider">Prot</span>
          <div className="w-full bg-white/5 h-1 rounded-full mt-3 overflow-hidden">
            <div 
              className="bg-primary h-full transition-all duration-1000 shadow-[0_0_8px_rgba(227,0,34,0.8)]" 
              style={{ width: `${Math.min((dailyLog.protein / goals.protein) * 100, 100)}%` }} 
            />
          </div>
        </Card>
        <Card className="cyber-card p-4 flex flex-col items-center text-center">
          <Wheat className="text-accent mb-2" size={20} />
          <span className="text-lg font-black">{dailyLog.carbs}g</span>
          <span className="text-[9px] text-muted-foreground uppercase font-bold tracking-wider">Gluc</span>
          <div className="w-full bg-white/5 h-1 rounded-full mt-3 overflow-hidden">
            <div 
              className="bg-accent h-full transition-all duration-1000 shadow-[0_0_8px_rgba(30,144,255,0.8)]" 
              style={{ width: `${Math.min((dailyLog.carbs / goals.carbs) * 100, 100)}%` }} 
            />
          </div>
        </Card>
        <Card className="cyber-card p-4 flex flex-col items-center text-center">
          <Droplet className="text-accent mb-2" size={20} />
          <span className="text-lg font-black">{dailyLog.fat}g</span>
          <span className="text-[9px] text-muted-foreground uppercase font-bold tracking-wider">Lip</span>
          <div className="w-full bg-white/5 h-1 rounded-full mt-3 overflow-hidden">
            <div 
              className="bg-accent h-full transition-all duration-1000 shadow-[0_0_8px_rgba(30,144,255,0.8)]" 
              style={{ width: `${Math.min((dailyLog.fat / goals.fat) * 100, 100)}%` }} 
            />
          </div>
        </Card>
      </section>

      <div className="mb-8">
        <HydrationCard />
      </div>

      <button 
        onClick={() => router.push('/journal')}
        className="fixed bottom-24 right-6 w-16 h-16 bg-primary text-white rounded-xl shadow-[0_0_20px_rgba(227,0,34,0.6)] flex items-center justify-center hover:scale-105 active:scale-95 transition-all z-40 border border-white/20"
      >
        <Plus size={32} strokeWidth={3} />
      </button>

      <BottomNav />
    </main>
  );
}