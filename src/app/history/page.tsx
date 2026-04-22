
"use client"

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth-provider';
import { BottomNav } from '@/components/bottom-nav';
import { Card } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { Flame, Droplets } from 'lucide-react';

export default function HistoryPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [dailyData, setDailyData] = useState({
    calories: 0,
    hydration: 0
  });

  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [user, loading, router]);

  useEffect(() => {
    if (!user || !date) return;
    const selectedDate = date.toISOString().split('T')[0];

    const fetchHistory = async () => {
      // Fetch meals
      const mealsRef = collection(db, 'users', user.uid, 'meals');
      const qMeals = query(mealsRef, where('date', '==', selectedDate));
      const mealsSnap = await getDocs(qMeals);
      let totalCals = 0;
      mealsSnap.forEach(doc => totalCals += doc.data().calories || 0);

      // Fetch hydration
      const hydRef = collection(db, 'users', user.uid, 'hydration');
      const qHyd = query(hydRef, where('date', '==', selectedDate)); // Note: adjusted to collection pattern
      // In HydrationCard we use doc(db, 'users', user.uid, 'hydration', today);
      // Let's fix that fetch:
      const singleHydRef = collection(db, 'users', user.uid, 'hydration'); // Using collection approach for ease
      const qHyd2 = query(singleHydRef, where('__name__', '==', selectedDate));
      const hydSnap = await getDocs(qHyd2);
      let totalHyd = 0;
      hydSnap.forEach(doc => totalHyd = doc.data().amount || 0);

      setDailyData({ calories: totalCals, hydration: totalHyd });
    };

    fetchHistory();
  }, [user, date]);

  if (loading || !user) return null;

  return (
    <main className="px-6 pt-12 max-w-md mx-auto pb-32">
      <h1 className="text-3xl font-black mb-8">History</h1>

      <Card className="glass border-none mb-8 p-2">
        <Calendar
          mode="single"
          selected={date}
          onSelect={setDate}
          className="rounded-xl border-none"
        />
      </Card>

      <div className="space-y-4">
        <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground px-1">Selected Day Summary</h2>
        <div className="grid grid-cols-2 gap-4">
          <Card className="glass p-6 border-none flex flex-col items-center">
            <Flame className="text-primary mb-3" size={32} />
            <span className="text-2xl font-black">{dailyData.calories}</span>
            <span className="text-xs text-muted-foreground uppercase">Calories</span>
          </Card>
          <Card className="glass p-6 border-none flex flex-col items-center">
            <Droplets className="text-accent mb-3" size={32} />
            <span className="text-2xl font-black">{dailyData.hydration}</span>
            <span className="text-xs text-muted-foreground uppercase">Glasses</span>
          </Card>
        </div>
      </div>

      <BottomNav />
    </main>
  );
}
