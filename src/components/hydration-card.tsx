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
    <div className="cyber-card-blue p-8 bg-black relative overflow-hidden rounded-[20px] border-accent/40 shadow-[0_0_30px_rgba(0,242,255,0.2)]">
      <div className="relative z-10">
        <div className="flex justify-between items-center mb-12">
          <div className="flex items-center gap-5">
            <div className="w-12 h-12 border-2 border-accent/50 flex items-center justify-center bg-black rounded-[12px] shadow-[0_0_15px_rgba(0,242,255,0.3)]">
              <Droplets className="text-accent" size={20} />
            </div>
            <div>
              <h3 className="font-black text-[10px] uppercase tracking-[0.4em] text-accent neon-text-blue">Fluid Integrity</h3>
              <p className="text-[8px] text-muted-foreground font-black uppercase tracking-widest mt-2">Nominal Capacity: {target} Units</p>
            </div>
          </div>
          <div className="text-right">
            <span className="text-accent font-black text-5xl tracking-tighter neon-text-blue">
              {glasses}
            </span>
          </div>
        </div>

        <div className="flex justify-center items-center gap-12">
          <Button 
            variant="ghost" 
            size="icon" 
            className="text-accent h-12 w-12 hover:bg-accent/10 border-none"
            onClick={() => updateHydration(glasses - 1)}
          >
            <Minus size={20} />
          </Button>
          <div className="flex-1 max-w-[160px] h-[2px] bg-white/10 relative rounded-full overflow-hidden">
            <div 
              className="bg-accent h-full transition-all duration-1000 shadow-[0_0_20px_rgba(0,242,255,1)]"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            className="border-2 border-primary text-primary h-16 w-16 shadow-[0_0_25px_rgba(253,224,71,0.4)] hover:bg-primary/10 rounded-[12px]"
            onClick={() => updateHydration(glasses + 1)}
          >
            <Plus size={28} />
          </Button>
        </div>
      </div>
    </div>
  );
}