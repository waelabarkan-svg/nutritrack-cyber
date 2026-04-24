"use client"

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useFirestore, useCollection } from '@/firebase';
import { BottomNav } from '@/components/bottom-nav';
import { 
  Plus, Search, Camera, Barcode, X, Info, Zap, Flame, Droplets,
  AlertTriangle, CheckCircle2, Beer, Soup, Loader2
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { collection, query, where } from 'firebase/firestore';
import { cn } from '@/lib/utils';
import foodDb from '@/lib/food-db.json';

export default function JournalPage() {
  const { user, loading } = useUser();
  const db = useFirestore();
  const router = useRouter();

  // États de l'interface
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isBarcodeOpen, setIsBarcodeOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Requête Firebase pour l'historique utilisateur (fusion recherche)
  const mealsQuery = useMemo(() => {
    if (!user) return null;
    return collection(db, 'users', user.uid, 'meals');
  }, [db, user]);

  const { data: meals } = useCollection(mealsQuery);

  // MOTEUR DE RECHERCHE GLOBAL
  const globalSearchResults = useMemo(() => {
    if (!searchTerm || searchTerm.trim().length < 2) return [];

    try {
      // Transformation des données Firebase avec protection .docs (meals est déjà un tableau via useCollection)
      const firebaseData = Array.isArray(meals) ? meals : [];
      
      // Fusion des sources : JSON statique + Historique Firebase
      const allItems = [...(foodDb as any[]), ...firebaseData];
      
      // Filtrage insensible à la casse
      const queryLower = searchTerm.toLowerCase();
      
      // Utilisation d'un Set pour éviter les doublons par nom
      const seenNames = new Set();
      
      return allItems.filter((item: any) => {
        const name = (item.name || item.product_name || "ALIMENT INCONNU").toString();
        const matches = name.toLowerCase().includes(queryLower);
        
        if (matches && !seenNames.has(name.toUpperCase())) {
          seenNames.add(name.toUpperCase());
          return true;
        }
        return false;
      }).slice(0, 15); // Limite pour performance
    } catch (e) {
      console.error("Erreur critique du moteur de recherche:", e);
      return [];
    }
  }, [searchTerm, meals]);

  // Protection d'authentification
  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [user, loading, router]);

  if (loading || !user) return null;

  return (
    <main className="max-w-md mx-auto min-h-screen bg-black text-white relative shadow-[0_0_50px_rgba(0,0,0,0.8)] pb-32">
      {/* SECTION HEADER NÉON */}
      <div className="p-6 flex justify-between items-center">
        <h1 
          className="font-black text-2xl uppercase tracking-[0.2em] text-white"
          style={{ textShadow: '0 0 15px #00FFFF, 0 0 5px #00FFFF' }}
        >
          Journal
        </h1>
        
        {/* BOUTONS ACTIONS CYBER-NÉON */}
        <div className="flex gap-3">
          <button 
            onClick={() => setIsCameraOpen(true)}
            className="w-11 h-11 bg-white/5 border border-accent/30 rounded-lg flex items-center justify-center transition-all hover:bg-accent/10 hover:border-accent hover:shadow-[0_0_15px_rgba(0,242,255,0.4)] active:scale-95 group"
            title="Scan Optique"
          >
            <Camera size={20} className="text-accent group-hover:scale-110 transition-transform" />
          </button>
          <button 
            onClick={() => setIsBarcodeOpen(true)}
            className="w-11 h-11 bg-white/5 border border-accent/30 rounded-lg flex items-center justify-center transition-all hover:bg-accent/10 hover:border-accent hover:shadow-[0_0_15px_rgba(0,242,255,0.4)] active:scale-95 group"
            title="Scan Industriel"
          >
            <Barcode size={20} className="text-accent group-hover:scale-110 transition-transform" />
          </button>
        </div>
      </div>

      {/* SECTION RECHERCHE CYBER-NÉON */}
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
              className="absolute inset-y-0 right-4 flex items-center text-white/20 hover:text-white transition-colors"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* RÉSULTATS DE RECHERCHE OU JOURNAL */}
      <div className="px-6 space-y-6">
        {searchTerm ? (
          <div className="space-y-4">
            <h2 className="text-[9px] font-black uppercase tracking-[0.4em] text-accent neon-text-blue">
              Résultats de Recherche
            </h2>
            {globalSearchResults.length > 0 ? (
              <div className="grid gap-3">
                {globalSearchResults.map((item: any, idx: number) => (
                  <div 
                    key={idx}
                    className="cyber-card-blue p-4 flex justify-between items-center group cursor-pointer hover:bg-accent/5"
                  >
                    <div>
                      <p className="text-xs font-black uppercase tracking-widest">{item.name || item.product_name}</p>
                      <p className="text-[8px] text-muted-foreground uppercase font-black mt-1">
                        {item.calories} kcal • {item.protein}g P • {item.carbs}g G
                      </p>
                    </div>
                    <Plus size={16} className="text-accent opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[9px] text-white/20 font-black uppercase tracking-widest italic text-center py-10">
                Aucune archive correspondante dans la base.
              </p>
            )}
          </div>
        ) : (
          <div className="text-center py-20">
            <p className="text-[9px] text-white/20 font-black uppercase tracking-widest italic">
              Veuillez scanner ou rechercher un aliment
            </p>
          </div>
        )}
      </div>

      {/* LES MODALES DE SCAN SERONT INJECTÉES À LA PROCHAINE ÉTAPE */}

      <BottomNav />
    </main>
  );
}
