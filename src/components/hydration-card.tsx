"use client"

import React, { useState, useEffect, useMemo } from 'react';
import { Droplets, Plus, Minus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useFirestore, useUser } from '@/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

export function HydrationCard() {
  const { user } = useUser();
  const db = useFirestore();
  const [glasses, setGlasses] = useState(0);
  const target = 8;
  const today = useMemo(() => new Date().toISOString().split('T')[0], []);

  useEffect(() => {
    if (!user) return;
    const fetchHydration = async () => {
      const docRef = doc(db, 'users', user.uid, 'hydration', today);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setGlasses(docSnap.data().amount || 0);
      }
    };
    fetchHydration();
  }, [user, today, db]);

  const updateHydration = async (newAmount: number) => {
    if (!user) return;
    const amount = Math.max(0, newAmount);
    setGlasses(amount);
    const docRef = doc(db, 'users', user.uid, 'hydration', today);
    try {
      setDoc(docRef, { amount }, { merge: true });
    } catch (e) {
      console.error(e);
    }
  };

  const progress = Math.min(glasses / target, 1);

  return (
    <Card className="cyber-card overflow-hidden relative p-6">
      <div 
        className="absolute bottom-0 left-0 right-0 bg-accent/20 transition-all duration-1000 ease-out shadow-[0_-5px_15px_rgba(30,144,255,0.2)]" 
        style={{ height: `${progress * 100}%` }}
      />
      <div className="relative z-10">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <Droplets className="text-accent" size={24} />
            <h3 className="font-bold text-lg uppercase tracking-tighter">Flux Hydrique</h3>
          </div>
          <span className="text-accent font-black text-2xl tracking-tighter shadow-accent/20 drop-shadow-sm">
            {glasses} <span className="text-sm font-normal text-muted-foreground">/ {target} UNITÉS</span>
          </span>
        </div>

        <div className="flex justify-center gap-4 mt-6">
          <Button 
            variant="outline" 
            size="icon" 
            className="rounded-xl border-accent/20 text-accent hover:bg-accent/10 h-12 w-12 bg-black"
            onClick={() => updateHydration(glasses - 1)}
          >
            <Minus size={20} />
          </Button>
          <Button 
            variant="outline" 
            size="icon" 
            className="rounded-xl bg-accent/10 border-accent/30 text-accent hover:bg-accent/20 w-16 h-16 shadow-[0_0_15px_rgba(30,144,255,0.3)]"
            onClick={() => updateHydration(glasses + 1)}
          >
            <Plus size={28} />
          </Button>
        </div>
      </div>
    </Card>
  );
}