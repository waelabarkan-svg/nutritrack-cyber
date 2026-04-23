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
import { Database, ShieldCheck } from 'lucide-react';

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
    if (user) {
      const fetchStats = async () => {
        const docRef = doc(db, 'users', user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setStats(prev => ({ ...prev, ...data }));
        }
      };
      fetchStats();
    }
  }, [user, db]);

  const goals = useMemo(() => calculateNutritionGoals(stats), [stats]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    try {
      await setDoc(doc(db, 'users', user.uid), stats, { merge: true });
      toast({ title: "SYSTÈME PRÊT", description: "Paramètres biométriques synchronisés." });
    } catch (e) {
      toast({ variant: "destructive", title: "ERREUR", description: "Échec de la mise à jour." });
    }
  };

  if (loading || !user) return null;

  return (
    <main className="px-6 pt-16 max-w-md mx-auto pb-32 min-h-screen bg-black text-white">
      <div className="space-y-1 mb-12">
        <p className="text-primary/60 text-[9px] font-black uppercase tracking-[0.5em] neon-text-yellow">Protocole: Identité</p>
        <h1 className="text-3xl font-black tracking-tighter uppercase neon-text-yellow">Paramètres</h1>
      </div>

      <div className="cyber-card-yellow p-6 mb-10 bg-black/40 border-primary/30 relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-2 opacity-20">
          <Database size={40} className="text-primary" />
        </div>
        <div className="relative z-10">
          <p className="text-[8px] font-black uppercase tracking-[0.3em] text-primary/80 mb-2">Projection Énergétique</p>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-black neon-text-yellow">{goals.calories}</span>
            <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">KCAL / JOUR</span>
          </div>
          <p className="text-[9px] text-muted-foreground uppercase font-medium mt-1">Basé sur vos paramètres neuraux</p>
        </div>
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-[8px] font-black uppercase tracking-widest text-muted-foreground ml-1">Génotype</Label>
            <Select 
              value={stats.gender} 
              onValueChange={(v: any) => setStats({...stats, gender: v})}
            >
              <SelectTrigger className="bg-white/5 border-primary/20 h-12 font-black uppercase text-[10px] tracking-widest focus:border-primary transition-all rounded-[10px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-black border-primary/20 text-white">
                <SelectItem value="male">HOMME</SelectItem>
                <SelectItem value="female">FEMME</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-[8px] font-black uppercase tracking-widest text-muted-foreground ml-1">Âge Chrono</Label>
            <Input 
              type="number" 
              className="bg-white/5 border-primary/20 h-12 font-black uppercase text-[10px] tracking-widest focus:border-primary transition-all rounded-[10px]" 
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
              className="bg-white/5 border-primary/20 h-12 font-black uppercase text-[10px] tracking-widest focus:border-primary transition-all rounded-[10px]" 
              value={stats.height}
              onChange={(e) => setStats({...stats, height: parseInt(e.target.value) || 0})}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-[8px] font-black uppercase tracking-widest text-muted-foreground ml-1">Masse (KG)</Label>
            <Input 
              type="number" 
              className="bg-white/5 border-primary/20 h-12 font-black uppercase text-[10px] tracking-widest focus:border-primary transition-all rounded-[10px]" 
              value={stats.weight}
              onChange={(e) => setStats({...stats, weight: parseInt(e.target.value) || 0})}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-[8px] font-black uppercase tracking-widest text-muted-foreground ml-1">Protocole d'Activité</Label>
          <Select 
            value={stats.activityLevel} 
            onValueChange={(v: any) => setStats({...stats, activityLevel: v})}
          >
            <SelectTrigger className="bg-white/5 border-primary/20 h-12 font-black uppercase text-[10px] tracking-widest focus:border-primary transition-all rounded-[10px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-black border-primary/20 text-white">
              <SelectItem value="sedentary">01_SÉDENTAIRE</SelectItem>
              <SelectItem value="light">02_ACTIVITÉ_LÉGÈRE</SelectItem>
              <SelectItem value="moderate">03_MODÉRÉMENT_ACTIF</SelectItem>
              <SelectItem value="active">04_INTENSIF</SelectItem>
              <SelectItem value="very_active">05_ATHLÈTE_ÉLITE</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="text-[8px] font-black uppercase tracking-widest text-muted-foreground ml-1">Objectif Primaire</Label>
          <Select 
            value={stats.goal} 
            onValueChange={(v: any) => setStats({...stats, goal: v})}
          >
            <SelectTrigger className="bg-white/5 border-primary/20 h-12 font-black uppercase text-[10px] tracking-widest focus:border-primary transition-all rounded-[10px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-black border-primary/20 text-white">
              <SelectItem value="lose">PERTE_DE_POIDS</SelectItem>
              <SelectItem value="maintain">MAINTENANCE</SelectItem>
              <SelectItem value="gain">PRISE_DE_MASSE</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button type="submit" className="w-full h-16 font-black text-xs tracking-[0.4em] border-primary neon-glow-yellow mt-6 rounded-[12px] group relative overflow-hidden">
          <span className="relative z-10 group-hover:neon-text-yellow transition-all">MISE_À_JOUR_DES_PARAMÈTRES</span>
          <div className="absolute inset-0 bg-primary/10 translate-y-full group-hover:translate-y-0 transition-transform duration-500" />
        </Button>
      </form>

      <BottomNav />
    </main>
  );
}
