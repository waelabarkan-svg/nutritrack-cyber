"use client"

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useFirestore, useCollection } from '@/firebase';
import { BottomNav } from '@/components/bottom-nav';
import { 
  Plus, Search, Camera, Barcode, X, Info, Zap, Flame, Droplets,
  AlertTriangle, CheckCircle2, Beer, Soup, Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default function JournalPage() {
  const { user, loading } = useUser();
  const db = useFirestore();
  const router = useRouter();

  // États pour les dialogues de scan
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isBarcodeOpen, setIsBarcodeOpen] = useState(false);
  
  // États pour la recherche (Phase suivante)
  const [searchTerm, setSearchTerm] = useState('');

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

      {/* SECTION RECHERCHE (Phase 3) */}
      <div className="px-6 mb-8">
        {/* L'input de recherche sera inséré ici */}
      </div>

      {/* LISTE DES REPAS / RÉSULTATS (Phase 4) */}
      <div className="px-6 space-y-6">
        {/* Le flux quotidien ou les résultats de recherche seront affichés ici */}
      </div>

      {/* MODALES DE SCAN ET DÉTAILS (Phase 5) */}
      {/* Les dialogues DialogContent pour le scan et les détails seront insérés ici */}

      <BottomNav />
    </main>
  );
}
