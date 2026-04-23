"use client"

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useFirestore } from '@/firebase';
import { BottomNav } from '@/components/bottom-nav';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { toast } from '@/hooks/use-toast';
import { UserStats } from '@/lib/nutrition-utils';

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
        if (docSnap.exists() && docSnap.data().weight) {
          setStats(docSnap.data() as UserStats);
        }
      };
      fetchStats();
    }
  }, [user, loading, router, db]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setDoc(doc(db, 'users', user.uid), stats, { merge: true });
    toast({ title: "System Ready", description: "Identity parameters updated." });
    router.push('/');
  };

  if (loading || !user) return null;

  return (
    <main className="px-4 sm:px-6 pt-12 sm:pt-16 max-w-md mx-auto pb-32 min-h-screen bg-black text-white">
      <div className="space-y-1 mb-8 sm:mb-12">
        <p className="text-primary/60 text-[8px] sm:text-[9px] font-black uppercase tracking-[0.5em] neon-text-red">Agent Profile</p>
        <h1 className="text-2xl sm:text-3xl font-black tracking-tighter uppercase neon-text-red">Biometric Data</h1>
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-6 sm:space-y-10">
        <div className="grid grid-cols-2 gap-4 sm:gap-6">
          <div className="space-y-2 sm:space-y-3">
            <Label className="text-[8px] sm:text-[9px] font-black uppercase tracking-widest text-muted-foreground">Genotype</Label>
            <Select 
              value={stats.gender} 
              onValueChange={(v: any) => setStats({...stats, gender: v})}
            >
              <SelectTrigger className="bg-white/5 border-white/10 h-12 sm:h-14 font-black">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-black border-white/10">
                <SelectItem value="male">MALE</SelectItem>
                <SelectItem value="female">FEMALE</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 sm:space-y-3">
            <Label className="text-[8px] sm:text-[9px] font-black uppercase tracking-widest text-muted-foreground">Chrono Age</Label>
            <Input 
              type="number" 
              className="bg-white/5 border-white/10 h-12 sm:h-14 font-black" 
              value={stats.age}
              onChange={(e) => setStats({...stats, age: parseInt(e.target.value)})}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:gap-6">
          <div className="space-y-2 sm:space-y-3">
            <Label className="text-[8px] sm:text-[9px] font-black uppercase tracking-widest text-muted-foreground">Altitude (CM)</Label>
            <Input 
              type="number" 
              className="bg-white/5 border-white/10 h-12 sm:h-14 font-black" 
              value={stats.height}
              onChange={(e) => setStats({...stats, height: parseInt(e.target.value)})}
            />
          </div>
          <div className="space-y-2 sm:space-y-3">
            <Label className="text-[8px] sm:text-[9px] font-black uppercase tracking-widest text-muted-foreground">Mass Index (KG)</Label>
            <Input 
              type="number" 
              className="bg-white/5 border-white/10 h-12 sm:h-14 font-black" 
              value={stats.weight}
              onChange={(e) => setStats({...stats, weight: parseInt(e.target.value)})}
            />
          </div>
        </div>

        <div className="space-y-2 sm:space-y-3">
          <Label className="text-[8px] sm:text-[9px] font-black uppercase tracking-widest text-muted-foreground">Target Vector (KG)</Label>
          <Input 
            type="number" 
            className="bg-white/5 border-white/10 h-12 sm:h-14 font-black" 
            value={stats.targetWeight}
            onChange={(e) => setStats({...stats, targetWeight: parseInt(e.target.value)})}
          />
        </div>

        <div className="space-y-2 sm:space-y-3">
          <Label className="text-[8px] sm:text-[9px] font-black uppercase tracking-widest text-muted-foreground">Activity Protocol</Label>
          <Select 
            value={stats.activityLevel} 
            onValueChange={(v: any) => setStats({...stats, activityLevel: v})}
          >
            <SelectTrigger className="bg-white/5 border-white/10 h-12 sm:h-14 font-black">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-black border-white/10">
              <SelectItem value="sedentary">MINIMAL</SelectItem>
              <SelectItem value="light">LIGHT (1-3/WK)</SelectItem>
              <SelectItem value="moderate">MODERATE (3-5/WK)</SelectItem>
              <SelectItem value="active">HIGH (6-7/WK)</SelectItem>
              <SelectItem value="very_active">EXTREME</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button type="submit" className="w-full h-14 sm:h-18 font-black text-sm sm:text-lg tracking-[0.2em] sm:tracking-[0.3em] border-primary neon-glow-red mt-2">
          SAVE PARAMETERS
        </Button>
      </form>

      <BottomNav />
    </main>
  );
}
