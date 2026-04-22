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
      toast({ title: "Journal mis à jour", description: "Le repas a été ajouté." });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Erreur", description: error.message });
    }
  };

  const deleteMeal = async (id: string) => {
    if (!user) return;
    try {
      deleteDoc(doc(db, 'users', user.uid, 'meals', id));
      toast({ title: "Supprimé", description: "L'entrée a été retirée." });
    } catch (e) {
      console.error(e);
    }
  };

  const mealSections: { type: MealType; label: string; icon: any }[] = [
    { type: 'breakfast', label: 'Petit-déjeuner', icon: Coffee },
    { type: 'lunch', label: 'Déjeuner', icon: Utensils },
    { type: 'dinner', label: 'Dîner', icon: Moon },
    { type: 'snack', label: 'En-cas', icon: Apple },
  ];

  if (loading || !user) return null;

  return (
    <main className="px-6 pt-12 max-w-md mx-auto pb-32 min-h-screen bg-[#0A0A0A]">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-black">Journal</h1>
        <Dialog open={isAdding} onOpenChange={setIsAdding}>
          <DialogTrigger asChild>
            <Button size="icon" className="rounded-2xl h-12 w-12 shadow-lg bg-primary text-primary-foreground">
              <Plus size={24} />
            </Button>
          </DialogTrigger>
          <DialogContent className="glass border-none max-w-[90vw] rounded-3xl">
            <DialogHeader>
              <DialogTitle className="text-2xl font-black">Ajouter un repas</DialogTitle>
            </DialogHeader>
            <form onSubmit={addMeal} className="space-y-4">
              <div className="space-y-1">
                <Label>Nom de l'aliment</Label>
                <Input 
                  className="bg-secondary/50 border-none h-12 rounded-xl" 
                  placeholder="ex: Salade de quinoa"
                  value={newMeal.name}
                  onChange={(e) => setNewMeal({...newMeal, name: e.target.value})}
                  required 
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>Calories</Label>
                  <Input 
                    type="number" 
                    className="bg-secondary/50 border-none h-12 rounded-xl"
                    value={newMeal.calories}
                    onChange={(e) => setNewMeal({...newMeal, calories: e.target.value})}
                    required 
                  />
                </div>
                <div className="space-y-1">
                  <Label>Type</Label>
                  <Select 
                    value={newMeal.type} 
                    onValueChange={(v: any) => setNewMeal({...newMeal, type: v})}
                  >
                    <SelectTrigger className="bg-secondary/50 border-none h-12 rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="glass border-none">
                      <SelectItem value="breakfast">Petit-déjeuner</SelectItem>
                      <SelectItem value="lunch">Déjeuner</SelectItem>
                      <SelectItem value="dinner">Dîner</SelectItem>
                      <SelectItem value="snack">En-cas</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <Label className="text-[10px] uppercase font-bold text-primary">Prot. (g)</Label>
                  <Input 
                    type="number" 
                    className="bg-secondary/50 border-none h-10 rounded-xl"
                    value={newMeal.protein}
                    onChange={(e) => setNewMeal({...newMeal, protein: e.target.value})}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] uppercase font-bold text-accent">Gluc. (g)</Label>
                  <Input 
                    type="number" 
                    className="bg-secondary/50 border-none h-10 rounded-xl"
                    value={newMeal.carbs}
                    onChange={(e) => setNewMeal({...newMeal, carbs: e.target.value})}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] uppercase font-bold text-accent">Lip. (g)</Label>
                  <Input 
                    type="number" 
                    className="bg-secondary/50 border-none h-10 rounded-xl"
                    value={newMeal.fat}
                    onChange={(e) => setNewMeal({...newMeal, fat: e.target.value})}
                  />
                </div>
              </div>
              <Button type="submit" className="w-full h-14 font-black text-lg mt-4 rounded-2xl shadow-xl">LOG FOOD</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-8">
        {mealSections.map((section) => {
          const sectionMeals = (meals || []).filter(m => m.type === section.type);
          const Icon = section.icon;
          return (
            <div key={section.type} className="space-y-3">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Icon size={18} />
                <h2 className="text-sm font-bold uppercase tracking-widest">{section.label}</h2>
              </div>
              
              <div className="space-y-2">
                {sectionMeals.length > 0 ? sectionMeals.map((meal) => (
                  <Card key={meal.id} className="glass p-4 border-none flex justify-between items-center group shadow-lg">
                    <div>
                      <h3 className="font-bold text-lg">{meal.name}</h3>
                      <div className="flex gap-3 text-xs text-muted-foreground mt-1">
                        <span className="text-primary font-bold">{meal.calories} kcal</span>
                        <span>•</span>
                        <span className="text-primary/70">P: {meal.protein}g</span>
                        <span className="text-accent/70">G: {meal.carbs}g</span>
                        <span className="text-accent/70">L: {meal.fat}g</span>
                      </div>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="text-destructive/30 hover:text-destructive hover:bg-destructive/10 rounded-xl"
                      onClick={() => deleteMeal(meal.id)}
                    >
                      <Trash2 size={18} />
                    </Button>
                  </Card>
                )) : (
                  <p className="text-xs text-muted-foreground/40 italic px-2">Aucune entrée.</p>
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
