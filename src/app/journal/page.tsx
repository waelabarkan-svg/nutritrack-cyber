
"use client"

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useFirestore, useCollection } from '@/firebase';
import { BottomNav } from '@/components/bottom-nav';
import { 
  Plus, Search, Camera, Barcode, Droplets,
  Soup, Pizza, Beer, Zap, Loader2, RefreshCw
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { collection, query, where, addDoc, doc, updateDoc } from 'firebase/firestore';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import foodDb from '@/lib/food-db.json';
import { estimateDish } from '@/ai/flows/estimate-dish-flow';
import { scanDish } from '@/ai/flows/scan-dish-flow';
import { Html5QrcodeScanner } from 'html5-qrcode';

export default function JournalPage() {
  const { user, loading } = useUser();
  const db = useFirestore();
  const router = useRouter();

  // États de l'interface
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isBarcodeOpen, setIsBarcodeOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  
  // Références techniques
  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerRef = useRef<any>(null);

  const today = new Date().toISOString().split('T')[0];

  // Récupération des repas Firestore
  const mealsQuery = useMemo(() => {
    if (!user) return null;
    return query(collection(db, 'users', user.uid, 'meals'), where('date', '==', today));
  }, [db, user, today]);

  const { data: meals } = useCollection(mealsQuery);

  // Moteur de Recherche Global (Fusion JSON + Local + Firebase)
  const globalSearchResults = useMemo(() => {
    if (!searchTerm || searchTerm.trim().length < 2) return [];
    try {
      const firebaseData = (meals as any)?.docs 
        ? (meals as any).docs.map((d: any) => ({ id: d.id, ...d.data() }))
        : (Array.isArray(meals) ? meals : []);
      
      const localHistory = JSON.parse(localStorage.getItem('biometric_memory') || '[]');
      const allItems = [...(foodDb as any[]), ...localHistory, ...firebaseData];
      const queryLower = searchTerm.toLowerCase();
      const seenNames = new Set();
      
      return allItems.filter((item: any) => {
        const name = (item.name || item.product_name || "").toString();
        const matches = name.toLowerCase().includes(queryLower);
        if (matches && !seenNames.has(name.toUpperCase())) {
          seenNames.add(name.toUpperCase());
          return true;
        }
        return false;
      }).slice(0, 15);
    } catch (e) {
      return [];
    }
  }, [searchTerm, meals]);

  const addMeal = async (item: any, type: string = 'snack') => {
    if (!user) return;
    try {
      const mealData = {
        name: (item.name || item.product_name || "ALIMENT INCONNU").toUpperCase(),
        calories: Number(item.calories) || 0,
        protein: Number(item.protein) || 0,
        carbs: Number(item.carbs) || 0,
        fat: Number(item.fat) || 0,
        sugar: Number(item.sugar) || 0,
        fiber: Number(item.fiber) || 0,
        date: today,
        type: type,
        isLiquid: !!item.isLiquid,
        createdAt: new Date().toISOString()
      };

      await addDoc(collection(db, 'users', user.uid, 'meals'), mealData);
      const localHistory = JSON.parse(localStorage.getItem('biometric_memory') || '[]');
      localStorage.setItem('biometric_memory', JSON.stringify([mealData, ...localHistory].slice(0, 50)));
      
      toast({ title: "SYNC OK", description: "DATA_LOGGED" });
      setSearchTerm('');
    } catch (e) {
      toast({ variant: "destructive", title: "ERROR", description: "LINK_FAILED" });
    }
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch (err) {
      toast({ variant: "destructive", title: "SENSOR_ERROR", description: "ACCESS_DENIED" });
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach(track => track.stop());
    }
  };

  const capturePhoto = async () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    canvas.getContext('2d')?.drawImage(videoRef.current, 0, 0);
    const dataUri = canvas.toDataURL('image/jpeg');
    setCapturedImage(dataUri);
    
    setIsAnalyzing(true);
    try {
      const result = await scanDish({ photoDataUri: dataUri }) as any;
      await addMeal(result);
      setIsCameraOpen(false);
    } catch (err) {
      toast({ variant: "destructive", title: "ANALYSIS_FAILED", description: "STABILITY_LOW" });
    } finally {
      setIsAnalyzing(false);
      setCapturedImage(null);
      stopCamera();
    }
  };

  const handleBarcodeSuccess = async (decodedText: string) => {
    if (scannerRef.current) scannerRef.current.clear();
    setIsBarcodeOpen(false);
    setIsAnalyzing(true);
    try {
      const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${decodedText}.json`);
      const data = await res.json();
      if (data.status === 1) {
        const p = data.product;
        await addMeal({
          name: p.product_name,
          calories: p.nutriments?.['energy-kcal_100g'] || 0,
          protein: p.nutriments?.proteins_100g || 0,
          carbs: p.nutriments?.carbohydrates_100g || 0,
          fat: p.nutriments?.fat_100g || 0
        });
      } else {
        toast({ title: "UNKNOWN_ID", description: "NOT_IN_ARCHIVES" });
      }
    } catch (err) {
      toast({ variant: "destructive", title: "NETWORK_ERROR", description: "OFFLINE" });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const reconstructBioData = async (dishName: string, mealId: string) => {
    if (!user) return;
    setIsAnalyzing(true);
    try {
      const result = await estimateDish({ dishName }) as any;
      const mealRef = doc(db, 'users', user.uid, 'meals', mealId);
      await updateDoc(mealRef, {
        calories: result.calories || 0,
        protein: result.protein || 0,
        carbs: result.carbs || 0,
        fat: result.fat || 0,
        sugar: result.sugar || 0,
        fiber: result.fiber || 0
      });
      toast({ title: "SYNTHESIS_COMPLETE", description: "MOLECULAR_SYNC" });
    } catch (e) {
      toast({ variant: "destructive", title: "NEURAL_ERROR", description: "STABILITY_LOST" });
    } finally {
      setIsAnalyzing(false);
    }
  };

  useEffect(() => {
    if (isBarcodeOpen) {
      const timer = setTimeout(() => {
        const scanner = new Html5QrcodeScanner("reader", { fps: 10, qrbox: { width: 250, height: 250 } }, false);
        scanner.render(handleBarcodeSuccess, () => {});
        scannerRef.current = scanner;
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isBarcodeOpen]);

  useEffect(() => {
    if (isCameraOpen) startCamera();
    else stopCamera();
    return () => stopCamera();
  }, [isCameraOpen]);

  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [user, loading, router]);

  if (loading || !user) return null;

  const categories = [
    { id: 'petit-déjeuner', label: 'PETIT-DÉJEUNER' },
    { id: 'déjeuner', label: 'DÉJEUNER' },
    { id: 'dîner', label: 'DÎNER' },
    { id: 'snack', label: 'SNACK' },
  ];

  return (
    <main className="max-w-md mx-auto min-h-screen bg-black text-white relative shadow-[0_0_50px_rgba(0,0,0,1)] pb-32">
      
      {/* HEADER : TERMINAL LOOK */}
      <header className="p-6 flex justify-between items-center bg-black">
        <h1 
          className="font-black text-2xl uppercase tracking-[0.2em] text-white"
          style={{ textShadow: '0 0 10px #00FFFF, 0 0 20px #00FFFF' }}
        >
          Journal
        </h1>
        
        <div className="flex gap-4">
          <button 
            onClick={() => setIsCameraOpen(true)}
            className="text-accent/70 hover:text-accent transition-all duration-300 active:scale-95"
          >
            <Camera size={22} />
          </button>
          <button 
            onClick={() => setIsBarcodeOpen(true)}
            className="text-accent/70 hover:text-accent transition-all duration-300 active:scale-95"
          >
            <Barcode size={22} />
          </button>
        </div>
      </header>

      {/* RECHERCHE : FENTE SOMBRE */}
      <div className="px-6 mb-8">
        <div className="relative border border-white/10 group bg-black/40 rounded-none">
          <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
            <Search size={14} className="text-white/20 group-focus-within:text-accent" />
          </div>
          <Input 
            type="text"
            placeholder="RECHERCHER UN ALIMENT..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-transparent border-none pl-10 h-10 rounded-none text-[10px] font-bold uppercase tracking-[0.2em] focus:ring-0 placeholder:text-white/20"
          />
        </div>
      </div>

      {/* CONTENU PRINCIPAL */}
      <div className="px-6 space-y-10">
        {searchTerm ? (
          <div className="space-y-4 animate-in fade-in duration-300">
            <h2 className="text-[10px] font-light uppercase tracking-[0.4em] text-white/30 border-b border-white/10 pb-1">
              Archives_Trouvées
            </h2>
            <div className="space-y-1">
              {globalSearchResults.map((item: any, idx: number) => (
                <div 
                  key={idx}
                  onClick={() => addMeal(item)}
                  className="flex justify-between items-center py-3 border-b border-white/5 hover:bg-white/[0.03] transition-all cursor-pointer group px-1"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-[11px] font-bold uppercase tracking-widest text-white/90">
                      {(item.name || item.product_name).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-[11px] font-black text-[#00FFFF]">{item.calories} KCAL</span>
                    <Plus size={14} className="text-accent opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-12">
            {categories.map((category) => {
              const sectionMeals = Array.isArray(meals) ? meals.filter((m: any) => m.type === category.id) : [];

              return (
                <div key={category.id} className="space-y-4">
                  <h2 className="text-[10px] font-light uppercase tracking-[0.4em] text-white/30 border-b border-white/10 pb-1 mb-4">
                    {category.label}
                  </h2>
                  <div className="space-y-0.5">
                    {sectionMeals.length > 0 ? sectionMeals.map((meal: any) => (
                      <div key={meal.id} className="flex justify-between items-center py-3 border-b border-white/5 hover:bg-white/[0.02] transition-colors group">
                        <div className="flex items-center gap-3">
                          {meal.isLiquid ? <Droplets size={12} className="text-accent/60" /> : <div className="w-1 h-1 bg-white/10 rounded-full" />}
                          <span className="text-[11px] font-bold uppercase tracking-widest text-white/90">{meal.name}</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-[11px] font-black text-[#00FFFF]">{meal.calories} KCAL</span>
                          <button 
                            onClick={(e) => { e.stopPropagation(); reconstructBioData(meal.name, meal.id); }}
                            className="p-1"
                          >
                            {isAnalyzing ? <Loader2 size={12} className="animate-spin text-accent" /> : <RefreshCw size={12} className="text-white/10 hover:text-white" />}
                          </button>
                        </div>
                      </div>
                    )) : (
                      <p className="text-[8px] text-white/10 font-black uppercase italic py-4 tracking-[0.1em]">Veuillez scanner ou rechercher un aliment</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* DIALOGUES : DARK & ACCENT */}
      <Dialog open={isCameraOpen} onOpenChange={setIsCameraOpen}>
        <DialogContent className="bg-black border-accent/40 rounded-none max-w-sm p-4">
          <DialogHeader><DialogTitle className="text-accent text-center uppercase tracking-[0.4em] font-black text-[10px]">Analyse Optique</DialogTitle></DialogHeader>
          <div className="relative aspect-square bg-black border border-white/10 overflow-hidden">
            <video ref={videoRef} className="w-full h-full object-cover" autoPlay playsInline muted />
            {isAnalyzing && (
              <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center gap-4">
                <div className="w-12 h-1 bg-accent animate-pulse shadow-[0_0_15px_#00FFFF]" />
                <span className="text-[9px] text-accent font-black uppercase tracking-[0.5em] animate-pulse">Séquençage...</span>
              </div>
            )}
          </div>
          <button 
            onClick={capturePhoto}
            disabled={isAnalyzing}
            className="w-14 h-14 border border-accent rounded-none mx-auto flex items-center justify-center hover:bg-accent/10 active:scale-95 transition-all mt-4"
          >
            <div className="w-8 h-8 bg-accent shadow-[0_0_20px_#00FFFF]" />
          </button>
        </DialogContent>
      </Dialog>

      <Dialog open={isBarcodeOpen} onOpenChange={setIsBarcodeOpen}>
        <DialogContent className="bg-black border-accent/40 rounded-none max-w-sm p-4">
          <DialogHeader><DialogTitle className="text-accent text-center uppercase tracking-[0.4em] font-black text-[10px]">Scan Industriel</DialogTitle></DialogHeader>
          <div id="reader" className="w-full overflow-hidden border border-white/10 min-h-[250px]" />
        </DialogContent>
      </Dialog>

      <BottomNav />
    </main>
  );
}
