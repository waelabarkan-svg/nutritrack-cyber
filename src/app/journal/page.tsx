
"use client"

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useFirestore, useCollection } from '@/firebase';
import { BottomNav } from '@/components/bottom-nav';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Plus, Trash2, Search, Coffee, Utensils, Moon, Apple, Zap, Sparkles, Loader2 } from 'lucide-react';
import { collection, addDoc, query, where, deleteDoc, doc } from 'firebase/firestore';
import { toast } from '@/hooks/use-toast';
import foodDb from '@/lib/food-db.json';
import { estimateDish } from '@/ai/flows/estimate-dish-flow';

type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export default function JournalPage() {
  const { user, loading } = useUser();
  const db = useFirestore();
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<MealType>('breakfast');
  const [isCustomOpen, setIsCustomOpen] = useState(false);
  const [aiEstimating, setAiEstimating] = useState(false);
  const [aiResult, setAiResult] = useState<any>(null);

  // Custom food form state
  const [customFood, setCustomFood] = useState({
    name: '',
    calories: '',
    protein: '',
    carbs: '',
    fat: ''
  });

  const today = useMemo(() => new Date().toISOString().split('T')[0], []);

  const mealsQuery = useMemo(() => {
    if (!user) return null;
    return query(collection(db, 'users', user.uid, 'meals'), where('date', '==', today));
  }, [user, today, db]);

  const { data: meals } = useCollection(mealsQuery);

  const filteredFood = useMemo(() => {
    if (!searchTerm) return [];
    return foodDb
      .filter(f => f.name.toLowerCase().includes(searchTerm.toLowerCase()))
      .slice(0, 8);
  }, [searchTerm]);

  const handleAiEstimate = async () => {
    if (!searchTerm || searchTerm.length < 3) return;
    setAiEstimating(true);
    setAiResult(null);
    try {
      const result = await estimateDish({ dishName: searchTerm });
      setAiResult(result);
    } catch (e) {
      toast({ variant: "destructive", title: "CONNECTION ERROR", description: "AI LINK FAILURE." });
    } finally {
      setAiEstimating(false);
    }
  };

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
      setAiResult(null);
      toast({ 
        title: "SYSTEM UPDATED", 
        description: food.aiAnalysis ? food.aiAnalysis.toUpperCase() : `${food.name} ADDED TO PROTOCOL.` 
      });
    } catch (e) {
      toast({ variant: "destructive", title: "ERROR", description: "FAILED TO COMMIT LOG." });
    }
  };

  const addCustomMeal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !customFood.name || !customFood.calories) return;
    
    const food = {
      name: customFood.name.toUpperCase(),
      calories: parseInt(customFood.calories),
      protein: parseInt(customFood.protein || '0'),
      carbs: parseInt(customFood.carbs || '0'),
      fat: parseInt(customFood.fat || '0'),
    };

    try {
      await addDoc(collection(db, 'users', user.uid, 'meals'), {
        ...food,
        type: selectedType,
        date: today,
        createdAt: new Date().toISOString()
      });
      setIsCustomOpen(false);
      setCustomFood({ name: '', calories: '', protein: '', carbs: '', fat: '' });
      toast({ title: "CUSTOM COMMITTED", description: "EXTERNAL DATA SYNCHRONIZED." });
    } catch (e) {
      toast({ variant: "destructive", title: "ERROR", description: "MANUAL OVERRIDE FAILED." });
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
      <div className="space-y-1 mb-8 sm:mb-12">
        <p className="text-primary/60 text-[8px] sm:text-[9px] font-black uppercase tracking-[0.5em] neon-text-yellow">Log Interface</p>
        <h1 className="text-2xl sm:text-3xl font-black tracking-tighter uppercase neon-text-yellow">Journal Logs</h1>
      </div>

      {/* Control Section */}
      <section className="mb-12 space-y-6">
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
        
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-primary/40" size={18} />
            <Input 
              className="bg-white/5 border-primary/20 h-14 pl-12 font-black uppercase tracking-widest focus:border-primary/60 transition-all rounded-[12px]" 
              placeholder="SEARCH PROTOCOLS..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <Dialog open={isCustomOpen} onOpenChange={setIsCustomOpen}>
            <DialogTrigger asChild>
              <Button className="h-14 w-14 sm:w-auto sm:px-4 border-primary neon-glow-yellow bg-black rounded-[12px]">
                <Plus size={20} className="sm:mr-2" />
                <span className="hidden sm:inline font-black text-[10px] tracking-widest">CUSTOM +</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-black border-primary/40 text-white rounded-[20px] max-w-[90vw] sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="text-xl font-black uppercase tracking-tighter neon-text-yellow">Custom Input Override</DialogTitle>
              </DialogHeader>
              <form onSubmit={addCustomMeal} className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Item Designation</Label>
                  <Input 
                    placeholder="E.G. PROTEIN BAR" 
                    className="bg-white/5 border-white/10 font-black"
                    value={customFood.name}
                    onChange={(e) => setCustomFood({...customFood, name: e.target.value})}
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Energy (KCAL)</Label>
                    <Input 
                      type="number" 
                      className="bg-white/5 border-white/10 font-black"
                      value={customFood.calories}
                      onChange={(e) => setCustomFood({...customFood, calories: e.target.value})}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Protein (G)</Label>
                    <Input 
                      type="number" 
                      className="bg-white/5 border-white/10 font-black"
                      value={customFood.protein}
                      onChange={(e) => setCustomFood({...customFood, protein: e.target.value})}
                    />
                  </div>
                </div>
                <Button type="submit" className="w-full h-14 border-primary neon-glow-yellow mt-4">
                  COMMIT TO ARCHIVE
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Search Results */}
        {(filteredFood.length > 0 || searchTerm.length > 2) && (
          <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
            {/* Database Results */}
            {filteredFood.map((food, idx) => (
              <div key={idx} className="cyber-card-yellow p-4 flex justify-between items-center bg-black/90 border-primary/40 rounded-[12px]">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="font-black text-xs tracking-wider uppercase">{food.name}</p>
                    {food.isDish && <span className="text-[7px] bg-primary/20 text-primary px-1 font-black rounded">PLATE</span>}
                  </div>
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

            {/* Smart Dish AI Estimation Trigger */}
            {!aiResult && (
              <Button 
                onClick={handleAiEstimate}
                disabled={aiEstimating}
                className="w-full h-14 border-[#a855f7] bg-black/80 text-[#a855f7] shadow-[0_0_20px_rgba(168,85,247,0.3)] hover:bg-[#a855f7]/10"
              >
                {aiEstimating ? <Loader2 className="animate-spin mr-2" size={16} /> : <Sparkles className="mr-2" size={16} />}
                <span className="font-black text-[10px] tracking-[0.2em] uppercase">
                  {aiEstimating ? "ANALYZING..." : "SMART DISH ANALYSIS [AI]"}
                </span>
              </Button>
            )}

            {/* AI Estimation Result */}
            {aiResult && (
              <div className="cyber-card-blue p-5 bg-black/90 border-[#a855f7] shadow-[0_0_30px_rgba(168,85,247,0.4)] rounded-[12px] animate-in zoom-in-95 duration-500">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <span className="text-[8px] font-black text-[#a855f7] uppercase tracking-[0.3em] block mb-1">IA ESTIMATE [EXPERIMENTAL]</span>
                    <h3 className="text-sm font-black text-white uppercase tracking-wider">{aiResult.name}</h3>
                  </div>
                  <Button 
                    size="icon" 
                    className="w-12 h-12 border-[#a855f7] bg-black text-[#a855f7] neon-glow-blue"
                    onClick={() => addMeal(aiResult)}
                  >
                    <Plus size={24} />
                  </Button>
                </div>
                <div className="grid grid-cols-4 gap-2 mb-4">
                  <div className="text-center">
                    <p className="text-[12px] font-black text-primary">{aiResult.calories}</p>
                    <p className="text-[7px] text-muted-foreground uppercase font-black">KCAL</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[12px] font-black text-white">{aiResult.protein}g</p>
                    <p className="text-[7px] text-muted-foreground uppercase font-black">PROT</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[12px] font-black text-white">{aiResult.carbs}g</p>
                    <p className="text-[7px] text-muted-foreground uppercase font-black">CARB</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[12px] font-black text-white">{aiResult.fat}g</p>
                    <p className="text-[7px] text-muted-foreground uppercase font-black">FAT</p>
                  </div>
                </div>
                <p className="text-[9px] italic text-[#a855f7]/80 font-black uppercase tracking-wider border-t border-[#a855f7]/20 pt-2">
                  "{aiResult.aiAnalysis}"
                </p>
              </div>
            )}
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
