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

  // États pour la recherche et les scanners (Phase 2)
  const [searchTerm, setSearchTerm] = useState('');

  // Protection d'authentification
  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [user, loading, router]);

  if (loading || !user) return null;

  return (
    <main className="max-w-md mx-auto min-h-screen bg-black text-white relative shadow-[0_0_50px_rgba(0,0,0,0.8)] pb-32">
      {/* SECTION HEADER NÉON */}
      <div className="p-6 flex justify-between items-start">
        <h1 
          className="font-black text-2xl uppercase tracking-[0.2em] text-white"
          style={{ textShadow: '0 0 15px #00FFFF, 0 0 5px #00FFFF' }}
        >
          Journal
        </h1>
        
        {/* EMPLACEMENT FUTUR : BOUTONS ACTIONS (Phase 2) */}
        <div className="flex gap-2">
          {/* Les boutons Camera et Barcode seront insérés ici */}
        </div>
      </div>

      {/* SECTION RECHERCHE (Phase 2) */}
      <div className="px-6 mb-8">
        {/* L'input de recherche sera inséré ici */}
      </div>

      {/* LISTE DES REPAS / RÉSULTATS (Phase 3) */}
      <div className="px-6 space-y-6">
        {/* Le flux quotidien ou les résultats de recherche seront affichés ici */}
      </div>

      {/* MODALES DE SCAN ET DÉTAILS (Phase 4) */}
      {/* Les dialogues DialogContent pour le scan et les détails seront insérés ici */}

      <BottomNav />
    </main>
  );
}
