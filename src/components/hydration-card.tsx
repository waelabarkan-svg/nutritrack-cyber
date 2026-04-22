
"use client"

import React, { useState, useEffect } from 'react';
import { Droplets, Plus, Minus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { useAuth } from './auth-provider';

export function HydrationCard() {
  const { user } = useAuth();
  const [glasses, setGlasses] = useState(0);
  const target = 8;
  const today = new Date().toISOString().split('T')[0];

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
  }, [user, today]);

  const updateHydration = async (newAmount: number) => {
    if (!user) return;
    const amount = Math.max(0, newAmount);
    setGlasses(amount);
    const docRef = doc(db, 'users', user.uid, 'hydration', today);
    try {
      await setDoc(docRef, { amount }, { merge: true });
    } catch (e) {
      console.error(e);
    }
  };

  const progress = Math.min(glasses / target, 1);

  return (
    <Card className="glass overflow-hidden relative p-6">
      <div 
        className="absolute bottom-0 left-0 right-0 bg-accent/20 transition-all duration-700 ease-out" 
        style={{ height: `${progress * 100}%` }}
      />
      <div className="relative z-10">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <Droplets className="text-accent" size={24} />
            <h3 className="font-semibold text-lg">Hydration</h3>
          </div>
          <span className="text-accent font-bold text-xl">{glasses} <span className="text-sm font-normal text-muted-foreground">/ {target} glasses</span></span>
        </div>

        <div className="flex justify-center gap-4 mt-6">
          <Button 
            variant="outline" 
            size="icon" 
            className="rounded-full border-accent/30 text-accent hover:bg-accent/10"
            onClick={() => updateHydration(glasses - 1)}
          >
            <Minus size={20} />
          </Button>
          <Button 
            variant="outline" 
            size="icon" 
            className="rounded-full bg-accent/20 border-accent/30 text-accent hover:bg-accent/40 w-14 h-14"
            onClick={() => updateHydration(glasses + 1)}
          >
            <Plus size={28} />
          </Button>
        </div>
      </div>
    </Card>
  );
}
