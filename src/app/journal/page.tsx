"use client"

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useFirestore, useCollection } from '@/firebase';
import { BottomNav } from '@/components/bottom-nav';
import { 
  Plus, Search, Camera, Barcode, X, Droplets,
  Circle, Coffee, Sun, Moon, Cookie, Soup, Pizza, Beer,
  Zap, Loader2, RefreshCw
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

  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isBarcodeOpen, setIsBarcodeOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerRef = useRef<any>(null);

  const today = new Date().toISOString().split('T')[0];
  const mealsQuery = useMemo(() => {
    if (!user) return null;
    return query(collection(db, 'users', user.uid, 'meals'), where('date', '==', today));
  }, [db, user, today]);

  const { data: meals } = useCollection(mealsQuery);

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
        const name = (item.name || item.product_name || "ALIMENT INCONNU").toString();
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
        name: item.name || item.product_name || "ALIMENT INCONNU",
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
      toast({ title: "SYNCHRONISATION RÉUSSIE", description: "Données bio-enregistrées." });
      setSearchTerm('');
    } catch (e) {
      toast({ variant: "destructive", title: "ERREUR DE LIAISON", description: "Échec de l'enregistrement." });
    }
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      toast({ variant: "destructive", title: "ERREUR CAPTEUR", description: "Impossible d'accéder à la caméra." });
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
    }
  };

  const capturePhoto = async () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(videoRef.current, 0, 0);
    const dataUri = canvas.toDataURL('image/jpeg');
    setCapturedImage(dataUri);
    stopCamera();
    
    setIsAnalyzing(true);
    try {
      const result = await scanDish({ photoDataUri: dataUri }) as any;
      await addMeal(result);
      setIsCameraOpen(false);
    } catch (err) {
      toast({ variant: "destructive", title: "ANALYSE ÉCHOUÉE", description: "Le processeur visuel a rencontré une erreur." });
    } finally {
      setIsAnalyzing(false);
      setCapturedImage(null);
    }
  };

  const handleBarcodeSuccess = async (decodedText: string) => {
    if (scannerRef.current) {
      scannerRef.current.clear();
    }
    setIsBarcodeOpen(false);
    setIsAnalyzing(true);
    try {
      const response = await fetch(`https://world.openfoodfacts.org/api/v2/product/${decodedText}.json`);
      const data = await response.json();
      if (data.status === 1) {
        const p = data.product;
        const item = {
          name: p.product_name,
          calories: p.nutriments?.['energy-kcal_100g'] || 0,
          protein: p.nutriments?.proteins_100g || 0,
          carbs: p.nutriments?.carbohydrates_100g || 0,
          fat: p.nutriments?.fat_100g || 0,
          sugar: p.nutriments?.sugars_100g || 0
        };
        await addMeal(item);
      } else {
        toast({ title: "CODE INCONNU", description: "Produit non répertorié." });
      }
    } catch (err) {
      toast({ variant: "destructive", title: "ERREUR RÉSEAU", description: "Connexion aux serveurs OFF impossible." });
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
        fiber: result.fiber || 0,
        vitamins: result.vitamins || "Non détecté",
        minerals: result.minerals || "Non détecté"
      });
      toast({ title: "RÉGÉNÉRATION TERMINÉE", description: "Profil moléculaire mis à jour." });
    } catch (e) {
      toast({ variant: "destructive", title: "ERREUR IA", description: "Liaison neuronale instable." });
    } finally {
      setIsAnalyzing(false);
    }
  };

  useEffect(() => {
    if (isBarcodeOpen) {
      setTimeout(() => {
        const scanner = new Html5QrcodeScanner("reader", { fps: 10, qrbox: { width: 250, height: 250 } }, false);
        scanner.render(handleBarcodeSuccess, (err) => {});
        scannerRef.current = scanner;
      }, 300);
    } else {
      if (scannerRef.current) {
        scannerRef.current.clear();
      }
    }
  }, [isBarcodeOpen]);

  useEffect(() => {
    if (isCameraOpen) startCamera();
    else stopCamera();
  }, [isCameraOpen]);

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
        </div>
      </div>

      <div className="px-6">
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
                    onClick={() => addMeal(item)}
                    className="bg-blue-500/5 border border-blue-500/20 p-4 rounded-xl flex items-center justify-between group cursor-pointer hover:bg-blue-500/10"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-blue-500/10 border border-blue-500/30 rounded-lg flex items-center justify-center text-blue-400">
                        {item.isDish ? <Soup size={18} /> : (item.isLiquid ? <Beer size={18} /> : <Pizza size={18} />)}
                      </div>
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-white">{item.name || item.product_name || "ALIMENT INCONNU"}</p>
                        <p className="text-[8px] text-white/40 uppercase font-black mt-1">{item.calories} kcal</p>
                      </div>
                    </div>
                    <Plus size={16} className="text-accent" />
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[9px] text-white/20 font-black uppercase italic text-center py-10">SÉQUENCE NON TROUVÉE DANS LES ARCHIVES</p>
            )}
          </div>
        ) : (
          <div className="space-y-10 pb-24">
            {categories.map((category) => {
              const CategoryIcon = category.icon;
              const sectionMeals = Array.isArray(meals) ? meals.filter((m: any) => m.type === category.id) : [];

              return (
                <div key={category.id} className="space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b border-white/5">
                    <CategoryIcon size={12} className="text-white/40" />
                    <h2 className="text-[9px] font-black uppercase tracking-[0.4em] text-white/40">{category.label}</h2>
                  </div>
                  <div className="space-y-1">
                    {sectionMeals.length > 0 ? sectionMeals.map((meal: any) => (
                      <div key={meal.id} className="flex justify-between items-center py-3 border-b border-white/5 hover:bg-white/[0.02]">
                        <div className="flex items-center gap-3">
                          {meal.isLiquid ? <Droplets size={12} className="text-accent" /> : <Circle size={8} className="text-primary" />}
                          <span className="text-[10px] font-black uppercase tracking-widest text-white/90">{meal.name}</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-[10px] font-black text-accent neon-text-blue">{meal.calories} KCAL</span>
                          <button onClick={() => reconstructBioData(meal.name, meal.id)} className="p-1.5 bg-white/5 rounded-md">
                            {isAnalyzing ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} className="text-primary" />}
                          </button>
                        </div>
                      </div>
                    )) : (
                      <p className="text-[8px] text-white/10 font-black uppercase italic py-3">Veuillez scanner ou rechercher un aliment</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={isCameraOpen} onOpenChange={setIsCameraOpen}>
        <DialogContent className="bg-black border-accent/50 max-w-sm rounded-[24px]">
          <DialogHeader><DialogTitle className="text-accent text-center uppercase tracking-widest font-black text-xs">Analyse Optique</DialogTitle></DialogHeader>
          <div className="relative aspect-video bg-black/40 rounded-xl overflow-hidden border border-white/10">
            <video ref={videoRef} className="w-full h-full object-cover" autoPlay playsInline muted />
            {isAnalyzing && (
              <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-3">
                <Loader2 className="text-accent animate-spin" size={32} />
                <span className="text-[10px] text-accent font-black uppercase tracking-widest animate-pulse">Séquençage...</span>
              </div>
            )}
          </div>
          <button 
            onClick={capturePhoto}
            disabled={isAnalyzing}
            className="w-16 h-16 bg-accent/20 border-4 border-accent rounded-full mx-auto flex items-center justify-center hover:scale-110 active:scale-95 transition-all"
          >
            <div className="w-10 h-10 bg-accent rounded-full shadow-[0_0_20px_rgba(0,242,255,0.8)]" />
          </button>
        </DialogContent>
      </Dialog>

      <Dialog open={isBarcodeOpen} onOpenChange={setIsBarcodeOpen}>
        <DialogContent className="bg-black border-accent/50 max-w-sm rounded-[24px]">
          <DialogHeader><DialogTitle className="text-accent text-center uppercase tracking-widest font-black text-xs">Scan Industriel</DialogTitle></DialogHeader>
          <div id="reader" className="w-full overflow-hidden rounded-xl border border-white/10 min-h-[250px]" />
          <p className="text-[8px] text-white/40 text-center uppercase tracking-widest">Pointez le capteur vers le code-barres</p>
        </DialogContent>
      </Dialog>

      <BottomNav />
    </main>
  );
}
