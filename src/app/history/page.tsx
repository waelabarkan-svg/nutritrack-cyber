"use client"

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useFirestore } from '@/firebase';
import { BottomNav } from '@/components/bottom-nav';
import { Calendar } from '@/components/ui/calendar';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { Flame, Droplets } from 'lucide-react';

export default function HistoryPage() {
  const { user, loading } = useUser();
  const db = useFirestore();
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
      const mealsRef = collection(db, 'users', user.uid, 'meals');
      const qMeals = query(mealsRef, where('date', '==', selectedDate));
      const mealsSnap = await getDocs(qMeals);
      let totalCals = 0;
      mealsSnap.forEach(doc => totalCals += doc.data().calories || 0);

      const hydRef = collection(db, 'users', user.uid, 'hydration');
      const qHyd = query(hydRef, where('__name__', '==', selectedDate));
      const hydSnap = await getDocs(qHyd);
      let totalHyd = 0;
      hydSnap.forEach(doc => totalHyd = doc.data().amount || 0);

      setDailyData({ calories: totalCals, hydration: totalHyd });
    };

    fetchHistory();
  }, [user, date, db]);

  if (loading || !user) return null;

  return (
    <main className="px-6 pt-16 max-w-md mx-auto pb-32 min-h-screen bg-black text-white">
      <div className="space-y-1 mb-12">
        <p className="text-primary/60 text-[9px] font-black uppercase tracking-[0.5em] neon-text-red">Timeline Index</p>
        <h1 className="text-3xl font-black tracking-tighter uppercase neon-text-red">Archived Data</h1>
      </div>

      <div className="cyber-card-red mb-12 p-2 bg-black">
        <Calendar
          mode="single"
          selected={date}
          onSelect={setDate}
          className="rounded-none border-none text-white mx-auto"
        />
      </div>

      <div className="space-y-6">
        <h2 className="text-[9px] font-black uppercase tracking-[0.4em] text-muted-foreground px-1">Selected Phase Summary</h2>
        <div className="grid grid-cols-2 gap-6">
          <div className="cyber-card-red p-8 flex flex-col items-center bg-black">
            <Flame className="text-primary mb-4 shadow-[0_0_10px_rgba(255,0,0,0.5)]" size={32} />
            <span className="text-3xl font-black neon-text-red tracking-tighter">{dailyData.calories}</span>
            <span className="text-[9px] text-muted-foreground uppercase font-black tracking-widest mt-2">Energy Flux</span>
          </div>
          <div className="cyber-card-blue p-8 flex flex-col items-center bg-black">
            <Droplets className="text-accent mb-4 shadow-[0_0_10px_rgba(0,212,255,0.5)]" size={32} />
            <span className="text-3xl font-black neon-text-blue tracking-tighter">{dailyData.hydration}</span>
            <span className="text-[9px] text-muted-foreground uppercase font-black tracking-widest mt-2">Fluid Units</span>
          </div>
        </div>
      </div>

      <BottomNav />
    </main>
  );
}