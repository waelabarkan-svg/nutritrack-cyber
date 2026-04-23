"use client"

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useFirestore, useCollection } from '@/firebase';
import { BottomNav } from '@/components/bottom-nav';
import { Calendar } from '@/components/ui/calendar';
import { collection, query, where, doc, getDoc } from 'firebase/firestore';
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

  const selectedDateStr = useMemo(() => {
    if (!date) return '';
    const d = new Date(date);
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().split('T')[0];
  }, [date]);

  const mealsQuery = useMemo(() => {
    if (!user || !selectedDateStr) return null;
    return query(collection(db, 'users', user.uid, 'meals'), where('date', '==', selectedDateStr));
  }, [user, selectedDateStr, db]);

  const { data: meals } = useCollection(mealsQuery);

  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [user, loading, router]);

  useEffect(() => {
    if (!user || !selectedDateStr) return;

    const fetchHydration = async () => {
      const hydDocRef = doc(db, 'users', user.uid, 'hydration', selectedDateStr);
      try {
        const snap = await getDoc(hydDocRef);
        if (snap.exists()) {
          setDailyData(prev => ({ ...prev, hydration: snap.data()?.amount || 0 }));
        } else {
          setDailyData(prev => ({ ...prev, hydration: 0 }));
        }
      } catch (e) {
        setDailyData(prev => ({ ...prev, hydration: 0 }));
      }
    };

    fetchHydration();
  }, [user, selectedDateStr, db]);

  useEffect(() => {
    if (meals) {
      let total = 0;
      meals.forEach((m: any) => total += (m.calories || 0));
      setDailyData(prev => ({ ...prev, calories: total }));
    } else {
      setDailyData(prev => ({ ...prev, calories: 0 }));
    }
  }, [meals]);

  if (loading || !user) return null;

  return (
    <main className="px-6 pt-16 max-w-md mx-auto pb-32 min-h-screen bg-black text-white">
      <div className="space-y-1 mb-12">
        <p className="text-primary/60 text-[9px] font-black uppercase tracking-[0.5em] neon-text-red">Timeline Index</p>
        <h1 className="text-3xl font-black tracking-tighter uppercase neon-text-red">Archived Data</h1>
      </div>

      <div className="cyber-card-red mb-12 p-2 bg-black border border-primary/20 shadow-[0_0_10px_rgba(255,0,0,0.1)]">
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
          <div className="cyber-card-red p-8 flex flex-col items-center bg-black border border-primary/20 shadow-[0_0_15px_rgba(255,0,0,0.2)]">
            <div className="w-12 h-12 border border-primary/30 flex items-center justify-center bg-black mb-4">
               <Flame className="text-primary" size={24} />
            </div>
            <span className="text-3xl font-black neon-text-red tracking-tighter">{dailyData.calories}</span>
            <span className="text-[9px] text-muted-foreground uppercase font-black tracking-widest mt-2">Energy Flux</span>
          </div>
          <div className="cyber-card-blue p-8 flex flex-col items-center bg-black border border-accent/20 shadow-[0_0_15px_rgba(0,212,255,0.2)]">
            <div className="w-12 h-12 border border-accent/30 flex items-center justify-center bg-black mb-4">
               <Droplets className="text-accent" size={24} />
            </div>
            <span className="text-3xl font-black neon-text-blue tracking-tighter">{dailyData.hydration}</span>
            <span className="text-[9px] text-muted-foreground uppercase font-black tracking-widest mt-2">Fluid Units</span>
          </div>
        </div>
      </div>

      <div className="laser-line-h mt-12" />

      <BottomNav />
    </main>
  );
}