"use client"

import React, { useState, useEffect, useMemo } from 'react';
import { Droplets, Plus, Minus } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
    setDoc(docRef, { amount }, { merge: true });
  };

  const progress = Math.min(glasses / target, 1);

  return (
    <div className="cyber-card-blue p-6 bg-black relative overflow-hidden">
      <div className="relative z-10">
        <div className="flex justify-between items-center mb-10">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 border border-accent/40 flex items-center justify-center bg-black">
              <Droplets className="text-accent" size={18} />
            </div>
            <div>
              <h3 className="font-black text-[9px] uppercase tracking-[0.3em] text-accent neon-text-blue">Hydration Protocol</h3>
              <p className="text-[7px] text-muted-foreground font-black uppercase tracking-widest mt-1">Optimum Capacity: {target} Units</p>
            </div>
          </div>
          <div className="text-right">
            <span className="text-accent font-black text-4xl tracking-tighter neon-text-blue">
              {glasses}
            </span>
          </div>
        </div>

        <div className="flex justify-center items-center gap-10">
          <Button 
            variant="ghost" 
            size="icon" 
            className="border border-accent/20 text-accent h-10 w-10 hover:bg-accent/10 border-none"
            onClick={() => updateHydration(glasses - 1)}
          >
            <Minus size={16} />
          </Button>
          <div className="flex-1 max-w-[140px] h-[1px] bg-white/5 relative">
            <div 
              className="bg-accent h-full transition-all duration-1000 shadow-[0_0_10px_rgba(0,212,255,0.8)]"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            className="border border-accent text-accent h-14 w-14 shadow-[0_0_15px_rgba(0,212,255,0.3)] hover:bg-accent/10 rounded-none"
            onClick={() => updateHydration(glasses + 1)}
          >
            <Plus size={24} />
          </Button>
        </div>
      </div>
    </div>
  );
}
