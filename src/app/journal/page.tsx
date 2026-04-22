"use client"

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useFirestore, useCollection } from '@/firebase';
import { BottomNav } from '@/components/bottom-nav';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Trash2, Coffee, Utensils, Moon, Apple } from 'lucide-react';
import { collection, addDoc, query, where, deleteDoc, doc } from 'firebase/firestore';
import { toast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export default function JournalPage() {
  const { user, loading } = useUser();
  const db = useFirestore();
  const router = useRouter();
  const [isAdding, setIsAdding] = useState(false);
  const [newMeal, setNewMeal] = useState({
    name: '',
    calories: '',
    protein: '',
    carbs: '',
    fat: '',
    type: 'breakfast' as MealType
  });

  const today = useMemo(() => new Date().toISOString().split('T')[0], []);

  const mealsQuery = useMemo(() => {
    if (!user) return null;
    return query(collection(db, 'users', user.uid, 'meals'), where('date', '==', today));
  }, [user, today, db]);

  const { data: meals } = useCollection(mealsQuery);

  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [user, loading, router]);

  const addMeal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    addDoc(collection(db, 'users', user.uid, 'meals'), {
      ...newMeal,
      calories: parseInt(newMeal.calories) || 0,
      protein: parseInt(newMeal.protein) || 0,
      carbs: parseInt(newMeal.carbs) || 0,
      fat: parseInt(newMeal.fat) || 0,
      date: today,
      createdAt: new Date().toISOString()
    });
    setIsAdding(false);
    setNewMeal({ name: '', calories: '', protein: '', carbs: '', fat: '', type: 'breakfast' });
    toast({ title: "System Updated", description: "Log entry finalized." });
  };

  const deleteMeal = async (id: string) => {
    if (!user) return;
    deleteDoc(doc(db, 'users', user.uid, 'meals', id));
  };

  const mealSections: { type: MealType; label: string; icon: any }[] = [
    { type: 'breakfast', label: 'Breakfast Protocol', icon: Coffee },
    { type: 'lunch', label: 'Lunch Protocol', icon: Utensils },
    { type: 'dinner', label: 'Dinner Protocol', icon: Moon },
    { type: 'snack', label: 'Snack Protocol', icon: Apple },
  ];

  if (loading || !user) return null;

  return (
    <main className="px-6 pt-16 max-w-md mx-auto pb-32 min-h-screen bg-black text-white">
      <div className="flex justify-between items-end mb-16">
        <div className="space-y-1">
          <p className="text-primary/60 text-[9px] font-black uppercase tracking-[0.5em] neon-text-red">Archive Access</p>
          <h1 className="text-3xl font-black tracking-tighter uppercase neon-text-red">Journal Logs</h1>
        </div>
        <Dialog open={isAdding} onOpenChange={setIsAdding}>
          <DialogTrigger asChild>
            <Button size="icon" className="w-14 h-14 border border-primary shadow-[0_0_15px_rgba(255,0,0,0.3)]">
              <Plus size={24} />
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-black border border-primary/50 text-white max-w-[95vw]">
            <DialogHeader>
              <DialogTitle className="text-xl font-black uppercase tracking-widest text-primary neon-text-red">Create Log Entry</DialogTitle>
            </DialogHeader>
            <form onSubmit={addMeal} className="space-y-8 mt-4">
              <div className="space-y-2">
                <Label className="text-[9px] uppercase font-black tracking-[0.3em] text-muted-foreground">Identification</Label>
                <Input 
                  className="bg-white/5 border-white/10 h-14 font-black uppercase tracking-wider text-white" 
                  placeholder="ITEM DESCRIPTION"
                  value={newMeal.name}
                  onChange={(e) => setNewMeal({...newMeal, name: e.target.value.toUpperCase()})}
                  required 
                />
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="text-[9px] uppercase font-black tracking-[0.3em] text-muted-foreground">Calories (KCAL)</Label>
                  <Input 
                    type="number" 
                    className="bg-white/5 border-white/10 h-14 font-black text-white"
                    value={newMeal.calories}
                    onChange={(e) => setNewMeal({...newMeal, calories: e.target.value})}
                    required 
                  />
                </div>
                <div className="space-y-2">
                   <Label className="text-[9px] uppercase font-black tracking-[0.3em] text-muted-foreground">Sector</Label>
                  <Select 
                    value={newMeal.type} 
                    onValueChange={(v: any) => setNewMeal({...newMeal, type: v})}
                  >
                    <SelectTrigger className="bg-white/5 border-white/10 h-14 font-black text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-black border-white/10 text-white">
                      <SelectItem value="breakfast">Breakfast</SelectItem>
                      <SelectItem value="lunch">Lunch</SelectItem>
                      <SelectItem value="dinner">Dinner</SelectItem>
                      <SelectItem value="snack">Snack</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button type="submit" className="w-full h-16 font-black tracking-[0.2em] border-primary">COMMIT TO SYSTEM</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-16">
        {mealSections.map((section) => {
          const sectionMeals = (meals || []).filter((m: any) => m.type === section.type);
          const Icon = section.icon;
          return (
            <div key={section.type} className="space-y-6">
              <div className="flex items-center gap-4 text-muted-foreground">
                <Icon size={16} className="text-primary" />
                <h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-primary/70">{section.label}</h2>
              </div>
              
              <div className="space-y-4">
                {sectionMeals.length > 0 ? sectionMeals.map((meal: any) => (
                  <div key={meal.id} className="cyber-card-red p-5 flex justify-between items-center bg-black border border-primary/20">
                    <div className="space-y-2">
                      <h3 className="font-black text-sm uppercase tracking-wider">{meal.name}</h3>
                      <div className="flex gap-6 text-[9px] font-black text-muted-foreground uppercase tracking-widest">
                        <span className="text-primary neon-text-red">{meal.calories} KCAL</span>
                        <span className="opacity-20">|</span>
                        <span>P: {meal.protein}G</span>
                        <span>C: {meal.carbs}G</span>
                        <span>F: {meal.fat}G</span>
                      </div>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="text-white/10 hover:text-primary hover:bg-primary/5 border-none"
                      onClick={() => deleteMeal(meal.id)}
                    >
                      <Trash2 size={16} />
                    </Button>
                  </div>
                )) : (
                  <div className="h-[1px] w-full bg-white/5" />
                )}
              </div>
            </div>
          );
        })}
      </div>

      <BottomNav />
    </main>
  );
}
