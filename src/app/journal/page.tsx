"use client"

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useFirestore, useCollection } from '@/firebase';
import { BottomNav } from '@/components/bottom-nav';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
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
    try {
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
      toast({ title: "Journal Updated", description: "Entry added to local database." });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    }
  };

  const deleteMeal = async (id: string) => {
    if (!user) return;
    try {
      deleteDoc(doc(db, 'users', user.uid, 'meals', id));
      toast({ title: "Deleted", description: "Entry removed." });
    } catch (e) {
      console.error(e);
    }
  };

  const mealSections: { type: MealType; label: string; icon: any }[] = [
    { type: 'breakfast', label: 'Breakfast', icon: Coffee },
    { type: 'lunch', label: 'Lunch', icon: Utensils },
    { type: 'dinner', label: 'Dinner', icon: Moon },
    { type: 'snack', label: 'Snacks', icon: Apple },
  ];

  if (loading || !user) return null;

  return (
    <main className="px-6 pt-12 max-w-md mx-auto pb-32 min-h-screen bg-black">
      <div className="flex justify-between items-center mb-12">
        <div className="space-y-1">
          <p className="text-primary/60 text-[10px] font-black uppercase tracking-[0.4em] neon-text">Log System</p>
          <h1 className="text-3xl font-black tracking-tighter">DAILY JOURNAL</h1>
        </div>
        <Dialog open={isAdding} onOpenChange={setIsAdding}>
          <DialogTrigger asChild>
            <Button size="icon" className="rounded-full w-12 h-12">
              <Plus size={24} />
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-black border border-primary/40 rounded-3xl max-w-[90vw] text-white">
            <DialogHeader>
              <DialogTitle className="text-xl font-black uppercase tracking-widest text-primary neon-text">New Entry</DialogTitle>
            </DialogHeader>
            <form onSubmit={addMeal} className="space-y-6">
              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">Item Name</Label>
                <Input 
                  className="bg-white/5 border-white/10 h-12 rounded-xl" 
                  placeholder="QUINOA SALAD"
                  value={newMeal.name}
                  onChange={(e) => setNewMeal({...newMeal, name: e.target.value})}
                  required 
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">Calories</Label>
                  <Input 
                    type="number" 
                    className="bg-white/5 border-white/10 h-12 rounded-xl"
                    value={newMeal.calories}
                    onChange={(e) => setNewMeal({...newMeal, calories: e.target.value})}
                    required 
                  />
                </div>
                <div className="space-y-2">
                   <Label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">Period</Label>
                  <Select 
                    value={newMeal.type} 
                    onValueChange={(v: any) => setNewMeal({...newMeal, type: v})}
                  >
                    <SelectTrigger className="bg-white/5 border-white/10 h-12 rounded-xl">
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
              <Button type="submit" className="w-full h-14 font-black">SAVE ENTRY</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-12">
        {mealSections.map((section) => {
          const sectionMeals = (meals || []).filter(m => m.type === section.type);
          const Icon = section.icon;
          return (
            <div key={section.type} className="space-y-4">
              <div className="flex items-center gap-3 text-muted-foreground">
                <Icon size={14} className="text-primary/60" />
                <h2 className="text-[10px] font-black uppercase tracking-[0.3em]">{section.label}</h2>
              </div>
              
              <div className="space-y-3">
                {sectionMeals.length > 0 ? sectionMeals.map((meal) => (
                  <Card key={meal.id} className="cyber-card p-4 flex justify-between items-center group">
                    <div className="space-y-1">
                      <h3 className="font-black text-sm uppercase tracking-tight">{meal.name}</h3>
                      <div className="flex gap-4 text-[9px] font-bold text-muted-foreground">
                        <span className="text-primary neon-text">{meal.calories} KCAL</span>
                        <span className="opacity-40">/</span>
                        <span>P: {meal.protein}G</span>
                        <span>C: {meal.carbs}G</span>
                        <span>F: {meal.fat}G</span>
                      </div>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="text-white/20 hover:text-primary hover:bg-primary/10 rounded-full w-8 h-8"
                      onClick={() => deleteMeal(meal.id)}
                    >
                      <Trash2 size={14} />
                    </Button>
                  </Card>
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