
"use client"

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useFirestore, useCollection } from '@/firebase';
import { BottomNav } from '@/components/bottom-nav';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Plus, Trash2, Search, Camera, X, Check, Loader2, Volume2, VolumeX, Sparkles, Barcode, AlertCircle, RefreshCw, Flame, Zap, Wheat, Droplet } from 'lucide-react';
import { collection, addDoc, query, where, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { toast } from '@/hooks/use-toast';
import foodDb from '@/lib/food-db.json';
import { estimateDish } from '@/ai/flows/estimate-dish-flow';
import { scanDish } from '@/ai/flows/scan-dish-flow';
import { addXp } from '@/lib/gamification-utils';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { Badge } from '@/components/ui/badge';

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
    const dbResults = foodDb.filter(f => f.name.toLowerCase().includes(searchLower));
    const memory = JSON.parse(localStorage.getItem('biometric_memory') || '[]');
    const memoryResults = memory
      .filter((h: any) => h.name?.toLowerCase().includes(searchLower))
      .map((h: any) => ({ ...h, isFromHistory: true }));

    const combined = [...memoryResults, ...dbResults];
    return Array.from(new Map(combined.map(item => [item.name.toUpperCase(), item])).values()).slice(0, 10);
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
    } catch (e) {
      toast({ variant: "destructive", title: "DATA LINK OVERLOAD" });
    } finally {
      setAiEstimating(false);
    }
  };

  const updateBiometricMemory = (meal: any) => {
    const memory = JSON.parse(localStorage.getItem('biometric_memory') || '[]');
    const newEntry = { ...meal, id: Date.now() };
    memory.push(newEntry);
    localStorage.setItem('biometric_memory', JSON.stringify(memory.slice(-50)));
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
      if (isScan) addXp(50, 'scan');
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
      setAiResult({ ...result, imageUrl: getFallbackImage(result.name) });
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
        vitamins: result.vitamins || "Non détecté",
        minerals: result.minerals || "Non détecté",
        fiber: Number(result.fiber) || 0,
        isAiEstimated: true
      };
      await updateDoc(mealRef, updateData);
      setSelectedMeal({ ...selectedMeal, ...updateData });
      toast({ title: "RECONSTRUCTION TERMINÉE" });
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

  const getFallbackImage = (name: string) => {
    const term = name.toLowerCase();
    let query = `food,${encodeURIComponent(term)}`;
    if (term.includes('poulet')) query = 'meat,chicken,grilled';
    if (term.includes('boeuf')) query = 'meat,beef,steak';
    return `https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&q=80&w=400&h=300&${query}`;
  };

  const renderBadges = (str: string | null) => {
    if (!str || str === "Non détecté" || str === "Non répertorié") return null;
    return str.split(',').map((item, i) => (
      <Badge key={i} variant="outline" className="bg-white/5 border-white/10 text-[8px] uppercase font-black py-0.5 px-2 mr-1 mb-1">
        {item.trim()}
      </Badge>
    ));
  };

  return (
    <TooltipProvider>
      <main className="px-4 sm:px-6 pt-12 sm:pt-16 max-w-md mx-auto pb-32 min-h-screen bg-black text-white">
        <div className="flex justify-between items-start mb-8 sm:mb-12">
          <div className="space-y-1">
            <p className="text-primary/60 text-[8px] sm:text-[9px] font-black uppercase tracking-[0.5em] neon-text-yellow">Interface Log</p>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tighter uppercase neon-text-yellow">Journal de Bord</h1>
          </div>
          <Button variant="ghost" size="icon" className={`w-10 h-10 border ${isMuted ? 'text-destructive border-destructive/20' : 'text-accent border-accent/20'}`} onClick={() => { setIsMuted(!isMuted); window.speechSynthesis.cancel(); }}>
            {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </Button>
        </div>

        <section className="mb-12 space-y-6">
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {['petit-déjeuner', 'déjeuner', 'dîner', 'snack'].map((type) => (
              <button key={type} onClick={() => setSelectedType(type as MealType)} className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest border rounded-full transition-all whitespace-nowrap ${selectedType === type ? 'bg-primary text-black border-primary' : 'border-white/10 text-muted-foreground'}`}>{type}</button>
            ))}
          </div>
          
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-primary/40" size={18} />
              <Input className="bg-white/5 border-primary/20 h-14 pl-12 font-black uppercase rounded-[12px] focus:ring-primary/40" placeholder="RECHERCHER..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
            <div className="flex gap-2">
              <Dialog open={isScannerOpen} onOpenChange={(o) => { setIsScannerOpen(o); if(o) setTimeout(startCamera,100); else stopCamera(); }}>
                <DialogTrigger asChild><Button className="h-14 w-14 border-accent text-accent rounded-[12px]"><Camera size={20} /></Button></DialogTrigger>
                <DialogContent className="bg-black border-accent/40 text-white rounded-[24px] p-0 overflow-hidden max-w-sm">
                  <DialogHeader>
                    <DialogTitle className="sr-only">Scanner de Bio-Données</DialogTitle>
                    <DialogDescription className="sr-only">Analyse nutritionnelle via Vision Engine.</DialogDescription>
                  </DialogHeader>
                  <div className="relative h-[70vh]">
                    {!scanningImage ? (
                      <>
                        <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                        <div className="absolute bottom-6 left-0 right-0 flex justify-center items-center px-10">
                          <button className="w-20 h-20 rounded-full border-8 border-accent/30 bg-black/20 backdrop-blur-md flex items-center justify-center group" onClick={capturePhoto}>
                            <div className="w-12 h-12 rounded-full bg-accent group-active:scale-90 transition-transform" />
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="w-full h-full relative">
                        <img src={scanningImage} className="w-full h-full object-cover contrast-125" alt="" />
                        {aiEstimating ? (
                          <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center gap-4"><Loader2 className="animate-spin text-accent" size={48} /><p className="text-[12px] font-black tracking-[0.6em] text-accent uppercase animate-pulse">LIAISON NEURALE...</p></div>
                        ) : aiResult ? (
                          <div className="absolute bottom-0 left-0 right-0 p-8 bg-black/90 border-t border-accent/40 backdrop-blur-xl">
                            <h3 className="text-xl font-black uppercase mb-6 tracking-tight text-accent neon-text-blue">{aiResult.name}</h3>
                            <div className="grid grid-cols-4 gap-4 mb-8">
                              <div className="text-center"><p className="text-sm font-black text-white">{aiResult.calories}</p><p className="text-[7px] text-muted-foreground uppercase font-black">KCAL</p></div>
                              <div className="text-center"><p className="text-sm font-black text-white">{aiResult.protein}g</p><p className="text-[7px] text-muted-foreground uppercase font-black">PROT</p></div>
                              <div className="text-center"><p className="text-sm font-black text-white">{aiResult.carbs}g</p><p className="text-[7px] text-muted-foreground uppercase font-black">GLUC</p></div>
                              <div className="text-center"><p className="text-sm font-black text-white">{aiResult.fat}g</p><p className="text-[7px] text-muted-foreground uppercase font-black">LIPID</p></div>
                            </div>
                            <Button className="w-full h-14 bg-accent text-black font-black neon-glow-blue rounded-xl" onClick={() => addMeal(aiResult, true)}>ARCHIVER DONNÉES</Button>
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
                <DialogTrigger asChild><Button className="h-14 w-14 border-primary text-primary rounded-[12px]"><Barcode size={20} /></Button></DialogTrigger>
                <DialogContent className="bg-black border-primary/40 text-white rounded-[24px] p-6 max-w-sm">
                  <DialogHeader>
                    <DialogTitle className="sr-only">Scan Code-Barres</DialogTitle>
                    <DialogDescription className="sr-only">Liaison avec la base de données mondiale.</DialogDescription>
                  </DialogHeader>
                  <div id="reader" className="w-full min-h-[300px] bg-black/50 border border-primary/20 rounded-2xl overflow-hidden" />
                  {isFetchingBarcode && <div className="flex justify-center mt-6"><Loader2 className="animate-spin text-primary" /></div>}
                  {barcodeResult && (
                    <div className="mt-8 p-6 border border-primary/40 bg-primary/5 rounded-2xl">
                      <div className="flex gap-5 mb-6">
                        <img src={barcodeResult.imageUrl || getFallbackImage(barcodeResult.name)} className="w-20 h-20 object-cover border border-primary/40 rounded-xl" alt="" />
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
                      <Button className="w-full h-12 bg-primary text-black font-black neon-glow-yellow rounded-xl" onClick={() => addMeal(barcodeResult, true)}>ARCHIVER PRODUIT</Button>
                    </div>
                  )}
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {filteredFood.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-[8px] font-black text-primary/40 uppercase tracking-widest px-1">Archives Suggestion</h3>
              {filteredFood.map((food: any, idx) => (
                <div key={idx} className="cyber-card-yellow p-4 flex justify-between items-center bg-black/90 border-primary/40 rounded-[12px] group hover:border-primary transition-all">
                  <div className="flex items-center gap-4">
                    <img src={food.imageUrl || getFallbackImage(food.name)} className="w-10 h-10 object-cover rounded-lg border border-primary/20 group-hover:border-primary/60 transition-all" alt="" />
                    <div>
                      <p className="font-black text-xs uppercase tracking-tight">{food.name}</p>
                      <p className="text-[9px] text-muted-foreground font-black uppercase">{food.calories} KCAL | P: {food.protein}G</p>
                    </div>
                  </div>
                  <Button size="icon" className="w-10 h-10 border-primary shadow-none bg-primary/5 hover:bg-primary/20" onClick={() => addMeal(food)}><Plus size={18} /></Button>
                </div>
              ))}
              {!aiResult && searchTerm.length > 3 && (
                <Button onClick={handleAiEstimate} disabled={aiEstimating} className="w-full h-14 border-[#a855f7]/40 bg-[#a855f7]/5 text-[#a855f7] rounded-xl font-black text-[10px] tracking-widest hover:bg-[#a855f7]/10">
                  {aiEstimating ? <Loader2 className="animate-spin mr-2" /> : <Sparkles className="mr-2" />} ESTIMATION MOLÉCULAIRE IA
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
                <h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-primary/70 border-l-2 border-primary pl-3">{type.toUpperCase()}</h2>
                <div className="space-y-3">
                  {sectionMeals.length > 0 ? sectionMeals.map((meal: any) => (
                    <div key={meal.id} onClick={() => openDetails(meal)} className="cyber-card-blue p-4 flex justify-between items-center cursor-pointer hover:border-accent group transition-all">
                      <div className="flex items-center gap-4">
                        <img src={meal.imageUrl || getFallbackImage(meal.name)} className="w-12 h-12 object-cover border border-accent/20 rounded-xl group-hover:border-accent/60 transition-all" alt="" />
                        <div>
                          <h3 className="font-black text-xs uppercase tracking-tight">{meal.name}</h3>
                          <p className="text-[9px] text-muted-foreground uppercase font-black">{meal.calories} KCAL | P: {meal.protein}G</p>
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" className="text-white/10 hover:text-destructive hover:bg-destructive/10" onClick={(e) => { e.stopPropagation(); deleteMeal(meal.id); }}><Trash2 size={14} /></Button>
                    </div>
                  )) : <div className="h-[1px] w-full bg-white/5" />}
                </div>
              </div>
            );
          })}
        </div>

        <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
          <DialogContent className="bg-black/95 border-accent/40 text-white rounded-[32px] p-0 overflow-hidden shadow-[0_0_80px_rgba(0,242,255,0.15)] max-w-sm">
            {selectedMeal && (
              <div className="relative">
                <DialogHeader>
                  <DialogTitle className="sr-only">Détails de l'aliment</DialogTitle>
                  <DialogDescription className="sr-only">Diagnostic moléculaire complet.</DialogDescription>
                </DialogHeader>
                <div className="h-60 w-full relative">
                  <img src={selectedMeal.imageUrl || getFallbackImage(selectedMeal.name)} className="w-full h-full object-cover contrast-125 brightness-90 border-b border-accent/20" alt="" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
                  <DialogClose className="absolute right-5 top-5 w-10 h-10 rounded-full bg-black/60 backdrop-blur-md border border-white/20 flex items-center justify-center text-white/80 hover:text-white transition-colors">
                    <X size={20} />
                  </DialogClose>
                </div>

                <div className="p-8 space-y-8">
                  <div className="space-y-2">
                    <p className="text-accent/60 text-[9px] font-black uppercase tracking-[0.5em] neon-text-blue">Diagnostic Moléculaire</p>
                    <h2 className="text-2xl font-black tracking-tighter uppercase neon-text-blue leading-none">{selectedMeal.name}</h2>
                  </div>

                  <div className="grid grid-cols-4 gap-3">
                    <div className="cyber-card-red p-4 flex flex-col items-center justify-center bg-black/40 border-destructive/20 rounded-2xl">
                      <Flame size={16} className="text-destructive mb-2" />
                      <span className="text-sm font-black text-white">{selectedMeal.calories}</span>
                      <span className="text-[7px] font-black text-muted-foreground uppercase">Kcal</span>
                    </div>
                    <div className="cyber-card-blue p-4 flex flex-col items-center justify-center bg-black/40 border-accent/20 rounded-2xl">
                      <Zap size={16} className="text-accent mb-2" />
                      <span className="text-sm font-black text-white">{selectedMeal.protein}g</span>
                      <span className="text-[7px] font-black text-muted-foreground uppercase">Prot</span>
                    </div>
                    <div className="cyber-card-yellow p-4 flex flex-col items-center justify-center bg-black/40 border-primary/20 rounded-2xl">
                      <Wheat size={16} className="text-primary mb-2" />
                      <span className="text-sm font-black text-white">{selectedMeal.carbs}g</span>
                      <span className="text-[7px] font-black text-muted-foreground uppercase">Gluc</span>
                    </div>
                    <div className="cyber-card-blue p-4 flex flex-col items-center justify-center bg-black/40 border-accent/20 rounded-2xl">
                      <Droplet size={16} className="text-accent mb-2" />
                      <span className="text-sm font-black text-white">{selectedMeal.fat}g</span>
                      <span className="text-[7px] font-black text-muted-foreground uppercase">Lipid</span>
                    </div>
                  </div>

                  <div className="space-y-6 pt-6 border-t border-white/10">
                    <div className="flex justify-between items-center">
                      <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-primary/70">Bio-Micro-Données</h3>
                      <Badge variant="outline" className="border-primary/20 text-[7px] px-2 py-0">SYNC_OK</Badge>
                    </div>
                    
                    {(!selectedMeal.vitamins || selectedMeal.vitamins === "Non répertorié") ? (
                      <div className="p-6 bg-orange-500/5 border border-orange-500/30 rounded-2xl flex flex-col items-center gap-5">
                        <div className="flex items-center gap-3 text-orange-500">
                          <AlertCircle size={18} />
                          <p className="text-[10px] font-black uppercase tracking-widest text-center">INTERFACE INCOMPLÈTE</p>
                        </div>
                        <Button onClick={repairBioData} disabled={aiEstimating} className="w-full border-orange-500 text-orange-500 bg-black/40 h-12 font-black text-[10px] tracking-widest hover:bg-orange-500/10">
                          {aiEstimating ? <Loader2 className="animate-spin mr-2" /> : <RefreshCw className="mr-2" />} RECONSTRUIRE ARCHIVE
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-5">
                        <div className="flex justify-between items-center p-4 bg-white/5 rounded-2xl border border-white/10">
                          <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Fibres</span>
                          <span className="text-sm font-black text-white">{selectedMeal.fiber || 0} g</span>
                        </div>
                        
                        <div className="space-y-3">
                          <span className="text-[10px] font-black text-accent/60 uppercase tracking-widest flex items-center gap-2 mb-2"><Zap size={12} className="text-accent" /> Vitamines</span>
                          <div className="flex flex-wrap gap-1">
                            {renderBadges(selectedMeal.vitamins) || <span className="text-[10px] text-white/40">Aucune donnée</span>}
                          </div>
                        </div>

                        <div className="space-y-3">
                          <span className="text-[10px] font-black text-primary/60 uppercase tracking-widest flex items-center gap-2 mb-2"><Zap size={12} className="text-primary" /> Sels Minéraux</span>
                          <div className="flex flex-wrap gap-1">
                            {renderBadges(selectedMeal.minerals) || <span className="text-[10px] text-white/40">Aucune donnée</span>}
                          </div>
                        </div>
                        
                        {selectedMeal.isAiEstimated && (
                          <div className="pt-4 border-t border-white/5 flex items-center justify-center gap-2">
                             <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                             <p className="text-[8px] font-black text-muted-foreground tracking-[0.3em] uppercase">Estimation IA Llama-4 Scout</p>
                          </div>
                        )}
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

