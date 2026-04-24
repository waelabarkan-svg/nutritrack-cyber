"use client"

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useFirestore, useCollection } from '@/firebase';
import { BottomNav } from '@/components/bottom-nav';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Plus, Trash2, Search, Camera, Upload, X, Check, Loader2, Scan, Volume2, VolumeX, Sparkles, Barcode, ImageOff, Info, Zap, Flame, Wheat, Droplet, AlertCircle, RefreshCw } from 'lucide-react';
import { collection, addDoc, query, where, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { toast } from '@/hooks/use-toast';
import foodDb from '@/lib/food-db.json';
import { estimateDish } from '@/ai/flows/estimate-dish-flow';
import { scanDish } from '@/ai/flows/scan-dish-flow';
import { addXp } from '@/lib/gamification-utils';
import { Html5QrcodeScanner } from 'html5-qrcode';

type MealType = 'petit-déjeuner' | 'déjeuner' | 'dîner' | 'snack';

export default function JournalPage() {
  const { user, loading } = useUser();
  const db = useFirestore();
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<MealType>('petit-déjeuner');
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isBarcodeOpen, setIsBarcodeOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [selectedMeal, setSelectedMeal] = useState<any>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  
  const [aiEstimating, setAiEstimating] = useState(false);
  const [aiResult, setAiResult] = useState<any>(null);
  const [scanningImage, setScanningImage] = useState<string | null>(null);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [barcodeResult, setBarcodeResult] = useState<any>(null);
  const [isFetchingBarcode, setIsFetchingBarcode] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const barcodeScannerRef = useRef<Html5QrcodeScanner | null>(null);

  const today = useMemo(() => new Date().toISOString().split('T')[0], []);

  const mealsQuery = useMemo(() => {
    if (!user) return null;
    return query(collection(db, 'users', user.uid, 'meals'), where('date', '==', today));
  }, [user, today, db]);

  const { data: meals } = useCollection(mealsQuery);

  // Recherche hybride : DB locale + Historique récent
  const filteredFood = useMemo(() => {
    if (!searchTerm || searchTerm.length < 2) return [];
    
    const searchLower = searchTerm.toLowerCase();
    
    // 1. Filtrer la DB locale
    const dbResults = foodDb.filter(f => f.name.toLowerCase().includes(searchLower));
    
    // 2. Filtrer l'historique récent (localStorage via biometric_memory)
    const history = JSON.parse(localStorage.getItem('biometric_memory') || '[]');
    const historyResults = history
      .filter((h: any) => h.name?.toLowerCase().includes(searchLower))
      .map((h: any) => ({ ...h, isFromHistory: true }));

    // Fusion et dédoublonnage par nom
    const combined = [...historyResults, ...dbResults];
    const unique = Array.from(new Map(combined.map(item => [item.name.toUpperCase(), item])).values());
    
    return unique.slice(0, 10);
  }, [searchTerm]);

  const announceResults = (data: any) => {
    if (isMuted || typeof window === 'undefined' || !window.speechSynthesis) return;
    
    const formatValue = (val: any) => (val !== undefined && val !== null ? val : 'non détecté');
    
    const script = `Analyse terminée. Produit : ${data.name}. Apport énergétique : ${formatValue(data.calories)} calories. Protéines : ${formatValue(data.protein)} grammes. Lipides : ${formatValue(data.fat)} grammes. Glucides : ${formatValue(data.carbs)} grammes. Analyse du coach : ${data.healthAdvice || 'en attente'}.`;
    
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(script);
    utterance.lang = 'fr-FR';
    utterance.pitch = 0.7;
    utterance.rate = 1.0;
    utterance.volume = 1;

    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = 
      voices.find(v => v.lang.includes('fr') && (v.name.includes('Google') || v.name.includes('Natural'))) ||
      voices.find(v => v.lang.includes('fr')) ||
      voices.find(v => v.lang.includes('en') && v.name.includes('Google'));

    if (preferredVoice) utterance.voice = preferredVoice;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
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
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
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
        const realImageUrl = p.image_front_url || p.image_url || null;
        const getNutrient = (key: string) => Math.round(p.nutriments[key] || 0);
        
        const result = {
          name: p.product_name || "PRODUIT INCONNU",
          calories: getNutrient('energy-kcal_100g'),
          protein: getNutrient('proteins_100g'),
          carbs: getNutrient('carbohydrates_100g'),
          fat: getNutrient('fat_100g'),
          fiber: getNutrient('fiber_100g'),
          vitamins: p.vitamins_tags?.map((v: string) => v.split(':').pop()?.toUpperCase()).join(', ') || null,
          minerals: p.minerals_tags?.map((m: string) => m.split(':').pop()?.toUpperCase()).join(', ') || null,
          healthAdvice: "Produit industriel identifié. Intégrité nutritionnelle vérifiée.",
          imageUrl: realImageUrl
        };
        setBarcodeResult(result);
        announceResults(result);
      } else {
        toast({ variant: "destructive", title: "PRODUIT NON RÉPERTORIÉ" });
      }
    } catch (e) {
      toast({ variant: "destructive", title: "ERREUR LIAISON OFF" });
    } finally {
      setIsFetchingBarcode(false);
    }
  };

  const startBarcodeScanner = () => {
    setTimeout(() => {
      if (barcodeScannerRef.current) barcodeScannerRef.current.clear();
      barcodeScannerRef.current = new Html5QrcodeScanner("reader", { fps: 10, qrbox: { width: 250, height: 250 } }, false);
      barcodeScannerRef.current.render((decodedText) => {
        barcodeScannerRef.current?.clear();
        fetchBarcodeData(decodedText);
      }, (err) => {});
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
    } catch (e) {
      toast({ variant: "destructive", title: "DATA LINK OVERLOAD" });
    } finally {
      setAiEstimating(false);
    }
  };

  const updateBiometricMemory = (meal: any) => {
    const memory = JSON.parse(localStorage.getItem('biometric_memory') || '[]');
    const newEntry = {
      id: Date.now(),
      name: meal.name,
      calories: meal.calories,
      protein: meal.protein,
      carbs: meal.carbs,
      fat: meal.fat,
      vitamins: meal.vitamins,
      minerals: meal.minerals,
      fiber: meal.fiber,
      date: today,
      imageUrl: meal.imageUrl,
      scans: 1
    };
    memory.push(newEntry);
    localStorage.setItem('biometric_memory', JSON.stringify(memory.slice(-50))); // Garder les 50 derniers
  };

  const addMeal = async (food: any, isScan = false) => {
    if (!user) return;
    try {
      const mealData = {
        name: food.name.toUpperCase(),
        calories: Number(food.calories),
        protein: Number(food.protein),
        carbs: Number(food.carbs),
        fat: Number(food.fat),
        fiber: Number(food.fiber || 0),
        vitamins: food.vitamins || null,
        minerals: food.minerals || null,
        type: selectedType,
        date: today,
        imageUrl: food.imageUrl || null,
        createdAt: new Date().toISOString(),
        isAiEstimated: isScan
      };

      await addDoc(collection(db, 'users', user.uid, 'meals'), mealData);
      updateBiometricMemory(mealData);

      if (isScan) {
        const res = addXp(50, 'scan');
        if (res?.leveledUp) toast({ title: "LEVEL UP!", className: "bg-accent text-black font-black" });
      }

      setAiResult(null);
      setBarcodeResult(null);
      setScanningImage(null);
      setIsScannerOpen(false);
      setIsBarcodeOpen(false);
      setSearchTerm('');
      toast({ title: "SYSTÈME MIS À JOUR" });
    } catch (e) {
      toast({ variant: "destructive", title: "ERREUR SYNCHRO" });
    }
  };

  const handleAiEstimate = async () => {
    if (!searchTerm || aiEstimating) return;
    setAiEstimating(true);
    try {
      const result = await estimateDish({ dishName: searchTerm });
      const illustrationUrl = `https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&q=80&w=400&h=300&food=${encodeURIComponent(result.name)}`;
      setAiResult({ ...result, imageUrl: illustrationUrl });
    } catch (e) {
      toast({ variant: "destructive", title: "ERREUR SYSTÈME" });
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
        vitamins: result.vitamins || null,
        minerals: result.minerals || null,
        fiber: result.fiber || 0,
        isAiEstimated: true
      };
      await updateDoc(mealRef, updateData);
      setSelectedMeal({ ...selectedMeal, ...updateData });
      toast({ title: "DONNÉES RECONSTRUITES" });
    } catch (e) {
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

  useEffect(() => {
    return () => {
      stopCamera();
      if (barcodeScannerRef.current) barcodeScannerRef.current.clear();
    };
  }, []);

  return (
    <TooltipProvider>
      <main className="px-4 sm:px-6 pt-12 sm:pt-16 max-w-md mx-auto pb-32 min-h-screen bg-black text-white selection:bg-primary/20">
        <div className="flex justify-between items-start mb-8 sm:mb-12">
          <div className="space-y-1">
            <p className="text-primary/60 text-[8px] sm:text-[9px] font-black uppercase tracking-[0.5em] neon-text-yellow">Interface Log</p>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tighter uppercase neon-text-yellow">Journal de Bord</h1>
          </div>
          <div className="flex items-center gap-3">
            {isSpeaking && (
              <div className="flex gap-1 h-4 items-center px-2">
                <div className="eq-bar" /><div className="eq-bar" style={{ animationDelay: '0.1s' }} /><div className="eq-bar" style={{ animationDelay: '0.2s' }} /><div className="eq-bar" style={{ animationDelay: '0.3s' }} />
              </div>
            )}
            <Button variant="ghost" size="icon" className={`w-10 h-10 border ${isMuted ? 'text-destructive border-destructive/20' : 'text-accent border-accent/20'}`} onClick={() => { setIsMuted(!isMuted); if (!isMuted) window.speechSynthesis.cancel(); }}>
              {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </Button>
          </div>
        </div>

        <section className="mb-12 space-y-6">
          <div className="flex gap-2 mb-4 overflow-x-auto pb-2 scrollbar-hide">
            {['petit-déjeuner', 'déjeuner', 'dîner', 'snack'].map((type) => (
              <button key={type} onClick={() => setSelectedType(type as MealType)} className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest border rounded-full transition-all whitespace-nowrap ${selectedType === type ? 'bg-primary text-black border-primary shadow-[0_0_15px_rgba(253,224,71,0.5)]' : 'border-white/10 text-muted-foreground'}`}>{type}</button>
            ))}
          </div>
          
          <div className="flex flex-col gap-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-primary/40" size={18} />
                <Input className="bg-white/5 border-primary/20 h-14 pl-12 font-black uppercase tracking-widest rounded-[12px]" placeholder="RECHERCHER DANS L'HISTORIQUE..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
              </div>
              
              <div className="flex gap-2">
                <Dialog open={isScannerOpen} onOpenChange={(open) => { 
                  setIsScannerOpen(open); 
                  if (!open) {
                    stopCamera();
                    setAiResult(null);
                    setScanningImage(null);
                  } else {
                    setTimeout(startCamera, 100);
                  }
                }}>
                  <DialogTrigger asChild>
                    <Button className="h-14 w-14 border-accent bg-black text-accent neon-glow-blue rounded-[12px]"><Camera size={20} /></Button>
                  </DialogTrigger>
                  <DialogContent className="bg-black border-accent/40 text-white rounded-[20px] max-w-[95vw] sm:max-w-md p-0 overflow-hidden">
                    <DialogHeader>
                      <DialogTitle className="sr-only">Scanner de Bio-Données</DialogTitle>
                      <DialogDescription className="sr-only">Analyse nutritionnelle en cours via liaison Llama 4 Scout...</DialogDescription>
                    </DialogHeader>
                    <div className="relative h-[70vh] bg-black">
                      {!scanningImage ? (
                        <>
                          <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                          <div className="absolute bottom-6 left-0 right-0 flex justify-around items-center px-10">
                             <input type="file" ref={fileInputRef} onChange={(e) => { const f = e.target.files?.[0]; if (f) { const r = new FileReader(); r.onload = (ev) => setScanningImage(ev.target?.result as string); r.readAsDataURL(f); } }} accept="image/*" className="hidden" />
                             <Button variant="ghost" className="text-white/40" onClick={() => fileInputRef.current?.click()}><Upload size={24} /></Button>
                             <Button className="w-16 h-16 rounded-full border-4 border-accent bg-transparent" onClick={capturePhoto} />
                             <Button variant="ghost" className="text-white/40" onClick={() => setIsScannerOpen(false)}><X size={24} /></Button>
                          </div>
                        </>
                      ) : (
                        <div className="w-full h-full relative">
                          <img src={scanningImage} className="w-full h-full object-cover" alt="Captured" />
                          {aiEstimating ? (
                            <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-4"><Loader2 className="animate-spin text-accent" size={48} /><p className="text-[12px] font-black tracking-[0.6em] text-accent uppercase animate-pulse">LIAISON GROQ...</p></div>
                          ) : aiResult ? (
                            <div className="absolute bottom-0 left-0 right-0 p-6 bg-black/90 border-t border-accent/40">
                              <div className="flex gap-4 mb-4">
                                <div className="w-20 h-20 shrink-0 border border-accent/40 rounded-lg overflow-hidden shadow-[0_0_15px_rgba(0,242,255,0.3)] bg-black">
                                  {aiResult.imageUrl ? (
                                    <img src={aiResult.imageUrl} className="w-full h-full object-cover contrast-125 brightness-110" alt="Illustration" />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center"><ImageOff size={16} className="text-muted-foreground" /></div>
                                  )}
                                </div>
                                <div className="flex-1">
                                  <h3 className="text-xl font-black uppercase">{aiResult.name}</h3>
                                  <div className="grid grid-cols-4 gap-2 my-2">
                                    <div className="text-center"><p className="text-[10px] font-black">{aiResult.calories}</p><p className="text-[6px] text-muted-foreground">KCAL</p></div>
                                    <div className="text-center"><p className="text-[10px] font-black">{aiResult.protein}g</p><p className="text-[6px] text-muted-foreground">PROT</p></div>
                                    <div className="text-center"><p className="text-[10px] font-black">{aiResult.carbs}g</p><p className="text-[6px] text-muted-foreground">GLUC</p></div>
                                    <div className="text-center"><p className="text-[10px] font-black">{aiResult.fat}g</p><p className="text-[6px] text-muted-foreground">LIPID</p></div>
                                  </div>
                                </div>
                              </div>
                              <p className="text-[10px] text-primary font-bold mb-4 leading-tight">{aiResult.healthAdvice}</p>
                              <div className="flex gap-2">
                                <Button variant="outline" className="flex-1 text-[10px] font-black" onClick={() => { setScanningImage(null); setAiResult(null); startCamera(); }}>RESCANNER</Button>
                                <Button className="flex-1 border-accent neon-glow-blue font-black" onClick={() => addMeal(aiResult, true)}><Check className="mr-2" size={16} />ARCHIVER</Button>
                              </div>
                            </div>
                          ) : (
                            <div className="absolute bottom-6 left-0 right-0 flex flex-col items-center gap-4 px-6">
                              <Button className="w-full h-14 bg-accent text-black font-black rounded-xl" onClick={runImageAnalysis}><Scan className="mr-2" size={20} />Analyser</Button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </DialogContent>
                </Dialog>

                <Dialog open={isBarcodeOpen} onOpenChange={(open) => { 
                  setIsBarcodeOpen(open); 
                  if (!open) {
                    if (barcodeScannerRef.current) barcodeScannerRef.current.clear();
                    setBarcodeResult(null);
                  } else {
                    startBarcodeScanner();
                  }
                }}>
                  <DialogTrigger asChild>
                    <Button className="h-14 w-14 border-primary bg-black text-primary neon-glow-yellow rounded-[12px]"><Barcode size={20} /></Button>
                  </DialogTrigger>
                  <DialogContent className="bg-black border-primary/40 text-white rounded-[20px] max-w-[95vw] sm:max-w-md p-6">
                    <DialogHeader>
                      <DialogTitle className="text-primary neon-text-yellow uppercase tracking-widest text-center">Scan Code-Barres</DialogTitle>
                      <DialogDescription className="sr-only">Interrogation OpenFoodFacts pour extraire les nutriments.</DialogDescription>
                    </DialogHeader>
                    <div id="reader" className="w-full min-h-[300px] bg-black/50 border border-primary/20 mt-4 rounded-xl overflow-hidden" />
                    {isFetchingBarcode && <div className="flex justify-center mt-4"><Loader2 className="animate-spin text-primary" /></div>}
                    {barcodeResult && (
                      <div className="mt-6 p-4 border border-primary/40 bg-primary/5 rounded-xl">
                         <div className="flex gap-4 mb-4">
                           <div className="w-16 h-16 shrink-0 border border-primary/40 rounded-lg overflow-hidden bg-black">
                             {barcodeResult.imageUrl ? (
                               <img src={barcodeResult.imageUrl} className="w-full h-full object-cover contrast-125 brightness-110" alt="Product" />
                             ) : (
                               <div className="w-full h-full flex items-center justify-center"><ImageOff size={16} className="text-white/20" /></div>
                             )}
                           </div>
                           <div className="flex-1">
                             <h3 className="font-black uppercase mb-2 text-sm">{barcodeResult.name}</h3>
                             <div className="grid grid-cols-4 gap-2">
                                <div className="text-center"><p className="text-[10px] font-black">{barcodeResult.calories}</p><p className="text-[6px] text-muted-foreground">KCAL</p></div>
                                <div className="text-center"><p className="text-[10px] font-black">{barcodeResult.protein}g</p><p className="text-[6px] text-muted-foreground">PROT</p></div>
                                <div className="text-center"><p className="text-[10px] font-black">{barcodeResult.carbs}g</p><p className="text-[6px] text-muted-foreground">GLUC</p></div>
                                <div className="text-center"><p className="text-[10px] font-black">{barcodeResult.fat}g</p><p className="text-[6px] text-muted-foreground">LIPID</p></div>
                             </div>
                           </div>
                         </div>
                         <Button className="w-full border-primary neon-glow-yellow" onClick={() => addMeal(barcodeResult, true)}>ARCHIVER PRODUIT</Button>
                      </div>
                    )}
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </div>

          {(filteredFood.length > 0) && (
            <div className="space-y-2 animate-in fade-in slide-in-from-top-4 duration-300">
              <h3 className="text-[8px] font-black text-primary/40 uppercase tracking-widest px-1">Résultats de la recherche historique</h3>
              {filteredFood.map((food: any, idx) => (
                <div key={idx} className="cyber-card-yellow p-4 flex justify-between items-center bg-black/90 border-primary/40 rounded-[12px]">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded border border-primary/20 bg-black overflow-hidden">
                       {food.imageUrl ? <img src={food.imageUrl} className="w-full h-full object-cover" alt="" /> : <Info className="w-full h-full p-2 text-primary/20" />}
                    </div>
                    <div>
                      <p className="font-black text-xs uppercase">{food.name}</p>
                      <p className="text-[9px] text-muted-foreground">{food.calories} KCAL | P: {food.protein}G</p>
                    </div>
                  </div>
                  <Button size="icon" className="w-10 h-10 border-primary" onClick={() => addMeal(food)}><Plus size={18} /></Button>
                </div>
              ))}
              {!aiResult && searchTerm.length > 3 && (
                <Button onClick={handleAiEstimate} disabled={aiEstimating} className="w-full h-14 border-[#a855f7] bg-black/80 text-[#a855f7]">
                  {aiEstimating ? <Loader2 className="animate-spin mr-2" size={16} /> : <Sparkles className="mr-2" size={16} />}
                  <span className="font-black text-[10px] tracking-[0.2em] uppercase">NOUVELLE ESTIMATION SMART</span>
                </Button>
              )}
            </div>
          )}
        </section>

        <div className="space-y-12">
          {['petit-déjeuner', 'déjeuner', 'dîner', 'snack'].map((type) => {
            const sectionMeals = (meals || []).filter((m: any) => m.type === type);
            return (
              <div key={type} className="space-y-4">
                <h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-primary/70">{type.toUpperCase()}</h2>
                <div className="space-y-3">
                  {sectionMeals.length > 0 ? sectionMeals.map((meal: any) => (
                    <div key={meal.id} onClick={() => openDetails(meal)} className="cyber-card-blue p-4 flex justify-between items-center bg-black/40 border-accent/20 cursor-pointer hover:border-accent transition-all active:scale-[0.98]">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 shrink-0 border border-accent/20 rounded-md overflow-hidden bg-black/50">
                          {meal.imageUrl ? (
                            <img src={meal.imageUrl} className="w-full h-full object-cover contrast-125 brightness-110" alt="" />
                          ) : (
                            <img 
                              src={`https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&q=80&w=100&h=100&food=${encodeURIComponent(meal.name)}`} 
                              className="w-full h-full object-cover contrast-125 brightness-75" 
                              alt="" 
                            />
                          )}
                        </div>
                        <div>
                          <h3 className="font-black text-xs uppercase">{meal.name}</h3>
                          <p className="text-[9px] text-muted-foreground uppercase">{meal.calories} KCAL | P: {meal.protein}G</p>
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" className="text-white/10" onClick={(e) => { e.stopPropagation(); deleteMeal(meal.id); }}><Trash2 size={14} /></Button>
                    </div>
                  )) : <div className="h-[1px] w-full bg-white/5" />}
                </div>
              </div>
            );
          })}
        </div>

        <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
          <DialogContent className="bg-black/95 border-accent/40 text-white rounded-[24px] max-w-[95vw] sm:max-w-md p-0 overflow-hidden shadow-[0_0_50px_rgba(0,242,255,0.2)]">
            {selectedMeal && (
              <div className="relative">
                <DialogHeader>
                  <DialogTitle className="sr-only">Détails de l'aliment</DialogTitle>
                  <DialogDescription className="sr-only">Analyse nutritionnelle complète et micro-nutriments.</DialogDescription>
                </DialogHeader>
                <div className="h-48 w-full relative">
                  {selectedMeal.imageUrl ? (
                    <img src={selectedMeal.imageUrl} className="w-full h-full object-cover contrast-125 brightness-90 border-b border-accent/20" alt="" />
                  ) : (
                    <img 
                      src={`https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&q=80&w=400&h=300&food=${encodeURIComponent(selectedMeal.name)}`} 
                      className="w-full h-full object-cover contrast-125 brightness-75 border-b border-accent/20" 
                      alt="" 
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent" />
                  <DialogClose className="absolute right-4 top-4 w-8 h-8 rounded-full bg-black/60 border border-white/20 flex items-center justify-center text-white/60 hover:text-white">
                    <X size={16} />
                  </DialogClose>
                </div>

                <div className="p-6 space-y-6">
                  <div className="space-y-1">
                    <p className="text-accent/60 text-[8px] font-black uppercase tracking-[0.4em] neon-text-blue">Analyse Moléculaire</p>
                    <h2 className="text-2xl font-black tracking-tighter uppercase neon-text-blue">{selectedMeal.name}</h2>
                  </div>

                  <div className="grid grid-cols-4 gap-4">
                    <div className="cyber-card-red p-3 flex flex-col items-center justify-center bg-black/40 border-destructive/20">
                      <Flame size={14} className="text-destructive mb-1" />
                      <span className="text-sm font-black">{selectedMeal.calories}</span>
                      <span className="text-[6px] font-black text-muted-foreground uppercase">Kcal</span>
                    </div>
                    <div className="cyber-card-blue p-3 flex flex-col items-center justify-center bg-black/40 border-accent/20">
                      <Zap size={14} className="text-accent mb-1" />
                      <span className="text-sm font-black">{selectedMeal.protein}g</span>
                      <span className="text-[6px] font-black text-muted-foreground uppercase">Prot</span>
                    </div>
                    <div className="cyber-card-yellow p-3 flex flex-col items-center justify-center bg-black/40 border-primary/20">
                      <Wheat size={14} className="text-primary mb-1" />
                      <span className="text-sm font-black">{selectedMeal.carbs}g</span>
                      <span className="text-[6px] font-black text-muted-foreground uppercase">Gluc</span>
                    </div>
                    <div className="cyber-card-blue p-3 flex flex-col items-center justify-center bg-black/40 border-accent/20">
                      <Droplet size={14} className="text-accent mb-1" />
                      <span className="text-sm font-black">{selectedMeal.fat}g</span>
                      <span className="text-[6px] font-black text-muted-foreground uppercase">Lipid</span>
                    </div>
                  </div>

                  <div className="space-y-4 pt-4 border-t border-white/5">
                    <div className="flex justify-between items-center">
                      <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-primary/70 flex items-center gap-2">
                        <Info size={12} /> Micro-Nutriments
                      </h3>
                      {selectedMeal.isAiEstimated && (
                        <span className="text-[7px] font-black text-accent/60 uppercase tracking-widest border border-accent/20 px-2 py-0.5 rounded">Estimation IA</span>
                      )}
                    </div>
                    
                    {!selectedMeal.vitamins && !selectedMeal.minerals && !selectedMeal.fiber ? (
                      <div className="p-4 bg-primary/5 border border-primary/40 rounded-lg flex flex-col items-center gap-4 shadow-[0_0_15px_rgba(253,224,71,0.2)]">
                        <div className="flex items-center gap-2 text-primary">
                          <AlertCircle size={14} />
                          <p className="text-[9px] font-black uppercase tracking-widest">ALERTE SYSTÈME : ARCHIVE INCOMPLÈTE</p>
                        </div>
                        <Button 
                          onClick={repairBioData} 
                          disabled={aiEstimating}
                          className="w-full border-primary text-primary bg-black/40 h-10 text-[9px] font-black hover:bg-primary/10"
                        >
                          {aiEstimating ? <Loader2 className="animate-spin mr-2" size={12} /> : <RefreshCw className="mr-2" size={12} />}
                          RECONSTRUIRE BIO-DONNÉES
                        </Button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 gap-3">
                        <div className="flex justify-between items-center p-3 bg-white/5 rounded-lg border border-white/5">
                          <span className="text-[9px] font-black text-muted-foreground uppercase">Fibres</span>
                          <span className="text-xs font-black text-white">{selectedMeal.fiber || 0} g</span>
                        </div>
                        <div className="flex flex-col gap-1.5 p-3 bg-white/5 rounded-lg border border-white/5">
                          <span className="text-[9px] font-black text-muted-foreground uppercase flex items-center gap-2">
                            <Zap size={10} className="text-accent" /> Vitamines
                          </span>
                          <span className="text-[10px] font-black text-accent neon-text-blue">{selectedMeal.vitamins || "Non répertorié"}</span>
                        </div>
                        <div className="flex flex-col gap-1.5 p-3 bg-white/5 rounded-lg border border-white/5">
                          <span className="text-[9px] font-black text-muted-foreground uppercase flex items-center gap-2">
                            <Zap size={10} className="text-primary" /> Sels Minéraux
                          </span>
                          <span className="text-[10px] font-black text-primary neon-text-yellow">{selectedMeal.minerals || "Non répertorié"}</span>
                        </div>
                      </div>
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
