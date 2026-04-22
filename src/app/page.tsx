
"use client"

import React, { useMemo } from 'react';
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
  const { data: meals, loading: mealsLoading } = useCollection(mealsQuery);

  const dailyLog = useMemo(() => {
    let totals = { calories: 0, protein: 0, carbs: 0, fat: 0 };
    meals.forEach((meal: any) => {
      totals.calories += (meal.calories || 0);
      totals.protein += (meal.protein || 0);
      totals.carbs += (meal.carbs || 0);
      totals.fat += (meal.fat || 0);
    });
    return totals;
  }, [meals]);

  React.useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    } else if (!authLoading && user && !statsLoading && !stats?.weight) {
      router.push('/profile');
    }
  }, [user, authLoading, stats, statsLoading, router]);

  if (authLoading || statsLoading || mealsLoading || !user || !stats) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const goals = calculateNutritionGoals(stats);
  const calProgress = dailyLog.calories / goals.calories;

  return (
    <main className="px-6 pt-12 max-w-md mx-auto">
      <header className="flex justify-between items-end mb-10">
        <div>
          <h2 className="text-muted-foreground text-sm font-medium">Hello, {user.displayName?.split(' ')[0] || 'User'}</h2>
          <h1 className="text-3xl font-bold mt-1">Today's Summary</h1>
        </div>
        <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-primary/20 bg-secondary flex items-center justify-center">
          <span className="font-bold text-primary">{user.displayName?.[0] || 'U'}</span>
        </div>
      </header>

      <section className="flex flex-col items-center mb-10">
        <CircularProgress 
          size={240} 
          strokeWidth={16} 
          progress={calProgress} 
          color="hsl(var(--primary))"
        >
          <div className="flex flex-col items-center">
            <Flame className="text-primary mb-2" size={32} />
            <span className="text-4xl font-black">{dailyLog.calories}</span>
            <span className="text-sm text-muted-foreground uppercase font-bold tracking-wider">of {goals.calories} kcal</span>
          </div>
        </CircularProgress>
      </section>

      <section className="grid grid-cols-3 gap-4 mb-8">
        <Card className="glass p-4 flex flex-col items-center text-center">
          <Beef className="text-destructive mb-2" size={20} />
          <span className="text-lg font-bold">{dailyLog.protein}g</span>
          <span className="text-[10px] text-muted-foreground uppercase">Protein</span>
          <div className="w-full bg-secondary h-1 rounded-full mt-2 overflow-hidden">
            <div 
              className="bg-destructive h-full" 
              style={{ width: `${Math.min((dailyLog.protein / goals.protein) * 100, 100)}%` }} 
            />
          </div>
        </Card>
        <Card className="glass p-4 flex flex-col items-center text-center">
          <Wheat className="text-yellow-500 mb-2" size={20} />
          <span className="text-lg font-bold">{dailyLog.carbs}g</span>
          <span className="text-[10px] text-muted-foreground uppercase">Carbs</span>
          <div className="w-full bg-secondary h-1 rounded-full mt-2 overflow-hidden">
            <div 
              className="bg-yellow-500 h-full" 
              style={{ width: `${Math.min((dailyLog.carbs / goals.carbs) * 100, 100)}%` }} 
            />
          </div>
        </Card>
        <Card className="glass p-4 flex flex-col items-center text-center">
          <Droplet className="text-blue-400 mb-2" size={20} />
          <span className="text-lg font-bold">{dailyLog.fat}g</span>
          <span className="text-[10px] text-muted-foreground uppercase">Fat</span>
          <div className="w-full bg-secondary h-1 rounded-full mt-2 overflow-hidden">
            <div 
              className="bg-blue-400 h-full" 
              style={{ width: `${Math.min((dailyLog.fat / goals.fat) * 100, 100)}%` }} 
            />
          </div>
        </Card>
      </section>

      <HydrationCard />

      <button 
        onClick={() => router.push('/journal')}
        className="fixed bottom-24 right-6 w-16 h-16 bg-primary text-primary-foreground rounded-full shadow-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all z-40"
      >
        <Plus size={32} strokeWidth={3} />
      </button>

      <BottomNav />
    </main>
  );
}
