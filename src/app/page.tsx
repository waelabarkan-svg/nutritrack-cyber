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

  // Fetch profile stats
  const profileRef = useMemo(() => user ? doc(db, 'users', user.uid) : null, [db, user]);
  const { data: stats, loading: statsLoading } = useDoc<UserStats>(profileRef as any);

  // Fetch today's meals
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
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // Fallback for demo if no stats exist yet
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
    <main className="px-6 pt-12 max-w-md mx-auto min-h-screen bg-[#0A0A0A] text-foreground">
      <header className="flex justify-between items-end mb-10">
        <div>
          <h2 className="text-muted-foreground text-xs font-bold uppercase tracking-[0.2em]">Tableau de Bord</h2>
          <h1 className="text-3xl font-black mt-1">Salut, {user?.displayName?.split(' ')[0] || 'Toi'}</h1>
        </div>
        <div className="w-12 h-12 rounded-2xl overflow-hidden border border-white/10 bg-secondary flex items-center justify-center shadow-xl">
          <span className="font-black text-primary text-xl">{user?.displayName?.[0] || 'U'}</span>
        </div>
      </header>

      <section className="flex flex-col items-center mb-10 relative">
        <div className="absolute inset-0 bg-primary/5 blur-[100px] rounded-full" />
        <CircularProgress 
          size={260} 
          strokeWidth={20} 
          progress={calProgress} 
          color="hsl(var(--primary))"
        >
          <div className="flex flex-col items-center">
            <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center mb-2">
              <Flame className="text-primary fill-primary/20" size={24} />
            </div>
            <span className="text-5xl font-black tracking-tighter">{dailyLog.calories}</span>
            <span className="text-[10px] text-muted-foreground uppercase font-black tracking-widest mt-1">sur {goals.calories} kcal</span>
          </div>
        </CircularProgress>
      </section>

      <section className="grid grid-cols-3 gap-3 mb-8">
        <Card className="glass p-4 flex flex-col items-center text-center border-none shadow-2xl">
          <Beef className="text-primary mb-2" size={20} />
          <span className="text-lg font-black">{dailyLog.protein}g</span>
          <span className="text-[9px] text-muted-foreground uppercase font-bold tracking-wider">Protéines</span>
          <div className="w-full bg-white/5 h-1.5 rounded-full mt-3 overflow-hidden">
            <div 
              className="bg-primary h-full transition-all duration-1000" 
              style={{ width: `${Math.min((dailyLog.protein / goals.protein) * 100, 100)}%` }} 
            />
          </div>
        </Card>
        <Card className="glass p-4 flex flex-col items-center text-center border-none shadow-2xl">
          <Wheat className="text-accent mb-2" size={20} />
          <span className="text-lg font-black">{dailyLog.carbs}g</span>
          <span className="text-[9px] text-muted-foreground uppercase font-bold tracking-wider">Glucides</span>
          <div className="w-full bg-white/5 h-1.5 rounded-full mt-3 overflow-hidden">
            <div 
              className="bg-accent h-full transition-all duration-1000" 
              style={{ width: `${Math.min((dailyLog.carbs / goals.carbs) * 100, 100)}%` }} 
            />
          </div>
        </Card>
        <Card className="glass p-4 flex flex-col items-center text-center border-none shadow-2xl">
          <Droplet className="text-accent mb-2" size={20} />
          <span className="text-lg font-black">{dailyLog.fat}g</span>
          <span className="text-[9px] text-muted-foreground uppercase font-bold tracking-wider">Lipides</span>
          <div className="w-full bg-white/5 h-1.5 rounded-full mt-3 overflow-hidden">
            <div 
              className="bg-accent h-full transition-all duration-1000" 
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
        className="fixed bottom-24 right-6 w-16 h-16 bg-primary text-primary-foreground rounded-2xl shadow-[0_20px_50px_rgba(177,18,38,0.4)] flex items-center justify-center hover:scale-105 active:scale-95 transition-all z-40 border border-white/10"
      >
        <Plus size={32} strokeWidth={3} />
      </button>

      <BottomNav />
    </main>
  );
}
