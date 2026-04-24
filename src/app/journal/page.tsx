"use client"

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useFirestore, useCollection } from '@/firebase';
import { BottomNav } from '@/components/bottom-nav';
import { 
  Plus, Search, Camera, Barcode, X, Droplets,
  Circle, Coffee, Sun, Moon, Cookie, Soup, Pizza, Beer,
  Zap, Loader2
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { collection, query, where, addDoc, doc, updateDoc } from 'firebase/firestore';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import foodDb from '@/lib/food-db.json';
import { estimateDish } from '@/ai/flows/estimate-dish-flow';
import { scanDish } from '@/ai/flows/scan-dish-flow';

export default function JournalPage() {
  const { user, loading } = useUser();
  const db = useFirestore();
  const router = useRouter();

  // ÉTATS DE L'INTERFACE
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isBarcodeOpen, setIsBarcodeOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // REQUÊTE FIREBASE POUR LES ARCHIVES
  const today = new Date().toISOString().split('T')[0];
  const mealsQuery = useMemo(() => {
    if (!user) return null;
    return query(collection(db, 'users', user.uid, 'meals'), where('date', '==', today));
  }, [db, user, today]);

  const { data: meals } = useCollection(mealsQuery);

  // MOTEUR DE RECHERCHE GLOBAL (FUSION TRIPARTITE)
  const globalSearchResults = useMemo(() => {
    if (!searchTerm || searchTerm.trim().length < 2) return [];

    try {
      // Fix .docs avec cast as any pour éviter l'erreur TS
      const firebaseData = (meals as any)?.docs 
        ? (meals as any).docs.map((d: any) => ({ id: d.id, ...d.data() }))
        : (Array.isArray(meals) ? meals : []);
      
      const localHistory = JSON.parse(localStorage.getItem('biometric_memory') || '[]');
      const allItems = [...(foodDb as any[]), ...localHistory, ...firebaseData];
      
      const queryLower = searchTerm.toLowerCase();
      const seenNames = new Set();
      
      return allItems.filter((item: any) => {
        const name = (item.name || item.product_name || "ALIMENT INCONNU").toString();
        const matches = name.toLowerCase().includes(queryLower);
        
        if (matches && !seenNames.has(name.toUpperCase())) {
          seenNames.add(name.toUpperCase());
          return true;
        }
        return false;
      }).slice(0, 15);
    } catch (e) {
      console.error("Crash du moteur de recherche:", e);
      return [];
    }
  }, [searchTerm, meals]);

  // FONCTION D'AJOUT DE REPAS (STABILISÉE)
  const addMeal = async (item: any, type: string = 'snack') => {
    if (!user) return;
    
    try {
      const mealData = {
        name: item.name || item.product_name || "ALIMENT INCONNU",
        calories: Number(item.calories) || 0,
        protein: Number(item.protein) || 0,
        carbs: Number(item.carbs) || 0,
        fat: Number(item.fat) || 0,
        sugar: Number(item.sugar) || 0, // Fix Sugar
        fiber: Number(item.fiber) || 0, // Fix Fiber
        date: today,
        type: type,
        isLiquid: !!item.isLiquid,
        createdAt: new Date().toISOString()
      };

      await addDoc(collection(db, 'users', user.uid, 'meals'), mealData);
      
      // Archivage local
      const localHistory = JSON.parse(localStorage.getItem('biometric_memory') || '[]');
      localStorage.setItem('biometric_memory', JSON.stringify([mealData, ...localHistory].slice(0, 50)));

      toast({ title: "SYNCHRONISATION RÉUSSIE", description: "Données bio-enregistrées." });
      setSearchTerm('');
    } catch (e) {
      toast({ variant: "destructive", title: "ERREUR DE LIAISON", description: "Échec de l'enregistrement." });
    }
  };

  // RECONSTRUCTION VIA LLAMA-4 (FIX TS)
  const reconstructBioData = async (dishName: string, mealId: string) => {
    if (!user) return;
    setIsAnalyzing(true);
    try {
      // Cast as any pour neutraliser les erreurs de types sur sugar, vitamins, etc.
      const result = await estimateDish({ dishName }) as any;
      
      const mealRef = doc(db, 'users', user.uid, 'meals', mealId);
      await updateDoc(mealRef, {
        calories: result.calories || 0,
        protein: result.protein || 0,
        carbs: result.carbs || 0,
        fat: result.fat || 0,
        sugar: result.sugar || 0,
        fiber: result.fiber || 0,
        vitamins: result.vitamins || "Non détecté",
        minerals: result.minerals || "Non détecté",
        aiAnalysis: result.aiAnalysis || "Analyse terminée."
      });

      toast({ title: "RÉGÉNÉRATION TERMINÉE", description: "Profil moléculaire mis à jour." });
    } catch (e) {
      console.error(e);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // PROTECTION D'ACCÈS
  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [user, loading, router]);

  if (loading || !user) return null;

  const categories = [
    { id: 'petit-déjeuner', label: 'Petit-Déjeuner', icon: Coffee },
    { id: 'déjeuner', label: 'Déjeuner', icon: Sun },
    { id: 'dîner', label: 'Dîner', icon: Moon },
    { id: 'snack', label: 'Snack', icon: Cookie },
  ];

  return (
    <main className="max-w-md mx-auto min-h-screen bg-black text-white relative shadow-[0_0_50px_rgba(0,0,0,0.8)] pb-32">
      
      {/* HEADER NÉON (PHASE 1 & 2) */}
      <div className="p-6 flex justify-between items-center">
        <h1 
          className="font-black text-2xl uppercase tracking-[0.2em] text-white"
          style={{ textShadow: '0 0 15px #00FFFF, 0 0 5px #00FFFF' }}
        >
          Journal
        </h1>
        
        <div className="flex gap-3">
          <button 
            onClick={() => setIsCameraOpen(true)}
            className="w-11 h-11 bg-white/5 border border-accent/30 rounded-lg flex items-center justify-center transition-all hover:bg-accent/10 hover:border-accent hover:shadow-[0_0_15px_rgba(0,242,255,0.4)]"
          >
            <Camera size={20} className="text-accent" />
          </button>
          <button 
            onClick={() => setIsBarcodeOpen(true)}
            className="w-11 h-11 bg-white/5 border border-accent/30 rounded-lg flex items-center justify-center transition-all hover:bg-accent/10 hover:border-accent hover:shadow-[0_0_15px_rgba(0,242,255,0.4)]"
          >
            <Barcode size={20} className="text-accent" />
          </button>
        </div>
      </div>

      {/* BARRE DE RECHERCHE (PHASE 3) */}
      <div className="px-6 mb-8">
        <div className="relative group">
          <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
            <Search size={14} className="text-white/20 group-focus-within:text-accent" />
          </div>
          <Input 
            type="text"
            placeholder="RECHERCHER UN ALIMENT..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-black/40 border-white/10 pl-11 h-12 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] focus:border-accent focus:ring-1 focus:ring-accent/30"
          />
          {searchTerm && (
            <button 
              onClick={() => setSearchTerm('')}
              className="absolute inset-y-0 right-4 flex items-center text-white/20 hover:text-white"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* AFFICHAGE (RECHERCHE OU JOURNAL) */}
      <div className="px-6">
        {searchTerm ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-[9px] font-black uppercase tracking-[0.4em] text-accent neon-text-blue">
                Résultats de Recherche
              </h2>
              <span className="text-[8px] font-black text-white/20 uppercase">{globalSearchResults.length} Archives</span>
            </div>

            {globalSearchResults.length > 0 ? (
              <div className="grid gap-3">
                {globalSearchResults.map((item: any, idx: number) => (
                  <div 
                    key={idx}
                    onClick={() => addMeal(item)}
                    className="bg-blue-500/5 border border-blue-500/20 p-4 rounded-xl flex items-center justify-between group cursor-pointer hover:bg-blue-500/10 transition-all duration-300"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-blue-500/10 border border-blue-500/30 rounded-lg flex items-center justify-center text-blue-400">
                        {item.isDish ? <Soup size={18} /> : (item.isLiquid ? <Beer size={18} /> : <Pizza size={18} />)}
                      </div>
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-white">
                          {item.name || item.product_name || "ALIMENT INCONNU"}
                        </p>
                        <p className="text-[8px] text-white/40 uppercase font-black mt-1">
                          {item.calories} kcal • {item.protein}g P
                        </p>
                      </div>
                    </div>
                    <Plus size={16} className="text-accent opacity-40 group-hover:opacity-100 group-hover:scale-125 transition-all" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-20 bg-white/5 border border-dashed border-white/10 rounded-2xl">
                <p className="text-[9px] text-white/20 font-black uppercase tracking-[0.4em] italic px-4">
                  SÉQUENCE NON TROUVÉE DANS LES ARCHIVES
                </p>
              </div>
            )}
          </div>
        ) : (
          /* JOURNAL QUOTIDIEN (PHASE 6 & 7) */
          <div className="space-y-10 pb-24">
            {categories.map((category) => {
              const CategoryIcon = category.icon;
              const sectionMeals = Array.isArray(meals) 
                ? meals.filter((m: any) => m.type === category.id)
                : [];

              return (
                <div key={category.id} className="space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b border-white/5">
                    <CategoryIcon size={12} className="text-white/40" />
                    <h2 className="text-[9px] font-black uppercase tracking-[0.4em] text-white/40">
                      {category.label}
                    </h2>
                  </div>

                  <div className="space-y-1">
                    {sectionMeals.length > 0 ? (
                      sectionMeals.map((meal: any) => (
                        <div 
                          key={meal.id} 
                          className="flex justify-between items-center py-3 border-b border-white/5 group transition-all duration-300 hover:bg-white/[0.02]"
                        >
                          <div className="flex items-center gap-3">
                            {meal.isLiquid ? (
                              <Droplets size={12} className="text-accent" />
                            ) : (
                              <Circle size={8} className="text-primary" />
                            )}
                            <span className="text-[10px] font-black uppercase tracking-widest text-white/90">
                              {meal.name}
                            </span>
                          </div>
                          <div className="flex items-center gap-4">
                            <span className="text-[10px] font-black text-accent neon-text-blue tracking-tighter">
                              {meal.calories} KCAL
                            </span>
                            <button 
                              onClick={() => reconstructBioData(meal.name, meal.id)}
                              className="p-1.5 bg-white/5 rounded-md hover:bg-accent/10 transition-colors"
                              title="Reconstruire les données"
                            >
                              {isAnalyzing ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} className="text-primary" />}
                            </button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-[8px] text-white/10 font-black uppercase tracking-widest italic py-3">
                        Veuillez scanner ou rechercher un aliment
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <BottomNav />
    </main>
  );
}
