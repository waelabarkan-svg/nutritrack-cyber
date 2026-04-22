
"use client"

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth-provider';
import { BottomNav } from '@/components/bottom-nav';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Plus, Trash2, Search, Coffee, Utensils, Moon, Apple } from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, addDoc, query, where, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { toast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export default function JournalPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [meals, setMeals] = useState<any[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [newMeal, setNewMeal] = useState({
    name: '',
    calories: '',
    protein: '',
    carbs: '',
    fat: '',
    type: 'breakfast' as MealType
  });

  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    if (!loading && !user) router.push('/login');
    if (user) fetchMeals();
  }, [user, loading, router]);

  const fetchMeals = async () => {
    if (!user) return;
    const mealsRef = collection(db, 'users', user.uid, 'meals');
    const q = query(mealsRef, where('date', '==', today));
    const querySnapshot = await getDocs(q);
    const mealsData: any[] = [];
    querySnapshot.forEach((doc) => {
      mealsData.push({ id: doc.id, ...doc.data() });
    });
    setMeals(mealsData);
  };

  const addMeal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    try {
      await addDoc(collection(db, 'users', user.uid, 'meals'), {
        ...newMeal,
        calories: parseInt(newMeal.calories),
        protein: parseInt(newMeal.protein),
        carbs: parseInt(newMeal.carbs),
        fat: parseInt(newMeal.fat),
        date: today,
        createdAt: new Date().toISOString()
      });
      setIsAdding(false);
      setNewMeal({ name: '', calories: '', protein: '', carbs: '', fat: '', type: 'breakfast' });
      fetchMeals();
      toast({ title: "Logged!", description: "Meal added to your journal." });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    }
  };

  const deleteMeal = async (id: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'meals', id));
      fetchMeals();
      toast({ title: "Removed", description: "Entry deleted." });
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
    <main className="px-6 pt-12 max-w-md mx-auto pb-32">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-black">Food Journal</h1>
        <Dialog open={isAdding} onOpenChange={setIsAdding}>
          <DialogTrigger asChild>
            <Button size="icon" className="rounded-full h-12 w-12 shadow-lg">
              <Plus size={24} />
            </Button>
          </DialogTrigger>
          <DialogContent className="glass border-none max-w-xs sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Add Food Item</DialogTitle>
            </DialogHeader>
            <form onSubmit={addMeal} className="space-y-4">
              <div className="space-y-1">
                <Label>Food Name</Label>
                <Input 
                  className="bg-secondary/50 border-none" 
                  placeholder="e.g. Avocado Toast"
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
                    className="bg-secondary/50 border-none"
                    value={newMeal.calories}
                    onChange={(e) => setNewMeal({...newMeal, calories: e.target.value})}
                    required 
                  />
                </div>
                <div className="space-y-1">
                  <Label>Meal Type</Label>
                  <Select 
                    value={newMeal.type} 
                    onValueChange={(v: any) => setNewMeal({...newMeal, type: v})}
                  >
                    <SelectTrigger className="bg-secondary/50 border-none">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="breakfast">Breakfast</SelectItem>
                      <SelectItem value="lunch">Lunch</SelectItem>
                      <SelectItem value="dinner">Dinner</SelectItem>
                      <SelectItem value="snack">Snack</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <Label className="text-[10px] uppercase">Prot. (g)</Label>
                  <Input 
                    type="number" 
                    className="bg-secondary/50 border-none"
                    value={newMeal.protein}
                    onChange={(e) => setNewMeal({...newMeal, protein: e.target.value})}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] uppercase">Carbs (g)</Label>
                  <Input 
                    type="number" 
                    className="bg-secondary/50 border-none"
                    value={newMeal.carbs}
                    onChange={(e) => setNewMeal({...newMeal, carbs: e.target.value})}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] uppercase">Fat (g)</Label>
                  <Input 
                    type="number" 
                    className="bg-secondary/50 border-none"
                    value={newMeal.fat}
                    onChange={(e) => setNewMeal({...newMeal, fat: e.target.value})}
                  />
                </div>
              </div>
              <Button type="submit" className="w-full h-12 font-bold mt-4">Log Food</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-8">
        {mealSections.map((section) => {
          const sectionMeals = meals.filter(m => m.type === section.type);
          const Icon = section.icon;
          return (
            <div key={section.type} className="space-y-3">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Icon size={18} />
                <h2 className="text-sm font-bold uppercase tracking-widest">{section.label}</h2>
              </div>
              
              <div className="space-y-2">
                {sectionMeals.length > 0 ? sectionMeals.map((meal) => (
                  <Card key={meal.id} className="glass p-4 border-none flex justify-between items-center group">
                    <div>
                      <h3 className="font-bold text-lg">{meal.name}</h3>
                      <div className="flex gap-3 text-xs text-muted-foreground mt-1">
                        <span>{meal.calories} kcal</span>
                        <span>•</span>
                        <span>P: {meal.protein}g</span>
                        <span>•</span>
                        <span>C: {meal.carbs}g</span>
                        <span>•</span>
                        <span>F: {meal.fat}g</span>
                      </div>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="text-destructive/50 hover:text-destructive hover:bg-destructive/10"
                      onClick={() => deleteMeal(meal.id)}
                    >
                      <Trash2 size={18} />
                    </Button>
                  </Card>
                )) : (
                  <p className="text-xs text-muted-foreground/50 italic px-2">No items logged yet.</p>
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
