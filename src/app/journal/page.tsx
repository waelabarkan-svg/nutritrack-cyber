
"use client"

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useFirestore, useCollection } from '@/firebase';
import { BottomNav } from '@/components/bottom-nav';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Plus, Trash2, Search, Camera, X, Check, Loader2, Volume2, VolumeX, Sparkles, Barcode, AlertCircle, RefreshCw, Flame, Zap, Wheat, Droplet, Coffee, Scale, History, Info } from 'lucide-react';
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

  // Sécurité : Réinitialise l'état de sauvegarde à l'ouverture de la modale de portion
  useEffect(() => {
    if (isPortionOpen) {
      setIsSaving(false);
    }
  }, [isPortionOpen]);

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
    const formatValue = (val: any) => (val !== undefined && val !== null ? val : 'non détecté');
    const script = `Analyse terminée. Produit : ${data.name}. Apport énergétique : ${formatValue(data.calories)} calories.`;
    
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(script);
    utterance.lang = 'fr-FR';
    utterance.pitch = 0.7;
    utterance.rate = 1.0;
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
          name: p.product_name || "PRODUIT INCONNU",
          calories: Math.round(p.nutriments['energy-kcal_100g'] || 0),
          protein: Math.round(p.nutriments['proteins_100g'] || 0),
          carbs: Math.round(p.nutriments['carbohydrates_100g'] || 0),
          fat: Math.round(p.nutriments['fat_100g'] || 0),
          fiber: Math.round(p.nutriments['fiber_100g'] || 0),
          vitamins: p.vitamins_tags?.map((v: string) => v.split(':').pop()?.toUpperCase()).join(', ') || null,
          minerals: p.minerals_tags?.map((m: string) => m.split(':').pop()?.toUpperCase()).join(', ') || null,
          healthAdvice: "Produit industriel identifié. Intégrité vérifiée.",
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
      toast({ variant: "destructive", title: "ÉCHEC ANALYSE VISION" });
    } finally {
      setAiEstimating(false);
    }
  };

  const updateBiometricMemory = (meal: any) => {
    const memory = JSON.parse(localStorage.getItem('biometric_memory') || '[]');
    const newEntry = { 
      name: meal.name.toUpperCase(), 
      calories: meal.calories / (meal.weight / 100),
      protein: meal.protein / (meal.weight / 100),
      carbs: meal.carbs / (meal.weight / 100),
      fat: meal.fat / (meal.weight / 100),
      fiber: meal.fiber / (meal.weight / 100),
      vitamins: meal.vitamins,
      minerals: meal.minerals,
      imageUrl: meal.imageUrl,
      id: Date.now() 
    };
    
    const filteredMemory = memory.filter((m: any) => m.name.toUpperCase() !== newEntry.name);
    filteredMemory.unshift(newEntry);
    localStorage.setItem('biometric_memory', JSON.stringify(filteredMemory.slice(0, 100)));
  };

  const addMeal = async (meal: any, isQuickAdd = false, weight = null) => {
    if (isSaving) return;

    if (typeof window !== 'undefined' && !window.navigator.onLine) {
      toast({ variant: "destructive", title: "HORS LIGNE", description: "Veuillez vérifier votre connexion réseau." });
      return;
    }

    setIsSaving(true);
    
    const safetyTimeout = setTimeout(() => {
      setIsSaving(false);
    }, 5000);

    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }

    try {
      if (!user) return;

      const finalWeight = weight || 100;
      const mealData = {
        name: meal.name.toUpperCase(),
        calories: Math.round(Number(meal.calories) * (finalWeight / 100)),
        protein: Math.round(Number(meal.protein) * (finalWeight / 100)),
        carbs: Math.round(Number(meal.carbs) * (finalWeight / 100)),
        fat: Math.round(Number(meal.fat) * (finalWeight / 100)),
        fiber: Math.round(Number(meal.fiber || 0) * (finalWeight / 100)),
        vitamins: meal.vitamins || null,
        minerals: meal.minerals || null,
        type: mealType,
        date: today,
        imageUrl: meal.imageUrl || null,
        createdAt: new Date().toISOString(),
        weight: finalWeight
      };

      await addDoc(collection(db, 'users', user.uid, 'meals'), mealData);
      
      updateBiometricMemory(mealData);
      addXp(25, 'scan');
      
      toast({ title: "ARCHIVAGE RÉUSSI", description: "Données injectées dans le journal." });
      
      setIsScannerOpen(false);
      setIsBarcodeOpen(false);
      setIsPortionOpen(false);
      setSearchTerm('');
      
    } catch (error: any) {
      console.error("Erreur archivage:", error);
      toast({ variant: "destructive", title: "ERREUR D'ENREGISTREMENT", description: error.message });
    } finally {
      setIsSaving(false);
      clearTimeout(safetyTimeout);
    }
  };

  const handleAiEstimate = async () => {
    if (!searchTerm || aiEstimating) return;
    setAiEstimating(true);
    try {
      const result = await estimateDish({ dishName: searchTerm });
      setAiResult({ ...result, imageUrl: null });
    } catch (e: any) {
      toast({ variant: "destructive", title: "ERREUR ESTIMATION IA" });
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
      toast({ title: "RECONSTRUCTION TERMINÉE" });
    } catch (e: any) {
      toast({ variant: "destructive", title: "ÉCHEC RECONSTRUCTION" });
    } finally {
      setAiEstimating(false);
    }
  };

  const deleteMeal = async (id: string) => {
    if (!user) return;
    deleteDoc(doc(db, 'users', user.uid, 'meals', id));
  };

  const openDetails = (meal: any) => {
    setSelectedMeal(meal);
    setIsDetailsOpen(true);
  };

  const openPortionPicker = (food: any) => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    setSelectedFoodForPortion(food);
    const isSpice = ["SEL", "POIVRE", "PIMENT", "PAPRIKA", "CURCUMA", "CUMIN"].some(s => food.name.toUpperCase().includes(s));
    const isSugar = ["SUCRE", "MIEL"].some(s => food.name.toUpperCase().includes(s));
    setCustomQuantity(isSpice ? 1 : isSugar ? 5 : 100);
    setIsPortionOpen(true);
  };

  const getFallbackImage = (name: string) => {
    const term = name.toLowerCase();
    return `https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&q=80&w=400&h=300&sig=${encodeURIComponent(term)}`;
  };

  const renderBadges = (data: string | string[] | null) => {
    if (!data || data === "Non détecté" || data === "Non répertorié") return null;
    const items = Array.isArray(data) ? data : data.split(',');
    return items.map((item, i) => (
      <Badge key={i} variant="outline" className="bg-white/5 border-white/10 text-[8px] uppercase font-black py-0.5 px-2 mr-1 mb-1">
        {String(item).trim()}
      </Badge>
    ));
  };

  const getPortionPresets = (name: string): PortionPreset[] => {
    const n = name.toUpperCase();
    if (["SUCRE", "CASSONADE"].some(s => n.includes(s))) {
      return [
        { label: "1 MORCEAU", amount: 5 },
        { label: "1 CUILLÈRE", amount: 6 },
        { label: "1 SACHET", amount: 7 }
      ];
    }
    if (["POIVRE", "SEL", "PAPRIKA", "CUMIN", "CURCUMA", "GINGEMBRE"].some(s => n.includes(s))) {
      return [
        { label: "PINCÉE", amount: 1 },
        { label: "DOSE MOY.", amount: 3 },
        { label: "C.À.C", amount: 5 }
      ];
    }
    if (n.includes("MIEL") || n.includes("SIROP")) {
      return [
        { label: "FILET", amount: 10 },
        { label: "C.À.C", amount: 15 },
        { label: "C.À.S", amount: 25 }
      ];
    }
    return [
      { label: "PETITE", amount: 50 },
      { label: "MOYENNE", amount: 150 },
      { label: "LARGE", amount: 300 }
    ];
  };

  return (
    <TooltipProvider>
      <main className="px-4 sm:px-6 pt-12 sm:pt-16 max-w-md mx-auto pb-32 min-h-screen bg-black text-white">
        <div className="flex justify-between items-start mb-8 sm:mb-12">
          <div className="space-y-1">
            <p className="text-primary/60 text-[8px] sm:text-[9px] font-black uppercase tracking-[0.5em] neon-text-yellow">Interface Log</p>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tighter uppercase neon-text-yellow">Journal de Bord</h1>
          </div>
          <Button variant="ghost" size="icon" className={`w-10 h-10 border transition-all ${isMuted ? 'text-destructive border-destructive/20' : 'text-accent border-accent/20'}`} onClick={() => { setIsMuted(!isMuted); window.speechSynthesis.cancel(); }}>
            {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </Button>
        </div>

        <section className="mb-12 space-y-6">
          <div className="flex gap-2 overflow-x-auto pb-4 scrollbar-hide">
            {(['petit-déjeuner', 'déjeuner', 'dîner', 'snack', 'boisson'] as MealType[]).map((type) => (
              <button 
                key={type} 
                onClick={() => setMealType(type)} 
                className={`px-6 py-2 text-[10px] font-black uppercase tracking-widest border transition-all whitespace-nowrap rounded-full flex items-center ${
                  mealType === type 
                  ? 'bg-primary text-black border-primary shadow-[0_0_15px_rgba(253,224,71,0.5)]' 
                  : 'border-white/10 text-muted-foreground'
                }`}
              >
                {type === 'boisson' && <Coffee size={14} className="mr-2" />}
                {type}
              </button>
            ))}
          </div>
          
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-primary/40" size={18} />
              <Input className="bg-white/5 border-primary/20 h-14 pl-12 font-black uppercase rounded-xl focus:ring-primary/40" placeholder="RECHERCHER..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
            <div className="flex gap-3">
              <Dialog open={isScannerOpen} onOpenChange={(o) => { setIsScannerOpen(o); if(o) setTimeout(startCamera,100); else stopCamera(); }}>
                <DialogTrigger asChild>
                  <Button className="h-14 w-14 border-accent bg-black text-accent rounded-full shadow-[0_0_25px_rgba(0,242,255,0.4)] active:scale-90 transition-all">
                    <Camera size={20} />
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-black border-accent text-white rounded-[32px] p-0 overflow-hidden max-w-sm z-[100]">
                  <DialogTitle className="sr-only">Analyse IA</DialogTitle>
                  <div className="relative h-[70vh]">
                    {!scanningImage ? (
                      <>
                        <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                        <div className="absolute bottom-6 left-0 right-0 flex justify-center items-center px-10">
                          <button className="w-20 h-20 rounded-full border-8 border-accent/30 bg-black/20 backdrop-blur-md flex items-center justify-center group" onClick={capturePhoto}>
                            <div className="w-12 h-12 rounded-full bg-accent group-active:scale-90 transition-transform shadow-[0_0_20px_rgba(0,242,255,0.8)]" />
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="w-full h-full relative">
                        <img src={scanningImage} className="w-full h-full object-cover contrast-125" alt="" />
                        {aiEstimating ? (
                          <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center gap-4"><Loader2 className="animate-spin text-accent" size={48} /><p className="text-[12px] font-black tracking-[0.6em] text-accent uppercase animate-pulse">LIAISON NEURALE...</p></div>
                        ) : aiResult ? (
                          <div className="absolute bottom-0 left-0 right-0 p-8 bg-black/90 border-t border-accent backdrop-blur-xl">
                            <h3 className="text-xl font-black uppercase mb-6 tracking-tight text-accent neon-text-blue">{aiResult.name}</h3>
                            <div className="grid grid-cols-4 gap-4 mb-8">
                              <div className="text-center"><p className="text-sm font-black text-white">{aiResult.calories}</p><p className="text-[7px] text-muted-foreground uppercase font-black">KCAL</p></div>
                              <div className="text-center"><p className="text-sm font-black text-white">{aiResult.protein}g</p><p className="text-[7px] text-muted-foreground uppercase font-black">PROT</p></div>
                              <div className="text-center"><p className="text-sm font-black text-white">{aiResult.carbs}g</p><p className="text-[7px] text-muted-foreground uppercase font-black">GLUC</p></div>
                              <div className="text-center"><p className="text-sm font-black text-white">{aiResult.fat}g</p><p className="text-[7px] text-muted-foreground uppercase font-black">LIPID</p></div>
                            </div>
                            <Button type="button" disabled={isSaving} className="w-full h-14 bg-accent text-black font-black neon-glow-blue rounded-xl" onClick={() => addMeal(aiResult, true)}>
                              {isSaving ? <Loader2 className="animate-spin" /> : "ARCHIVER DONNÉES"}
                            </Button>
                          </div>
                        ) : (
                          <div className="absolute bottom-6 left-0 right-0 px-6 flex gap-2">
                             <Button variant="outline" className="flex-1 h-14 border-white/20 text-white font-black rounded-xl" onClick={() => setScanningImage(null)}>REPRENDRE</Button>
                             <Button className="flex-[2] h-14 bg-accent text-black font-black rounded-xl" onClick={runImageAnalysis}>ANALYSER</Button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </DialogContent>
              </Dialog>

              <Dialog open={isBarcodeOpen} onOpenChange={(o) => { setIsBarcodeOpen(o); if(o) startBarcodeScanner(); else if(barcodeScannerRef.current) barcodeScannerRef.current.clear(); }}>
                <DialogTrigger asChild>
                  <Button className="h-14 w-14 border-primary bg-black text-primary rounded-full shadow-[0_0_25px_rgba(253,224,71,0.4)] active:scale-90 transition-all">
                    <Barcode size={20} />
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-black border-primary text-white rounded-[32px] p-6 max-w-sm z-[100]">
                  <DialogTitle className="sr-only">Scan Code-Barres</DialogTitle>
                  <div id="reader" className="w-full min-h-[300px] bg-black/50 border border-primary/20 rounded-2xl overflow-hidden" />
                  {isFetchingBarcode && <div className="flex justify-center mt-6"><Loader2 className="animate-spin text-primary" /></div>}
                  {barcodeResult && (
                    <div className="mt-8 p-6 border border-primary bg-primary/5 rounded-2xl">
                      <div className="flex gap-5 mb-6">
                        <img src={barcodeResult.imageUrl || getFallbackImage(barcodeResult.name)} className="w-20 h-20 object-cover border border-primary rounded-xl" alt="" />
                        <div className="flex-1">
                          <h3 className="font-black uppercase mb-3 text-sm tracking-tight text-primary neon-text-yellow">{barcodeResult.name}</h3>
                          <div className="grid grid-cols-4 gap-2 text-center">
                            <div><p className="text-[11px] font-black">{barcodeResult.calories}</p><p className="text-[7px] text-muted-foreground font-black">KCAL</p></div>
                            <div><p className="text-[11px] font-black">{barcodeResult.protein}g</p><p className="text-[7px] text-muted-foreground font-black">PROT</p></div>
                            <div><p className="text-[11px] font-black">{barcodeResult.carbs}g</p><p className="text-[7px] text-muted-foreground font-black">GLUC</p></div>
                            <div><p className="text-[11px] font-black">{barcodeResult.fat}g</p><p className="text-[7px] text-muted-foreground font-black">LIPID</p></div>
                          </div>
                        </div>
                      </div>
                      <Button type="button" disabled={isSaving} className="w-full h-12 bg-primary text-black font-black neon-glow-yellow rounded-xl" onClick={() => addMeal(barcodeResult, true)}>
                        {isSaving ? <Loader2 className="animate-spin" /> : "ARCHIVER PRODUIT"}
                      </Button>
                    </div>
                  )}
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {filteredFood.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 px-1">
                <h3 className="text-[8px] font-black text-primary/40 uppercase tracking-widest">Mémoire Biométrique & Index</h3>
                <button 
                  type="button" 
                  onPointerDown={(e) => e.preventDefault()} 
                  className="text-accent touch-none"
                >
                  <Info size={12} className="neon-text-blue" />
                </button>
              </div>
              {filteredFood.map((food: any, idx) => (
                <div key={idx} className="flex justify-between items-center p-4 bg-white/5 border border-white/10 rounded-2xl group transition-all">
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <img src={food.imageUrl || getFallbackImage(food.name)} className="w-10 h-10 object-cover rounded-lg border border-white/10" alt="" />
                      {food.isFromHistory && <History className="absolute -top-1 -left-1 text-accent bg-black rounded-full p-0.5" size={14} />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-black text-[12px] uppercase tracking-tight text-white">{food.name}</p>
                        {food.isFromHistory && <Badge variant="outline" className="text-[6px] border-accent/30 text-accent h-3 px-1">NEURAL</Badge>}
                      </div>
                      <p className="text-[10px] text-muted-foreground font-black uppercase">{Math.round(food.calories)} KCAL | P: {Math.round(food.protein)}G</p>
                    </div>
                  </div>
                  <Button type="button" size="icon" className="w-10 h-10 border-primary bg-transparent text-primary hover:bg-primary/10" onClick={() => openPortionPicker(food)}><Plus size={18} /></Button>
                </div>
              ))}
              {!aiResult && searchTerm.length > 3 && (
                <Button type="button" onClick={handleAiEstimate} disabled={aiEstimating} className="w-full h-14 border-primary/40 bg-black text-primary rounded-xl font-black text-[10px] tracking-widest hover:bg-primary/10">
                  {aiEstimating ? <Loader2 className="animate-spin mr-2" /> : <Sparkles className="mr-2" />} ESTIMATION MOLÉCULAIRE IA
                </Button>
              )}
            </div>
          )}
        </section>

        {searchTerm === '' && (
          <div className="space-y-10">
            {['petit-déjeuner', 'déjeuner', 'dîner', 'snack', 'boisson'].map((section) => {
              const sectionMeals = (meals as any)?.filter((m: any) => m.type === section) || [];
              return (
                <div key={section} className="space-y-4">
                  <div className="flex items-center gap-2 border-b border-white/10 pb-1 mb-4">
                    <div className="w-1 h-3 bg-destructive" />
                    <h3 className="text-[10px] font-light text-white/30 uppercase tracking-[0.4em]">{section}</h3>
                  </div>
                  
                  {sectionMeals.length === 0 ? (
                    <p className="text-[8px] text-white/10 font-black uppercase tracking-widest italic py-2">Veuillez scanner ou rechercher un aliment</p>
                  ) : (
                    <div className="space-y-2">
                      {sectionMeals.map((meal: any) => (
                        <div 
                          key={meal.id} 
                          onPointerDown={(e) => { e.preventDefault(); openDetails(meal); }}
                          className="flex justify-between items-center p-3 bg-black/40 border border-white/5 rounded-xl group transition-all cursor-pointer touch-none"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-1 h-6 bg-accent/40 rounded-full" />
                            <div>
                              <p className="text-[10px] font-black uppercase tracking-tight text-white/90 truncate max-w-[150px]">{meal.name}</p>
                              <p className="text-[7px] text-muted-foreground uppercase font-black">{meal.weight || 100} G/ML</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <span className="text-sm font-black text-accent neon-text-blue">{meal.calories}</span>
                              <span className="text-[7px] text-white/40 ml-0.5 uppercase block font-black leading-none">Kcal</span>
                            </div>
                            <button 
                              type="button" 
                              onPointerDown={(e) => { e.stopPropagation(); deleteMeal(meal.id); }} 
                              className="text-white/20 hover:text-destructive p-1 transition-colors"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <Dialog open={isPortionOpen} onOpenChange={setIsPortionOpen}>
          <DialogContent className="bg-black border-primary text-white rounded-[32px] p-8 max-w-sm z-[110]">
            <DialogTitle className="sr-only">Calibration de la Dose</DialogTitle>
            {selectedFoodForPortion && (
              <div className="space-y-8">
                <header className="space-y-2">
                  <p className="text-primary/60 text-[8px] font-black uppercase tracking-[0.4em]">Calibration de Portion</p>
                  <h3 className="text-xl font-black uppercase tracking-tight neon-text-yellow">{selectedFoodForPortion.name}</h3>
                </header>

                <div className="grid grid-cols-3 gap-2">
                  {getPortionPresets(selectedFoodForPortion.name).map((p, idx) => (
                    <Button 
                      key={idx} 
                      type="button"
                      variant="outline" 
                      className={customQuantity === p.amount ? "border-primary text-primary bg-primary/10 h-10 text-[8px]" : "border-white/10 text-white/40 h-10 text-[8px]"}
                      onClick={() => setCustomQuantity(p.amount)}
                    >
                      {p.label}
                    </Button>
                  ))}
                </div>

                <div className="space-y-6">
                  <div className="flex justify-between items-end">
                    <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Grammage Manuel</span>
                    <span className="text-xl font-black text-white">{customQuantity}<span className="text-[10px] ml-1">G/ML</span></span>
                  </div>
                  <Slider 
                    value={[customQuantity]} 
                    onValueChange={([v]) => setCustomQuantity(v)} 
                    max={500} 
                    step={1} 
                    className="py-4"
                  />
                </div>

                <div className="p-4 bg-white/5 border border-white/10 rounded-2xl grid grid-cols-2 gap-4">
                   <div className="flex flex-col">
                     <span className="text-[7px] font-black text-muted-foreground uppercase">Énergie Distribuée</span>
                     <span className="text-sm font-black text-destructive">{Math.round(selectedFoodForPortion.calories * (customQuantity/100))} KCAL</span>
                   </div>
                   <div className="flex flex-col text-right">
                     <span className="text-[7px] font-black text-muted-foreground uppercase">Synthèse Prot.</span>
                     <span className="text-sm font-black text-accent">{Math.round(selectedFoodForPortion.protein * (customQuantity/100))} G</span>
                   </div>
                </div>

                <button 
                  type="button" 
                  disabled={isSaving}
                  className="w-full h-14 bg-primary text-black font-black rounded-xl active:scale-95 transition-all flex items-center justify-center gap-2 touch-none"
                  onPointerDown={(e) => {
                    e.preventDefault();
                    if (!isSaving) {
                      addMeal(selectedFoodForPortion, false, customQuantity);
                    }
                  }}
                >
                  {isSaving ? <Loader2 className="animate-spin" size={18} /> : "ARCHIVER LA DOSE"}
                </button>
              </div>
            )}
          </DialogContent>
        </Dialog>

        <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
          <DialogContent className="bg-black/95 backdrop-blur-xl border-accent text-white rounded-[32px] p-0 overflow-hidden shadow-[0_0_50px_rgba(0,242,255,0.15)] max-w-sm z-[100]">
            <DialogTitle className="sr-only">Détails du repas</DialogTitle>
            {selectedMeal && (
              <div className="relative">
                <header className="p-4 flex flex-row justify-between items-center border-b border-white/10">
                  <span className="text-[12px] font-black uppercase tracking-[0.2em] neon-text-blue">{selectedMeal.name}</span>
                  <DialogClose className="text-white/40 hover:text-white transition-colors">
                    <X size={20} />
                  </DialogClose>
                </header>

                <div className="h-48 w-full relative">
                  <img src={selectedMeal.imageUrl || getFallbackImage(selectedMeal.name)} className="w-full h-full object-cover contrast-110 brightness-75" alt="" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent" />
                </div>

                <div className="p-6 space-y-6">
                  <div className="grid grid-cols-4 gap-2">
                    <div className="flex flex-col items-center justify-center border border-destructive/20 bg-black/40 p-3 rounded-2xl">
                      <Flame size={14} className="text-destructive mb-1" />
                      <span className="text-[12px] font-black text-white">{selectedMeal.calories}</span>
                      <span className="text-[6px] font-black text-muted-foreground uppercase">Kcal</span>
                    </div>
                    <div className="flex flex-col items-center justify-center border border-accent/20 bg-black/40 p-3 rounded-2xl">
                      <Zap size={14} className="text-accent mb-1" />
                      <span className="text-[12px] font-black text-white">{selectedMeal.protein}g</span>
                      <span className="text-[6px] font-black text-muted-foreground uppercase">Prot</span>
                    </div>
                    <div className="flex flex-col items-center justify-center border border-primary/20 bg-black/40 p-3 rounded-2xl">
                      <Wheat size={14} className="text-primary mb-1" />
                      <span className="text-[12px] font-black text-white">{selectedMeal.carbs}g</span>
                      <span className="text-[6px] font-black text-muted-foreground uppercase">Gluc</span>
                    </div>
                    <div className="flex flex-col items-center justify-center border border-[#a855f7]/20 bg-black/40 p-3 rounded-2xl">
                      <Droplet size={14} className="text-[#a855f7] mb-1" />
                      <span className="text-[12px] font-black text-white">{selectedMeal.fat}g</span>
                      <span className="text-[6px] font-black text-muted-foreground uppercase">Lipid</span>
                    </div>
                  </div>

                  <div className="space-y-4 pt-4 border-t border-white/10">
                    <div className="flex items-center gap-2">
                      <h3 className="text-[9px] font-black uppercase tracking-[0.4em] text-accent/70">Bio-Diagnostic</h3>
                    </div>
                    
                    <div className="space-y-3">
                      <div className="flex justify-between items-center py-2 border-b border-white/5">
                        <span className="text-[8px] font-black text-muted-foreground uppercase tracking-widest">Fibres</span>
                        <span className="text-[11px] font-black text-white">{selectedMeal.fiber || 0} g</span>
                      </div>

                      <div className="flex justify-between items-center py-2 border-b border-white/5">
                        <span className="text-[8px] font-black text-muted-foreground uppercase tracking-widest">Quantité</span>
                        <span className="text-[11px] font-black text-white">{selectedMeal.weight || 100} g/ml</span>
                      </div>
                      
                      <div className="space-y-2">
                        <span className="text-[8px] font-black text-accent/60 uppercase tracking-widest block">Vitamines</span>
                        <div className="flex flex-wrap gap-1">
                          {renderBadges(selectedMeal.vitamins) || <span className="text-[8px] text-white/20 italic">Non détecté</span>}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <span className="text-[8px] font-black text-primary/60 uppercase tracking-widest block">Sels Minéraux</span>
                        <div className="flex flex-wrap gap-1">
                          {renderBadges(selectedMeal.minerals) || <span className="text-[8px] text-white/20 italic">Non détecté</span>}
                        </div>
                      </div>
                    </div>

                    {!selectedMeal.vitamins && (
                      <Button type="button" onClick={repairBioData} disabled={aiEstimating} className="w-full border-destructive/30 text-destructive bg-black h-10 font-black text-[8px] tracking-widest hover:bg-destructive/10 rounded-xl">
                        {aiEstimating ? <Loader2 className="animate-spin mr-2" /> : <RefreshCw className="mr-2" />} RECONSTRUIRE ARCHIVE IA
                      </Button>
                    )}
                  </div>
                </div>
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
