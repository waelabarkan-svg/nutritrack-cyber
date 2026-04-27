
"use client"

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useFirestore, useCollection } from '@/firebase';
import { BottomNav } from '@/components/bottom-nav';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Plus, Trash2, Search, Camera, X, Check, Loader2, Volume2, VolumeX, Sparkles, Barcode, AlertCircle, RefreshCw, Flame, Zap, Wheat, Droplet, Coffee, Scale, History } from 'lucide-react';
import { collection, addDoc, query, where, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { toast } from '@/hooks/use-toast';
import foodDb from '@/lib/food-db.json';
import { estimateDish } from '@/ai/flows/estimate-dish-flow';
import { scanDish } from '@/ai/flows/scan-dish-flow';
import { addXp } from '@/lib/gamification-utils';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';

type MealType = 'petit-déjeuner' | 'déjeuner' | 'dîner' | 'snack' | 'boisson';

interface PortionPreset {
  label: string;
  amount: number; // in grams or ml
}

export default function JournalPage() {
  const { user, loading } = useUser();
  const db = useFirestore();
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');
  const [mealType, setMealType] = useState<MealType>('déjeuner');
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isBarcodeOpen, setIsBarcodeOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isPortionOpen, setIsPortionOpen] = useState(false);
  
  const [selectedMeal, setSelectedMeal] = useState<any>(null);
  const [selectedFoodForPortion, setSelectedFoodForPortion] = useState<any>(null);
  const [customQuantity, setCustomQuantity] = useState(100);
  const [isMuted, setIsMuted] = useState(false);
  
  const [aiEstimating, setAiEstimating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [aiResult, setAiResult] = useState<any>(null);
  const [scanningImage, setScanningImage] = useState<string | null>(null);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [barcodeResult, setBarcodeResult] = useState<any>(null);
  const [isFetchingBarcode, setIsFetchingBarcode] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const barcodeScannerRef = useRef<Html5QrcodeScanner | null>(null);

  const today = useMemo(() => new Date().toISOString().split('T')[0], []);

  const mealsQuery = useMemo(() => {
    if (!user) return null;
    return query(collection(db, 'users', user.uid, 'meals'), where('date', '==', today));
  }, [user, today, db]);

  const { data: meals } = useCollection(mealsQuery);

  const filteredFood = useMemo(() => {
    if (!searchTerm || searchTerm.length < 2) return [];
    const searchLower = searchTerm.toLowerCase();
    
    const memory = JSON.parse(localStorage.getItem('biometric_memory') || '[]');
    const memoryResults = memory
      .filter((h: any) => h.name?.toLowerCase().includes(searchLower))
      .map((h: any) => ({ ...h, isFromHistory: true }));

    const dbResults = foodDb.filter(f => f.name.toLowerCase().includes(searchLower));

    const combined = [...memoryResults, ...dbResults];
    const uniqueMap = new Map();
    combined.forEach(item => {
      const key = item.name.toUpperCase();
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, item);
      }
    });

    return Array.from(uniqueMap.values()).slice(0, 10);
  }, [searchTerm]);

  const announceResults = (data: any) => {
    if (isMuted || typeof window === 'undefined' || !window.speechSynthesis) return;
    const script = `Analyse terminée. Produit : ${data.name}.`;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(script);
    utterance.lang = 'fr-FR';
    window.speechSynthesis.speak(utterance);
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
  };

  const startCamera = async () => {
    setAiResult(null);
    setScanningImage(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      setHasCameraPermission(true);
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch (err) {
      setHasCameraPermission(false);
      toast({ variant: "destructive", title: "ACCÈS CAMÉRA REFUSÉ" });
    }
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUri = canvas.toDataURL('image/jpeg', 0.8);
      setScanningImage(dataUri);
      stopCamera();
    }
  };

  const fetchBarcodeData = async (code: string) => {
    setIsFetchingBarcode(true);
    try {
      const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${code}.json`);
      const data = await res.json();
      if (data.status === 1 && data.product) {
        const p = data.product;
        const result = {
          name: (p.product_name || "PRODUIT INCONNU").toUpperCase(),
          calories: Math.round(p.nutriments['energy-kcal_100g'] || 0),
          protein: Math.round(p.nutriments['proteins_100g'] || 0),
          carbs: Math.round(p.nutriments['carbohydrates_100g'] || 0),
          fat: Math.round(p.nutriments['fat_100g'] || 0),
          fiber: Math.round(p.nutriments['fiber_100g'] || 0),
          vitamins: p.vitamins_tags?.map((v: string) => v.split(':').pop()?.toUpperCase()).join(', ') || null,
          minerals: p.minerals_tags?.map((m: string) => m.split(':').pop()?.toUpperCase()).join(', ') || null,
          imageUrl: p.image_front_url || p.image_url || null
        };
        setBarcodeResult(result);
        announceResults(result);
      }
    } catch (e) {
      toast({ variant: "destructive", title: "ERREUR LIAISON" });
    } finally {
      setIsFetchingBarcode(false);
    }
  };

  const startBarcodeScanner = () => {
    setTimeout(() => {
      if (barcodeScannerRef.current) barcodeScannerRef.current.clear();
      barcodeScannerRef.current = new Html5QrcodeScanner("reader", { fps: 10, qrbox: 250 }, false);
      barcodeScannerRef.current.render((decodedText) => {
        barcodeScannerRef.current?.clear();
        fetchBarcodeData(decodedText);
      }, () => {});
    }, 100);
  };

  const runImageAnalysis = async () => {
    if (!scanningImage || aiEstimating) return;
    setAiEstimating(true);
    try {
      const result = await scanDish({ photoDataUri: scanningImage });
      const enrichedResult = { ...result, imageUrl: scanningImage };
      setAiResult(enrichedResult);
      announceResults(enrichedResult);
    } catch (e: any) {
      toast({ variant: "destructive", title: "ERREUR VISION IA" });
    } finally {
      setAiEstimating(false);
    }
  };

  const updateBiometricMemory = (meal: any) => {
    try {
      const memory = JSON.parse(localStorage.getItem('biometric_memory') || '[]');
      const weightMultiplier = meal.weight ? (meal.weight / 100) : 1;
      
      const newEntry = { 
        name: meal.name.toUpperCase(), 
        calories: meal.calories / weightMultiplier,
        protein: meal.protein / weightMultiplier,
        carbs: meal.carbs / weightMultiplier,
        fat: meal.fat / weightMultiplier,
        fiber: meal.fiber / weightMultiplier,
        vitamins: meal.vitamins,
        minerals: meal.minerals,
        imageUrl: meal.imageUrl,
        id: Date.now() 
      };
      
      const filteredMemory = memory.filter((m: any) => m.name.toUpperCase() !== newEntry.name);
      filteredMemory.unshift(newEntry);
      localStorage.setItem('biometric_memory', JSON.stringify(filteredMemory.slice(0, 100)));
    } catch (e) {
      console.error("Erreur mémoire locale:", e);
    }
  };

  const addMeal = async (food: any, isScan = false, weight = 100) => {
    if (!user || isSaving) return;

    setIsSaving(true);
    
    // Fermer le clavier sur mobile
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }

    try {
      const multiplier = weight / 100;
      const mealData = {
        name: food.name.toUpperCase(),
        calories: Math.round(Number(food.calories) * multiplier),
        protein: Math.round(Number(food.protein) * multiplier),
        carbs: Math.round(Number(food.carbs) * multiplier),
        fat: Math.round(Number(food.fat) * multiplier),
        fiber: Math.round(Number(food.fiber || 0) * multiplier),
        vitamins: food.vitamins || null,
        minerals: food.minerals || null,
        type: mealType,
        date: today,
        imageUrl: food.imageUrl || null,
        createdAt: new Date().toISOString(),
        isAiEstimated: isScan,
        weight: weight
      };
      
      // Fermeture immédiate des modales pour fluidité mobile
      setIsPortionOpen(false);
      setIsScannerOpen(false);
      setIsBarcodeOpen(false);
      setSearchTerm('');

      await addDoc(collection(db, 'users', user.uid, 'meals'), mealData);
      
      updateBiometricMemory({ ...food, weight: 100 });
      addXp(isScan ? 50 : 15, 'scan');
      setAiResult(null);
      setBarcodeResult(null);
      setScanningImage(null);
      
      toast({ title: "ARCHIVE BIOMÉTRIQUE MISE À JOUR" });
    } catch (e: any) {
      console.error("Erreur archivage:", e);
      toast({ variant: "destructive", title: "ÉCHEC DE L'ARCHIVAGE", description: e.message });
    } finally {
      setIsSaving(false);
    }
  };

  const handleAiEstimate = async () => {
    if (!searchTerm || aiEstimating) return;
    setAiEstimating(true);
    try {
      const result = await estimateDish({ dishName: searchTerm });
      setAiResult({ ...result, imageUrl: null });
    } catch (e: any) {
      toast({ variant: "destructive", title: "ERREUR IA" });
    } finally {
      setAiEstimating(false);
    }
  };

  const repairBioData = async () => {
    if (!selectedMeal || aiEstimating || !user) return;
    setAiEstimating(true);
    try {
      const result = await estimateDish({ dishName: selectedMeal.name });
      const mealRef = doc(db, 'users', user.uid, 'meals', selectedMeal.id);
      const updateData = {
        vitamins: result.vitamins || "Non détecté",
        minerals: result.minerals || "Non détecté",
        fiber: Number(result.fiber) || 0,
        isAiEstimated: true
      };
      await updateDoc(mealRef, updateData);
      setSelectedMeal({ ...selectedMeal, ...updateData });
      toast({ title: "ARCHIVE RECONSTRUITE" });
    } catch (e) {
      toast({ variant: "destructive", title: "ÉCHEC RECONSTRUCTION" });
    } finally {
      setAiEstimating(false);
    }
  };

  const deleteMeal = async (id: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'meals', id));
    } catch (e) {
      toast({ variant: "destructive", title: "ÉCHEC SUPPRESSION" });
    }
  };

  const openPortionPicker = (food: any) => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    setSelectedFoodForPortion(food);
    const isSpice = ["SEL", "POIVRE", "PIMENT", "PAPRIKA", "CURCUMA", "CUMIN"].some(s => food.name.toUpperCase().includes(s));
    setCustomQuantity(isSpice ? 1 : 100);
    setIsPortionOpen(true);
  };

  const getFallbackImage = (name: string) => {
    return `https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&q=80&w=400&h=300&sig=${encodeURIComponent(name.toLowerCase())}`;
  };

  const getPortionPresets = (name: string): PortionPreset[] => {
    const n = name.toUpperCase();
    if (["SUCRE", "SEL", "POIVRE", "CUMIN"].some(s => n.includes(s))) {
      return [{ label: "PINCÉE", amount: 2 }, { label: "MOY.", amount: 5 }, { label: "LARGE", amount: 10 }];
    }
    return [{ label: "PETITE", amount: 50 }, { label: "MOYENNE", amount: 150 }, { label: "LARGE", amount: 300 }];
  };

  return (
    <TooltipProvider>
      <main className="px-4 pt-12 max-w-md mx-auto pb-32 min-h-screen bg-black text-white selection:bg-primary/20">
        <header className="flex justify-between items-start mb-12">
          <div className="space-y-1">
            <p className="text-primary/60 text-[9px] font-black uppercase tracking-[0.5em] neon-text-yellow">Interface Log</p>
            <h1 className="text-3xl font-black tracking-tighter uppercase neon-text-yellow">Journal</h1>
          </div>
          <Button variant="ghost" size="icon" className={`w-10 h-10 border ${isMuted ? 'text-destructive border-destructive/20' : 'text-accent border-accent/20'}`} onClick={() => setIsMuted(!isMuted)}>
            {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </Button>
        </header>

        <section className="mb-12 space-y-6">
          <div className="flex gap-2 overflow-x-auto pb-4 scrollbar-hide">
            {(['petit-déjeuner', 'déjeuner', 'dîner', 'snack', 'boisson'] as MealType[]).map((type) => (
              <button key={type} onClick={() => setMealType(type)} className={`px-6 py-2 text-[10px] font-black uppercase tracking-widest border transition-all rounded-full whitespace-nowrap ${mealType === type ? 'bg-primary text-black border-primary shadow-[0_0_15px_rgba(253,224,71,0.5)]' : 'border-white/10 text-muted-foreground'}`}>{type}</button>
            ))}
          </div>
          
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-primary/40" size={18} />
              <Input className="bg-white/5 border-primary/20 h-14 pl-12 font-black uppercase rounded-xl" placeholder="RECHERCHER..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
            <div className="flex gap-2">
              <Button size="icon" className="h-14 w-14 border-accent text-accent rounded-full bg-black shadow-[0_0_15px_rgba(0,242,255,0.3)]" onClick={() => setIsScannerOpen(true)}><Camera size={20} /></Button>
              <Button size="icon" className="h-14 w-14 border-primary text-primary rounded-full bg-black shadow-[0_0_15px_rgba(253,224,71,0.3)]" onClick={() => setIsBarcodeOpen(true)}><Barcode size={20} /></Button>
            </div>
          </div>

          {filteredFood.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-[8px] font-black text-primary/40 uppercase tracking-widest px-1">Mémoire Biométrique</h3>
              {filteredFood.map((food: any, idx) => (
                <div key={idx} className="flex justify-between items-center p-4 bg-white/5 border border-white/10 rounded-2xl group active:border-primary transition-all">
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <img src={food.imageUrl || getFallbackImage(food.name)} className="w-10 h-10 object-cover rounded-lg border border-white/10" alt="" />
                      {food.isFromHistory && <History className="absolute -top-1 -left-1 text-accent bg-black rounded-full p-0.5" size={12} />}
                    </div>
                    <div>
                      <p className="font-black text-[12px] uppercase tracking-tight text-white">{food.name}</p>
                      <p className="text-[10px] text-muted-foreground font-black uppercase">{Math.round(food.calories)} KCAL | P: {Math.round(food.protein)}G</p>
                    </div>
                  </div>
                  <Button type="button" size="icon" className="w-10 h-10 border-primary text-primary bg-transparent" onClick={() => openPortionPicker(food)}><Plus size={18} /></Button>
                </div>
              ))}
              {!aiResult && searchTerm.length > 3 && (
                <Button type="button" onClick={handleAiEstimate} disabled={aiEstimating} className="w-full h-14 border-primary/40 bg-black text-primary rounded-xl font-black text-[10px] tracking-widest">
                  {aiEstimating ? <Loader2 className="animate-spin mr-2" /> : <Sparkles className="mr-2" />} ESTIMATION IA
                </Button>
              )}
            </div>
          )}
        </section>

        <section className="space-y-10">
          {['petit-déjeuner', 'déjeuner', 'dîner', 'snack', 'boisson'].map((section) => {
            const sectionMeals = (meals as any)?.filter((m: any) => m.type === section) || [];
            if (sectionMeals.length === 0 && searchTerm !== '') return null;
            return (
              <div key={section} className="space-y-4">
                <div className="flex items-center gap-2 border-b border-white/10 pb-1">
                  <div className="w-1 h-3 bg-primary" />
                  <h3 className="text-[10px] font-black text-white/30 uppercase tracking-[0.4em]">{section}</h3>
                </div>
                <div className="space-y-1">
                  {sectionMeals.map((meal: any) => (
                    <div key={meal.id} onClick={() => { setSelectedMeal(meal); setIsDetailsOpen(true); }} className="flex justify-between items-center py-3 border-b border-white/5 active:bg-white/5 px-1 cursor-pointer">
                      <div className="flex items-center gap-3">
                        <p className="text-[10px] font-black uppercase text-white/90">{meal.name}</p>
                        {meal.isAiEstimated && <Badge variant="outline" className="text-[7px] border-accent/30 text-accent h-3 px-1">IA</Badge>}
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-[14px] font-black text-accent">{meal.calories} <span className="text-[7px] text-white/40">KCAL</span></span>
                        <button onClick={(e) => { e.stopPropagation(); deleteMeal(meal.id); }} className="text-white/20 active:text-destructive"><Trash2 size={12} /></button>
                      </div>
                    </div>
                  ))}
                  {sectionMeals.length === 0 && <p className="text-[8px] text-white/10 uppercase italic py-2">Archives vides</p>}
                </div>
              </div>
            );
          })}
        </section>

        <Dialog open={isPortionOpen} onOpenChange={setIsPortionOpen}>
          <DialogContent className="bg-black border-primary text-white rounded-[32px] p-8 max-w-sm z-50 shadow-[0_0_50px_rgba(253,224,71,0.2)]">
            <DialogTitle className="sr-only">Calibration</DialogTitle>
            {selectedFoodForPortion && (
              <div className="space-y-8">
                <header className="space-y-2">
                  <p className="text-primary/60 text-[8px] font-black uppercase tracking-[0.4em]">Calibration Dose</p>
                  <h3 className="text-xl font-black uppercase tracking-tight neon-text-yellow">{selectedFoodForPortion.name}</h3>
                </header>
                <div className="grid grid-cols-3 gap-2">
                  {getPortionPresets(selectedFoodForPortion.name).map((p, idx) => (
                    <Button key={idx} variant="outline" className={customQuantity === p.amount ? "border-primary text-primary bg-primary/10 h-10 text-[8px]" : "h-10 text-[8px] border-white/10 text-white/40"} onClick={() => setCustomQuantity(p.amount)}>{p.label}</Button>
                  ))}
                </div>
                <div className="space-y-6">
                  <div className="flex justify-between items-end"><span className="text-[9px] font-black text-muted-foreground uppercase">Quantité</span><span className="text-xl font-black text-white">{customQuantity}G/ML</span></div>
                  <Slider value={[customQuantity]} onValueChange={([v]) => setCustomQuantity(v)} max={500} step={1} />
                </div>
                <Button 
                  type="button" 
                  disabled={isSaving} 
                  className="w-full h-16 bg-primary text-black font-black neon-glow-yellow rounded-xl active:scale-95 transition-all text-[11px] tracking-widest" 
                  onClick={() => addMeal(selectedFoodForPortion, false, customQuantity)}
                >
                  {isSaving ? <Loader2 className="animate-spin" /> : "ARCHIVER LA DOSE"}
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>

        <Dialog open={isScannerOpen} onOpenChange={(o) => { setIsScannerOpen(o); if(o) setTimeout(startCamera,100); else stopCamera(); }}>
          <DialogContent className="bg-black border-accent text-white rounded-[32px] p-0 overflow-hidden max-w-sm z-50">
            <div className="relative h-[70vh]">
              {!scanningImage ? (
                <>
                  <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                  <div className="absolute bottom-6 left-0 right-0 flex justify-center"><button className="w-20 h-20 rounded-full border-8 border-accent/30 bg-black/20 backdrop-blur-md flex items-center justify-center" onClick={capturePhoto}><div className="w-12 h-12 rounded-full bg-accent" /></button></div>
                </>
              ) : (
                <div className="w-full h-full relative">
                  <img src={scanningImage} className="w-full h-full object-cover" alt="" />
                  {aiEstimating ? (
                    <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center gap-4"><Loader2 className="animate-spin text-accent" size={48} /><p className="text-[10px] font-black text-accent uppercase tracking-widest">Analyse...</p></div>
                  ) : aiResult ? (
                    <div className="absolute bottom-0 left-0 right-0 p-8 bg-black/90 border-t border-accent backdrop-blur-xl">
                      <h3 className="text-xl font-black uppercase mb-6 text-accent neon-text-blue">{aiResult.name}</h3>
                      <div className="grid grid-cols-4 gap-4 mb-8">
                        {['calories', 'protein', 'carbs', 'fat'].map(k => (
                          <div key={k} className="text-center"><p className="text-sm font-black text-white">{aiResult[k]}</p><p className="text-[7px] text-muted-foreground uppercase font-black">{k.substring(0,4)}</p></div>
                        ))}
                      </div>
                      <Button type="button" disabled={isSaving} className="w-full h-14 bg-accent text-black font-black neon-glow-blue rounded-xl" onClick={() => addMeal(aiResult, true)}>
                        {isSaving ? <Loader2 className="animate-spin" /> : "ARCHIVER RÉSULTAT"}
                      </Button>
                    </div>
                  ) : (
                    <div className="absolute bottom-6 left-0 right-0 px-6 flex gap-2"><Button variant="outline" className="flex-1 h-14 border-white/20" onClick={() => setScanningImage(null)}>REPRENDRE</Button><Button className="flex-[2] h-14 bg-accent text-black font-black" onClick={runImageAnalysis}>ANALYSER</Button></div>
                  )}
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={isBarcodeOpen} onOpenChange={(o) => { setIsBarcodeOpen(o); if(o) startBarcodeScanner(); else if(barcodeScannerRef.current) barcodeScannerRef.current.clear(); }}>
          <DialogContent className="bg-black border-primary text-white rounded-[32px] p-6 max-w-sm z-50">
            <div id="reader" className="w-full min-h-[300px] bg-black/50 border border-primary/20 rounded-2xl overflow-hidden" />
            {isFetchingBarcode && <div className="flex justify-center mt-6"><Loader2 className="animate-spin text-primary" /></div>}
            {barcodeResult && (
              <div className="mt-8 p-6 border border-primary bg-primary/5 rounded-2xl space-y-6">
                <div className="flex gap-4"><img src={barcodeResult.imageUrl || getFallbackImage(barcodeResult.name)} className="w-16 h-16 object-cover rounded-xl" alt="" /><div className="flex-1"><h3 className="font-black uppercase text-xs text-primary">{barcodeResult.name}</h3><div className="grid grid-cols-4 gap-1 text-[10px] mt-2"><span>{barcodeResult.calories}kcal</span><span>{barcodeResult.protein}g P</span><span>{barcodeResult.carbs}g G</span><span>{barcodeResult.fat}g L</span></div></div></div>
                <Button type="button" disabled={isSaving} className="w-full h-12 bg-primary text-black font-black rounded-xl" onClick={() => addMeal(barcodeResult, true)}>
                  {isSaving ? <Loader2 className="animate-spin" /> : "ARCHIVER PRODUIT"}
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>

        <BottomNav />
        <canvas ref={canvasRef} className="hidden" />
      </main>
    </TooltipProvider>
  );
}
