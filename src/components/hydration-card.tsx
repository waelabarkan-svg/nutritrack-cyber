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
    <Card className="cyber-card relative overflow-hidden p-6 border-accent/40 shadow-[0_0_10px_rgba(30,144,255,0.1)]">
      <div className="relative z-10">
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-3">
            <div className="p-2 border border-accent/30 rounded-lg bg-accent/5">
              <Droplets className="text-accent" size={18} />
            </div>
            <div>
              <h3 className="font-black text-xs uppercase tracking-[0.2em] text-accent/80">Hydration Flux</h3>
              <p className="text-[10px] text-muted-foreground font-bold uppercase">Optimal: {target} Units</p>
            </div>
          </div>
          <div className="text-right">
            <span className="text-accent font-black text-3xl tracking-tighter">
              {glasses}
            </span>
          </div>
        </div>

        <div className="flex justify-center items-center gap-8">
          <Button 
            variant="ghost" 
            size="icon" 
            className="rounded-full border border-accent/20 text-accent h-10 w-10"
            onClick={() => updateHydration(glasses - 1)}
          >
            <Minus size={16} />
          </Button>
          <div className="flex-1 max-w-[120px] h-1 bg-white/5 rounded-full overflow-hidden">
            <div 
              className="bg-accent h-full transition-all duration-1000 shadow-[0_0_8px_rgba(30,144,255,0.6)]"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            className="rounded-full border border-accent/50 text-accent h-14 w-14 shadow-[0_0_15px_rgba(30,144,255,0.2)]"
            onClick={() => updateHydration(glasses + 1)}
          >
            <Plus size={24} />
          </Button>
        </div>
      </div>
    </Card>
  );
}