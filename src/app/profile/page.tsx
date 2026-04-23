"use client"

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useFirestore } from '@/firebase';
import { BottomNav } from '@/components/bottom-nav';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { toast } from '@/hooks/use-toast';
import { UserStats, calculateNutritionGoals } from '@/lib/nutrition-utils';
import { ShieldCheck, Activity, Target, Database } from 'lucide-react';

export default function ProfilePage() {
  const { user, loading } = useUser();
  const db = useFirestore();
  const router = useRouter();
  const [stats, setStats] = useState<UserStats>({
    gender: 'male',
    age: 25,
    height: 175,
    weight: 70,
    targetWeight: 70,
    activityLevel: 'moderate',
    goal: 'maintain'
  });

  useEffect(() => {
    if (!loading && !user) router.push('/login');
    if (user) {
      const fetchStats = async () => {
        const docRef = doc(db, 'users', user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.weight) {
            setStats(prev => ({ ...prev, ...data }));
          }
        }
      };
      fetchStats();
    }
  }, [user, loading, router, db]);

  const goals = useMemo(() => calculateNutritionGoals(stats), [stats]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    try {
      await setDoc(doc(db, 'users', user.uid), stats, { merge: true });
      toast({ title: "SYSTEM READY", description: "Biometric parameters synchronized." });
      router.push('/');
    } catch (e) {
      toast({ variant: "destructive", title: "ERROR", description: "Failed to update profile." });
    }
  };

  if (loading || !user) return null;

  return (
    <main className="px-4 sm:px-6 pt-12 sm:pt-16 max-w-md mx-auto pb-32 min-h-screen bg-black text-white">
      <div className="space-y-1 mb-8 sm:mb-12">
        <p className="text-primary/60 text-[8px] sm:text-[9px] font-black uppercase tracking-[0.5em] neon-text-red">Protocol: Identity</p>
        <h1 className="text-2xl sm:text-3xl font-black tracking-tighter uppercase neon-text-red">Biometric Data</h1>
      </div>

      {/* Target Preview Banner */}
      <div className="cyber-card-red p-6 mb-10 bg-black/40 border-destructive/30 border-dashed relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-2 opacity-20">
          <Database size={40} className="text-destructive" />
        </div>
        <div className="relative z-10">
          <p className="text-[8px] font-black uppercase tracking-[0.3em] text-destructive/80 mb-2">Real-time Projection</p>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-black neon-text-red">{goals.calories}</span>
            <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">KCAL / DAY</span>
          </div>
          <p className="text-[9px] text-muted-foreground uppercase font-medium mt-1">Based on current neural parameters</p>
        </div>
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-6 sm:space-y-8">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-[8px] font-black uppercase tracking-widest text-muted-foreground ml-1">Genotype</Label>
            <Select 
              value={stats.gender} 
              onValueChange={(v: any) => setStats({...stats, gender: v})}
            >
              <SelectTrigger className="bg-white/5 border-white/10 h-12 font-black uppercase text-[10px] tracking-widest focus:border-destructive/60 transition-all rounded-[10px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-black border-white/10">
                <SelectItem value="male">MALE_SPEC</SelectItem>
                <SelectItem value="female">FEMALE_SPEC</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-[8px] font-black uppercase tracking-widest text-muted-foreground ml-1">Chrono Age</Label>
            <Input 
              type="number" 
              className="bg-white/5 border-white/10 h-12 font-black uppercase text-[10px] tracking-widest focus:border-destructive/60 transition-all rounded-[10px]" 
              value={stats.age}
              onChange={(e) => setStats({...stats, age: parseInt(e.target.value) || 0})}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-[8px] font-black uppercase tracking-widest text-muted-foreground ml-1">Altitude (CM)</Label>
            <Input 
              type="number" 
              className="bg-white/5 border-white/10 h-12 font-black uppercase text-[10px] tracking-widest focus:border-destructive/60 transition-all rounded-[10px]" 
              value={stats.height}
              onChange={(e) => setStats({...stats, height: parseInt(e.target.value) || 0})}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-[8px] font-black uppercase tracking-widest text-muted-foreground ml-1">Mass Index (KG)</Label>
            <Input 
              type="number" 
              className="bg-white/5 border-white/10 h-12 font-black uppercase text-[10px] tracking-widest focus:border-destructive/60 transition-all rounded-[10px]" 
              value={stats.weight}
              onChange={(e) => setStats({...stats, weight: parseInt(e.target.value) || 0})}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-[8px] font-black uppercase tracking-widest text-muted-foreground ml-1">Activity Protocol</Label>
          <Select 
            value={stats.activityLevel} 
            onValueChange={(v: any) => setStats({...stats, activityLevel: v})}
          >
            <SelectTrigger className="bg-white/5 border-white/10 h-12 font-black uppercase text-[10px] tracking-widest focus:border-destructive/60 transition-all rounded-[10px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-black border-white/10">
              <SelectItem value="sedentary">01_SEDENTARY</SelectItem>
              <SelectItem value="light">02_LIGHT_TRAINING</SelectItem>
              <SelectItem value="moderate">03_MODERATE_ACTIVE</SelectItem>
              <SelectItem value="active">04_HIGH_INTENSITY</SelectItem>
              <SelectItem value="very_active">05_ELITE_ATHLETE</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="text-[8px] font-black uppercase tracking-widest text-muted-foreground ml-1">Primary Objective</Label>
          <Select 
            value={stats.goal} 
            onValueChange={(v: any) => setStats({...stats, goal: v})}
          >
            <SelectTrigger className="bg-white/5 border-white/10 h-12 font-black uppercase text-[10px] tracking-widest focus:border-destructive/60 transition-all rounded-[10px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-black border-white/10">
              <SelectItem value="lose">PURGE_FAT_STORAGE</SelectItem>
              <SelectItem value="maintain">MAINTAIN_EQUILIBRIUM</SelectItem>
              <SelectItem value="gain">AUGMENT_MUSCLE_MASS</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button type="submit" className="w-full h-16 font-black text-xs tracking-[0.4em] border-primary neon-glow-red mt-6 rounded-[12px] group relative overflow-hidden">
          <span className="relative z-10 group-hover:neon-text-red transition-all">SYNC_IDENTITY_PARAMS</span>
          <div className="absolute inset-0 bg-destructive/10 translate-y-full group-hover:translate-y-0 transition-transform duration-500" />
        </Button>
      </form>

      <BottomNav />
    </main>
  );
}
