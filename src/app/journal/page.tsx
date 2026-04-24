"use client"

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useFirestore, useCollection } from '@/firebase';
import { BottomNav } from '@/components/bottom-nav';
import { 
  Plus, Search, Beer, Soup, Sparkles, Loader2, 
  Camera, Barcode, X, Info, Zap, Flame, Droplets,
  AlertTriangle, CheckCircle2
} from 'lucide-react';
import { collection, addDoc, query, where, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { toast } from '@/hooks/use-toast';
import { scanDish } from '@/ai/flows/scan-dish-flow';
import { estimateDish } from '@/ai/flows/estimate-dish-flow';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { Html5QrcodeScanner } from "html5-qrcode";

// Import de la base de données statique
import foodDb from '@/lib/food-db.json';

type MealType = 'petit-déjeuner' | 'déjeuner' | 'dîner' | 'snack';

export default function JournalPage() {
  const { user } = useUser();
  const db = useFirestore();
  const router = useRouter();

  // States
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<MealType>('petit-déjeuner');
  const [selectedMeal, setSelectedMeal] = useState<any>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanMode, setScanMode] = useState<'photo' | 'barcode' | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [hasCameraPermission, setHasCameraPermission] = useState(false);

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scannerRef = useRef<any>(null);

  const today = useMemo(() => new Date().toISOString().split('T')[0], []);

  // Firestore Data - Utilisation de (meals as any) pour éviter les erreurs de build sur .docs si nécessaire
  const mealsQuery = useMemo(() => {
    if (!user) return null;
    return query(collection(db, 'users', user.uid, 'meals'), where('date', '==', today));
  }, [user, today, db]);

  const { data: meals } = useCollection(mealsQuery);

  // Fusion Tripartite pour la Recherche Globale (foodDb + localStorage + firebase)
  const globalSearchResults = useMemo(() => {
    if (!searchTerm || searchTerm.length < 2) return [];
    try {
      const localData = localStorage.getItem('biometric_memory');
      const localHistory = localData ? JSON.parse(localData) : [];
      const firebaseData = (meals as any) || [];
      
      const allItems = [...(foodDb as any[]), ...localHistory, ...firebaseData];
      
      return allItems.filter((item: any) => {
        const name = item?.name || item?.product_name || "";
        return name.toString().toLowerCase().includes(searchTerm.toLowerCase());
      }).slice(0, 15); 
    } catch (e) {
      return [];
    }
  }, [searchTerm, meals]);

  // --- CAMERA LOGIC ---
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setHasCameraPermission(true);
      }
    } catch (err) {
      console.error("Camera error:", err);
      toast({ variant: "destructive", title: "ACCÈS REFUSÉ", description: "Veuillez autoriser la caméra." });
    }
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach(track => track.stop());
    }
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const context = canvasRef.current.getContext('2d');
      if (context) {
        canvasRef.current.width = videoRef.current.videoWidth;
        canvasRef.current.height = videoRef.current.videoHeight;
        context.drawImage(videoRef.current, 0, 0);
        const dataUrl = canvasRef.current.toDataURL('image/jpeg');
        setCapturedImage(dataUrl);
        runImageAnalysis(dataUrl);
      }
    }
  };

  const runImageAnalysis = async (dataUri: string) => {
    setIsAnalyzing(true);
    try {
      const result = await scanDish({ photoDataUri: dataUri });
      setSelectedMeal({ ...result, imageUrl: dataUri });
    } catch (err) {
      toast({ variant: "destructive", title: "ERREUR SCAN", description: "Analyse moléculaire interrompue." });
    } finally {
      setIsAnalyzing(false);
      stopCamera();
    }
  };

  // --- BARCODE LOGIC ---
  useEffect(() => {
    if (scanMode === 'barcode') {
      const timer = setTimeout(() => {
        const scanner = new Html5QrcodeScanner("reader", { fps: 10, qrbox: { width: 250, height: 150 } }, false);
        scanner.render(onBarcodeSuccess, (err) => {});
        scannerRef.current = scanner;
      }, 300);
      return () => {
        clearTimeout(timer);
        if (scannerRef.current) {
          scannerRef.current.clear().catch(console.error);
        }
      };
    }
  }, [scanMode]);

  const onBarcodeSuccess = async (decodedText: string) => {
    if (scannerRef.current) {
      await scannerRef.current.clear().catch(console.error);
    }
    setIsAnalyzing(true);
    try {
      const res = await fetch(`https://world.openfoodfacts.org/api/v0/product/${decodedText}.json`);
      const data = await res.json();
      if (data.status === 1) {
        const p = data.product;
        const result = {
          name: p.product_name || "Produit Inconnu",
          calories: Math.round(p.nutriments['energy-kcal_100g'] || 0),
          protein: p.nutriments.proteins_100g || 0,
          carbs: p.nutriments.carbohydrates_100g || 0,
          fat: p.nutriments.fat_100g || 0,
          sugar: p.nutriments.sugars_100g || 0,
          isLiquid: p.categories?.toLowerCase().includes('boisson') || false,
          imageUrl: p.image_url
        };
        setSelectedMeal(result);
      } else {
        toast({ title: "INTROUVABLE", description: "Produit non répertorié dans la base." });
      }
    } catch (err) {
      toast({ variant: "destructive", title: "ERREUR RÉSEAU" });
    } finally {
      setIsAnalyzing(false);
      setScanMode(null);
    }
  };

  // --- PERSISTENCE ---
  const handleAddMeal = async () => {
    if (!user || !selectedMeal) return;
    try {
      const mealData = {
        ...selectedMeal,
        name: selectedMeal.name || "Aliment Inconnu",
        date: today,
        type: selectedType,
        createdAt: new Date().toISOString()
      };

      // 1. Firestore
      await addDoc(collection(db, 'users', user.uid, 'meals'), mealData);

      // 2. Local Memory (Sync)
      const localData = localStorage.getItem('biometric_memory');
      const memory = localData ? JSON.parse(localData) : [];
      memory.push(mealData);
      localStorage.setItem('biometric_memory', JSON.stringify(memory));

      toast({ title: "ARCHIVÉ", description: "Données biométriques synchronisées." });
      setSelectedMeal(null);
      setSearchTerm('');
    } catch (err) {
      toast({ variant: "destructive", title: "ERREUR SAUVEGARDE" });
    }
  };

  const reconstructBioData = async () => {
    if (!selectedMeal?.name) return;
    setIsAnalyzing(true);
    try {
      // Cast any pour éviter les erreurs de build sur les types IA
      const result = await estimateDish({ dishName: selectedMeal.name }) as any;
      setSelectedMeal({ ...selectedMeal, ...result });
      toast({ title: "RÉUSSITE", description: "Micro-données reconstruites via Llama-4." });
    } catch (err) {
      toast({ variant: "destructive", title: "ÉCHEC RECONSTRUCTION" });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const renderBadges = (data: any) => {
    if (!data || data === "Non détecté" || data === "Non répertorié") return null;
    const items = Array.isArray(data) ? data : String(data).split(',');
    return items.map((item, i) => (
      <Badge key={i} variant="outline" className="bg-white/5 border-white/10 text-[8px] uppercase font-black py-0.5 px-2 mr-1 mb-1">
        {String(item).trim()}
      </Badge>
    ));
  };

  return (
    <main className="min-h-screen bg-black text-white pb-32">
      {/* HEADER & SEARCH ZONE */}
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-black tracking-tighter uppercase neon-text-blue">Journal</h1>
          <div className="flex gap-2">
            <Button size="icon" variant="outline" className="rounded-xl border-accent/40 bg-black/40" onClick={() => { setIsScanning(true); setScanMode('photo'); startCamera(); }}>
              <Camera size={18} />
            </Button>
            <Button size="icon" variant="outline" className="rounded-xl border-accent/40 bg-black/40" onClick={() => { setIsScanning(true); setScanMode('barcode'); }}>
              <Barcode size={18} />
            </Button>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" size={16} />
          <input 
            className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-10 pr-4 text-sm uppercase font-black tracking-widest focus:border-accent outline-none transition-all"
            placeholder="RECHERCHER UN ALIMENT..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* DISPLAY ZONE */}
        <div className="space-y-8">
          {searchTerm ? (
            <div className="space-y-4">
              <p className="text-[10px] font-black text-accent uppercase tracking-[0.3em]">Résultats de recherche</p>
              {globalSearchResults.length > 0 ? globalSearchResults.map((item: any, idx) => (
                <div 
                  key={idx}
                  onClick={() => setSelectedMeal(item)}
                  className="cyber-card-blue p-4 flex justify-between items-center cursor-pointer hover:border-accent transition-all"
                >
                  <div className="flex items-center gap-4">
                    <div className="text-accent">
                      {item.isLiquid ? <Beer size={20} /> : <Soup size={20} />}
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase">{item.name || item.product_name}</p>
                      <p className="text-[8px] opacity-50">{item.calories} KCAL</p>
                    </div>
                  </div>
                  <Plus size={16} className="text-accent" />
                </div>
              )) : (
                <div className="p-8 text-center border border-dashed border-white/10 rounded-2xl">
                  <p className="text-[9px] font-black uppercase text-white/20">AUCUNE ARCHIVE DANS LA BASE</p>
                </div>
              )}
            </div>
          ) : (
            ['petit-déjeuner', 'déjeuner', 'dîner', 'snack'].map((type) => {
              const sectionMeals = (meals as any)?.filter((m: any) => m.type === type) || [];
              return (
                <div key={type} className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-[10px] font-black uppercase text-white/40 tracking-widest">{type}</h3>
                    <div className="h-[1px] flex-1 bg-white/5 mx-4" />
                  </div>
                  {sectionMeals.length > 0 ? sectionMeals.map((meal: any) => (
                    <div 
                      key={meal.id} 
                      onClick={() => setSelectedMeal(meal)}
                      className="bg-white/5 border border-white/10 p-4 rounded-2xl flex justify-between items-center hover:bg-white/10 transition-all cursor-pointer"
                    >
                       <div className="flex items-center gap-3">
                         {meal.isLiquid ? <Droplets size={14} className="text-accent" /> : <Soup size={14} className="text-white/40" />}
                         <p className="text-[10px] font-black uppercase">{meal.name}</p>
                       </div>
                       <p className="text-[8px] text-accent font-black">{meal.calories} KCAL</p>
                    </div>
                  )) : (
                    <p className="text-[8px] opacity-20 italic">Veuillez scanner ou rechercher un aliment</p>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* SCAN DIALOG */}
      <Dialog open={isScanning} onOpenChange={(open) => { if(!open) { stopCamera(); setIsScanning(false); setScanMode(null); setCapturedImage(null); } }}>
        <DialogContent className="bg-black border-accent/30 text-white max-w-sm rounded-[24px]">
          <DialogHeader>
            <DialogTitle className="text-[10px] font-black text-accent uppercase tracking-widest text-center">
              {scanMode === 'photo' ? 'Analyse Optique' : 'Scan Industriel'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="relative aspect-video bg-white/5 rounded-xl overflow-hidden border border-white/10">
            {scanMode === 'photo' && (
              <>
                <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                <div className="absolute inset-0 border-2 border-accent/20 flex items-center justify-center pointer-events-none">
                   <div className="w-48 h-48 border-2 border-accent animate-pulse rounded-lg" />
                </div>
                <button 
                  onClick={capturePhoto}
                  className="absolute bottom-4 left-1/2 -translate-x-1/2 w-14 h-14 bg-accent rounded-full border-4 border-black shadow-lg"
                />
              </>
            )}
            {scanMode === 'barcode' && (
              <div id="reader" className="w-full h-full" />
            )}
          </div>

          <p className="text-[8px] text-center text-white/40 uppercase tracking-widest mt-4">
            ALIGNER L'ÉLÉMENT DANS LE CADRE DE LECTURE
          </p>
        </DialogContent>
      </Dialog>

      {/* DETAILS DIALOG */}
      <Dialog open={!!selectedMeal} onOpenChange={() => { if(!isAnalyzing) setSelectedMeal(null); }}>
        <DialogContent className="bg-black/95 border-accent/40 text-white max-w-md p-0 overflow-hidden rounded-[32px]">
          {isAnalyzing ? (
            <div className="p-20 flex flex-col items-center justify-center gap-6">
              <Loader2 className="animate-spin text-accent" size={48} />
              <p className="text-[10px] font-black text-accent uppercase tracking-[0.5em] animate-pulse">Reconstruction...</p>
            </div>
          ) : selectedMeal && (
            <div className="flex flex-col h-full max-h-[90vh]">
              {/* Image & Header */}
              <div className="relative h-64 bg-white/5">
                <img 
                  src={selectedMeal.imageUrl || `https://source.unsplash.com/featured/?food,${selectedMeal.name}`} 
                  className="w-full h-full object-cover" 
                  alt={selectedMeal.name}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
                <div className="absolute bottom-6 left-6 right-6">
                   <h2 className="text-2xl font-black uppercase tracking-tighter neon-text-blue">{selectedMeal.name}</h2>
                   <div className="flex gap-2 mt-2">
                     <Badge className="bg-accent/20 text-accent border-accent/40 text-[9px] uppercase font-black">
                       {selectedMeal.isLiquid ? 'Liquide' : 'Solide'}
                     </Badge>
                     {selectedMeal.sugar > 10 && (
                       <Badge className="bg-destructive/20 text-destructive border-destructive/40 text-[9px] uppercase font-black animate-pulse">
                         Alerte Glycémie
                       </Badge>
                     )}
                   </div>
                </div>
              </div>

              {/* Stats & Information */}
              <div className="p-6 space-y-8 overflow-y-auto">
                <div className="grid grid-cols-4 gap-4">
                  <div className="text-center">
                    <p className="text-xl font-black text-white">{selectedMeal.calories}</p>
                    <p className="text-[7px] text-white/40 uppercase font-black">KCAL</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xl font-black text-primary">{selectedMeal.protein}g</p>
                    <p className="text-[7px] text-white/40 uppercase font-black">PROT</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xl font-black text-accent">{selectedMeal.carbs}g</p>
                    <p className="text-[7px] text-white/40 uppercase font-black">GLUC</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xl font-black text-destructive">{selectedMeal.fat}g</p>
                    <p className="text-[7px] text-white/40 uppercase font-black">LIP</p>
                  </div>
                </div>

                {/* Micro-nutriments */}
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-[9px] font-black uppercase text-white/40 tracking-widest">Bio-Archives</h3>
                    {!selectedMeal.vitamins && (
                      <Button variant="ghost" size="sm" onClick={reconstructBioData} className="h-6 text-[8px] text-accent hover:bg-accent/10 px-2 rounded-lg border border-accent/20">
                         RECONSTRUIRE
                      </Button>
                    )}
                  </div>

                  {!selectedMeal.vitamins ? (
                    <div className="p-4 border border-orange-500/20 bg-orange-500/5 rounded-xl flex items-center gap-3">
                      <AlertTriangle size={16} className="text-orange-500" />
                      <p className="text-[8px] text-orange-500/80 font-black uppercase">Archive incomplète - Reconstruction IA conseillée</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div>
                        <p className="text-[8px] font-black text-white/30 uppercase mb-2">Vitamines</p>
                        <div className="flex flex-wrap">{renderBadges(selectedMeal.vitamins)}</div>
                      </div>
                      <div>
                        <p className="text-[8px] font-black text-white/30 uppercase mb-2">Minéraux</p>
                        <div className="flex flex-wrap">{renderBadges(selectedMeal.minerals)}</div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Persistence */}
                {!selectedMeal.date && (
                  <div className="space-y-4 pt-4 border-t border-white/5">
                    <div className="grid grid-cols-2 gap-2">
                      {['petit-déjeuner', 'déjeuner', 'dîner', 'snack'].map((t) => (
                        <Button 
                          key={t}
                          variant="outline"
                          size="sm"
                          className={cn(
                            "text-[8px] font-black uppercase tracking-widest h-10",
                            selectedType === t ? "border-accent text-accent bg-accent/5" : "border-white/10"
                          )}
                          onClick={() => setSelectedType(t as any)}
                        >
                          {t}
                        </Button>
                      ))}
                    </div>
                    <Button 
                      className="w-full h-14 bg-accent text-black font-black text-xs uppercase tracking-widest rounded-2xl hover:bg-accent/80"
                      onClick={handleAddMeal}
                    >
                      ENREGISTRER AU JOURNAL
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <BottomNav />
    </main>
  );
}