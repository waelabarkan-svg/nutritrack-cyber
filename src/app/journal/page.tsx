"use client"

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useFirestore, useCollection } from '@/firebase';
import { BottomNav } from '@/components/bottom-nav';
import { 
  Plus, Search, Camera, Barcode, X, Info, Zap, Flame, Droplets,
  AlertTriangle, CheckCircle2, Beer, Soup, Pizza, Loader2,
  Circle, Sparkles, Coffee, Sun, Moon, Cookie
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { collection, query, where } from 'firebase/firestore';
import { cn } from '@/lib/utils';
import foodDb from '@/lib/food-db.json';

export default function JournalPage() {
  const { user, loading } = useUser();
  const db = useFirestore();
  const router = useRouter();

  // ÉTATS DE L'INTERFACE
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isBarcodeOpen, setIsBarcodeOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // REQUÊTE FIREBASE POUR LES ARCHIVES
  const mealsQuery = useMemo(() => {
    if (!user) return null;
    return collection(db, 'users', user.uid, 'meals');
  }, [db, user]);

  const { data: meals } = useCollection(mealsQuery);

  // MOTEUR DE RECHERCHE GLOBAL (LOGIQUE PHASE 4)
  const globalSearchResults = useMemo(() => {
    if (!searchTerm || searchTerm.trim().length < 2) return [];

    try {
      // Transformation sécurisée des données Firebase
      const firebaseData = (meals as any)?.docs 
        ? (meals as any).docs.map((d: any) => ({ id: d.id, ...d.data() }))
        : (Array.isArray(meals) ? meals : []);
      
      // Fusion des sources : JSON statique + Historique Firebase
      const allItems = [...(foodDb as any[]), ...firebaseData];
      
      // Filtrage insensible à la casse
      const queryLower = searchTerm.toLowerCase();
      
      // Unicité des résultats
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

  // PROTECTION D'ACCÈS
  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [user, loading, router]);

  if (loading || !user) return null;

  // SECTIONS DU JOURNAL
  const categories = [
    { id: 'petit-déjeuner', label: 'Petit-Déjeuner', icon: Coffee },
    { id: 'déjeuner', label: 'Déjeuner', icon: Sun },
    { id: 'dîner', label: 'Dîner', icon: Moon },
    { id: 'snack', label: 'Snack', icon: Cookie },
  ];

  return (
    <main className="max-w-md mx-auto min-h-screen bg-black text-white relative shadow-[0_0_50px_rgba(0,0,0,0.8)] pb-32">
      
      {/* SECTION 1 : HEADER NÉON */}
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
            className="w-11 h-11 bg-white/5 border border-accent/30 rounded-lg flex items-center justify-center transition-all hover:bg-accent/10 hover:border-accent hover:shadow-[0_0_15px_rgba(0,242,255,0.4)] active:scale-95 group"
          >
            <Camera size={20} className="text-accent group-hover:scale-110 transition-transform" />
          </button>
          <button 
            onClick={() => setIsBarcodeOpen(true)}
            className="w-11 h-11 bg-white/5 border border-accent/30 rounded-lg flex items-center justify-center transition-all hover:bg-accent/10 hover:border-accent hover:shadow-[0_0_15px_rgba(0,242,255,0.4)] active:scale-95 group"
          >
            <Barcode size={20} className="text-accent group-hover:scale-110 transition-transform" />
          </button>
        </div>
      </div>

      {/* SECTION 2 : BARRE DE RECHERCHE */}
      <div className="px-6 mb-8">
        <div className="relative group">
          <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
            <Search size={14} className="text-white/20 group-focus-within:text-accent transition-colors" />
          </div>
          <Input 
            type="text"
            placeholder="RECHERCHER UN ALIMENT..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={cn(
              "w-full bg-black/40 border-white/10 pl-11 h-12 rounded-xl",
              "text-[10px] font-black uppercase tracking-[0.2em] placeholder:text-white/20",
              "focus:border-accent focus:ring-1 focus:ring-accent/30 transition-all duration-300",
              "shadow-[inset_0_0_10px_rgba(0,0,0,0.5)]"
            )}
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

      {/* SECTION 3 : AFFICHAGE DES RÉSULTATS OU JOURNAL QUOTIDIEN */}
      <div className="px-6 space-y-8">
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
                    className="bg-blue-500/5 border border-blue-500/20 p-4 rounded-xl flex items-center justify-between group cursor-pointer hover:bg-blue-500/10 transition-all duration-300"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-blue-500/10 border border-blue-500/30 rounded-lg flex items-center justify-center text-blue-400">
                        {item.isDish ? <Soup size={18} /> : (item.isLiquid ? <Beer size={18} /> : <Pizza size={18} />)}
                      </div>
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-white">
                          {item.name || item.product_name}
                        </p>
                        <p className="text-[8px] text-white/40 uppercase font-black mt-1">
                          {item.calories} kcal • {item.protein}g P • {item.carbs}g G
                        </p>
                      </div>
                    </div>
                    <Plus 
                      size={16} 
                      className="text-accent opacity-40 group-hover:opacity-100 group-hover:scale-125 transition-all" 
                    />
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
          /* JOURNAL QUOTIDIEN PAR SECTIONS */
          <div className="space-y-10">
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

                  <div className="space-y-2">
                    {sectionMeals.length > 0 ? (
                      sectionMeals.map((meal: any) => (
                        <div key={meal.id} className="flex justify-between items-center py-2 group">
                          <div className="flex items-center gap-3">
                            {meal.isLiquid ? <Droplets size={12} className="text-accent" /> : <Circle size={10} className="text-primary" />}
                            <span className="text-[10px] font-black uppercase tracking-widest text-white/90 group-hover:text-white transition-colors">
                              {meal.name}
                            </span>
                          </div>
                          <span className="text-[10px] font-black text-accent neon-text-blue">
                            {meal.calories} KCAL
                          </span>
                        </div>
                      ))
                    ) : (
                      <p className="text-[8px] text-white/10 font-black uppercase tracking-widest italic py-2">
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
