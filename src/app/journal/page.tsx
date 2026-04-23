
"use client"

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useFirestore, useCollection } from '@/firebase';
import { BottomNav } from '@/components/bottom-nav';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Trash2, Search, Coffee, Utensils, Moon, Apple, Zap } from 'lucide-react';
import { collection, addDoc, query, where, deleteDoc, doc } from 'firebase/firestore';
import { toast } from '@/hooks/use-toast';
import foodDb from '@/lib/food-db.json';

type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export default function JournalPage() {
  const { user, loading } = useUser();
  const db = useFirestore();
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<MealType>('breakfast');

  const today = useMemo(() => new Date().toISOString().split('T')[0], []);

  const mealsQuery = useMemo(() => {
    if (!user) return null;
    return query(collection(db, 'users', user.uid, 'meals'), where('date', '==', today));
  }, [user, today, db]);

  const { data: meals } = useCollection(mealsQuery);

  const filteredFood = useMemo(() => {
    if (!searchTerm) return [];
    return foodDb.filter(f => f.name.toLowerCase().includes(searchTerm.toLowerCase())).slice(0, 5);
  }, [searchTerm]);

  const addMeal = async (food: any) => {
    if (!user) return;
    try {
      await addDoc(collection(db, 'users', user.uid, 'meals'), {
        ...food,
        type: selectedType,
        date: today,
        createdAt: new Date().toISOString()
      });
      setSearchTerm('');
      toast({ title: "SYSTEM UPDATED", description: `${food.name} ADDED TO PROTOCOL.` });
    } catch (e) {
      toast({ variant: "destructive", title: "ERROR", description: "FAILED TO COMMIT LOG." });
    }
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

  return (
    <main className="px-4 sm:px-6 pt-12 sm:pt-16 max-w-md mx-auto pb-32 min-h-screen bg-black text-white">
      <div className="space-y-1 mb-12">
        <p className="text-primary/60 text-[8px] sm:text-[9px] font-black uppercase tracking-[0.5em] neon-text-yellow">Log Interface</p>
        <h1 className="text-2xl sm:text-3xl font-black tracking-tighter uppercase neon-text-yellow">Journal Logs</h1>
      </div>

      {/* Search Bar Section */}
      <section className="mb-12 space-y-4">
        <div className="flex gap-2 mb-4 overflow-x-auto pb-2 scrollbar-hide">
          {['breakfast', 'lunch', 'dinner', 'snack'].map((type) => (
            <button
              key={type}
              onClick={() => setSelectedType(type as MealType)}
              className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest border rounded-full transition-all whitespace-nowrap ${
                selectedType === type 
                ? 'bg-primary text-black border-primary shadow-[0_0_15px_rgba(253,224,71,0.5)]' 
                : 'border-white/10 text-muted-foreground'
              }`}
            >
              {type}
            </button>
          ))}
        </div>
        
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-primary/40" size={18} />
          <Input 
            className="bg-white/5 border-primary/20 h-14 pl-12 font-black uppercase tracking-widest focus:border-primary/60 transition-all rounded-[12px]" 
            placeholder="SEARCH FOOD DATABASE..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Search Results */}
        {filteredFood.length > 0 && (
          <div className="cyber-card-yellow p-2 bg-black/90 border-primary/40 animate-in fade-in slide-in-from-top-2 duration-300">
            {filteredFood.map((food, idx) => (
              <div key={idx} className="flex justify-between items-center p-4 hover:bg-primary/5 rounded-[8px] transition-colors border-b border-white/5 last:border-none">
                <div className="space-y-1">
                  <p className="font-black text-xs tracking-wider uppercase">{food.name}</p>
                  <p className="text-[9px] text-muted-foreground uppercase">{food.calories} KCAL | P: {food.protein}G | C: {food.carbs}G</p>
                </div>
                <Button 
                  size="icon" 
                  className="w-10 h-10 border-primary neon-glow-yellow"
                  onClick={() => addMeal(food)}
                >
                  <Plus size={18} />
                </Button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Daily Logs List */}
      <div className="space-y-12">
        {mealSections.map((section) => {
          const sectionMeals = (meals || []).filter((m: any) => m.type === section.type);
          const Icon = section.icon;
          return (
            <div key={section.type} className="space-y-4">
              <div className="flex items-center gap-3">
                <Icon size={14} className="text-primary" />
                <h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-primary/70">{section.label}</h2>
              </div>
              
              <div className="space-y-3">
                {sectionMeals.length > 0 ? sectionMeals.map((meal: any) => (
                  <div key={meal.id} className="cyber-card-blue p-4 flex justify-between items-center bg-black/40 border-accent/20">
                    <div className="space-y-1">
                      <h3 className="font-black text-xs uppercase tracking-wider">{meal.name}</h3>
                      <div className="flex gap-3 text-[9px] font-black text-muted-foreground uppercase">
                        <span className="text-primary">{meal.calories} KCAL</span>
                        <span className="opacity-20">|</span>
                        <span>P: {meal.protein}G</span>
                        <span>C: {meal.carbs}G</span>
                      </div>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="text-white/10 hover:text-destructive hover:bg-destructive/5 border-none"
                      onClick={() => deleteMeal(meal.id)}
                    >
                      <Trash2 size={14} />
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
