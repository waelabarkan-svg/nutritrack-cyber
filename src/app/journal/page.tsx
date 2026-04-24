
"use client"

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useFirestore, useCollection } from '@/firebase';
import { BottomNav } from '@/components/bottom-nav';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Plus, Trash2, Search, Camera, X, Check, Loader2, Volume2, VolumeX, Sparkles, Barcode, AlertCircle, RefreshCw, Flame, Zap, Wheat, Droplet, Soup, Beer, AlertTriangle, Coffee, Info } from 'lucide-react';
import { collection, addDoc, query, where, deleteDoc, doc, updateDoc, getDoc, setDoc } from 'firebase/firestore';
import { toast } from '@/hooks/use-toast';
import { scanDish } from '@/ai/flows/scan-dish-flow';
import { estimateDish } from '@/ai/flows/estimate-dish-flow';
import { addXp } from '@/lib/gamification-utils';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type MealType = 'petit-déjeuner' | 'déjeuner' | 'dîner' | 'snack';

export default function JournalPage() {
  const { user, loading } = useUser();
  const db = useFirestore();
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<MealType>('petit-déjeuner');
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [selectedMeal, setSelectedMeal] = useState<any>(null);
  const [isMuted, setIsMuted] = useState(false);
  
  const [aiEstimating, setAiEstimating] = useState(false);
  const [aiResult, setAiResult] = useState<any>(null);
  const [scanningImage, setScanningImage] = useState<string | null>(null);
  const [isReconstructing, setIsReconstructing] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const today = useMemo(() => new Date().toISOString().split('T')[0], []);

  const mealsQuery = useMemo(() => {
    if (!user) return null;
    return query(collection(db, 'users', user.uid, 'meals'), where('date', '==', today));
  }, [user, today, db]);

  const { data: meals } = useCollection(mealsQuery);

  // RECHERCHE GLOBALE : Parcourt l'intégralité du localStorage
  const globalSearchResults = useMemo(() => {
    if (!searchTerm || typeof window === 'undefined') return [];
    const localHistory = JSON.parse(localStorage.getItem('biometric_memory') || '[]');
    return localHistory.filter((item: any) => 
      item.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
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
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch (err) {
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

  const runImageAnalysis = async () => {
    if (!scanningImage || aiEstimating) return;
    setAiEstimating(true);
    try {
      const result = await scanDish({ photoDataUri: scanningImage });
      const enrichedResult = { ...result, imageUrl: scanningImage };
      setAiResult(enrichedResult);
      announceResults(enrichedResult);
    } catch (e) {
      toast({ variant: "destructive", title: "LIAISON ÉCHOUÉE" });
    } finally {
      setAiEstimating(false);
    }
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
        sugar: Number(food.sugar || 0),
        caffeine: Number(food.caffeine || 0),
        fiber: Number(food.fiber || 0),
        isLiquid: !!food.isLiquid,
        unit: food.unit || (food.isLiquid ? 'ml' : 'g'),
        vitamins: food.vitamins || null,
        minerals: food.minerals || null,
        additives: food.additives || null,
        type: selectedType,
        date: today,
        imageUrl: food.imageUrl || null,
        createdAt: new Date().toISOString(),
        isAiEstimated: isScan
      };

      await addDoc(collection(db, 'users', user.uid, 'meals'), mealData);
      
      const history = JSON.parse(localStorage.getItem('biometric_memory') || '[]');
      history.push({ ...mealData, id: Date.now().toString() });
      localStorage.setItem('biometric_memory', JSON.stringify(history));

      if (food.isLiquid) {
        const rate = food.hydrationRate || 1.0;
        const hydRef = doc(db, 'users', user.uid, 'hydration', today);
        const hydSnap = await getDoc(hydRef);
        const currentAmount = hydSnap.exists() ? hydSnap.data().amount : 0;
        await setDoc(hydRef, { amount: currentAmount + rate }, { merge: true });
      }

      if (isScan) addXp(50, 'scan');
      setAiResult(null);
      setScanningImage(null);
      setIsScannerOpen(false);
      setSearchTerm('');
      toast({ title: "SYSTÈME MIS À JOUR" });
    } catch (e) {
      toast({ variant: "destructive", title: "ERREUR SYNCHRO" });
    }
  };

  const deleteMeal = async (id: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'meals', id));
      toast({ title: "DONNÉE PURGÉE" });
    } catch (e) {
      toast({ variant: "destructive", title: "ERREUR PURGE" });
    }
  };

  const handleReconstruct = async () => {
    if (!selectedMeal || isReconstructing) return;
    setIsReconstructing(true);
    try {
      const result = await estimateDish({ dishName: selectedMeal.name });
      const updatedMeal = {
        ...selectedMeal,
        vitamins: result.vitamins,
        minerals: result.minerals,
        fiber: result.fiber,
        aiAnalysis: result.aiAnalysis,
        healthAdvice: result.healthAdvice,
        isAiEstimated: true
      };
      
      if (user) {
        const mealRef = doc(db, 'users', user.uid, 'meals', selectedMeal.id);
        await updateDoc(mealRef, updatedMeal);
      }
      
      setSelectedMeal(updatedMeal);
      toast({ title: "BIO-RÉPARATION TERMINÉE" });
    } catch (e) {
      toast({ variant: "destructive", title: "ERREUR RECONSTRUCTION" });
    } finally {
      setIsReconstructing(false);
    }
  };

  const openDetails = (meal: any) => {
    setSelectedMeal(meal);
    setIsDetailsOpen(true);
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

  const getFallbackImage = (name: string) => {
    const term = name.toLowerCase();
    let keywords = "food";
    if (term.includes('poulet')) keywords = "meat,chicken,grilled";
    else if (term.includes('boeuf')) keywords = "meat,beef,steak";
    else if (term.includes('burger')) keywords = "burger,fastfood";
    else if (term.includes('riz')) keywords = "rice,bowl";
    return `https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&q=80&w=400&h=300&sig=${encodeURIComponent(term)}`;
  };

  return (
    <TooltipProvider>
      <main className="px-4 sm:px-6 pt-12 sm:pt-16 max-w-md mx-auto pb-32 min-h-screen bg-black text-white">
        <div className="flex justify-between items-start mb-12">
          <div className="space-y-1">
            <p className="text-primary/60 text-[9px] font-black uppercase tracking-[0.5em] neon-text-yellow">Interface Log</p>
            <h1 className="text-3xl font-black tracking-tighter uppercase neon-text-yellow">Journal de Bord</h1>
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
              <Input 
                className="bg-white/5 border-primary/20 h-14 pl-12 font-black uppercase rounded-[12px] focus:ring-primary/40" 
                placeholder="RECHERCHER..." 
                value={searchTerm} 
                onChange={(e) => setSearchTerm(e.target.value)} 
              />
            </div>
            <Dialog open={isScannerOpen} onOpenChange={(o) => { setIsScannerOpen(o); if(o) setTimeout(startCamera,100); else stopCamera(); }}>
              <DialogTrigger asChild><Button className="h-14 w-14 border-accent text-accent rounded-[12px]"><Camera size={20} /></Button></DialogTrigger>
              <DialogContent className="bg-black border-accent/40 text-white rounded-[24px] p-0 overflow-hidden max-w-sm">
                <DialogHeader>
                  <DialogTitle className="sr-only">Scanner Optique</DialogTitle>
                  <DialogDescription className="sr-only">Analyse moléculaire en temps réel via Llama 4 Scout.</DialogDescription>
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
                        <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center gap-4">
                          <Loader2 className="animate-spin text-accent" size={48} />
                          <p className="text-[12px] font-black tracking-[0.6em] text-accent uppercase animate-pulse">LIAISON NEURALE...</p>
                        </div>
                      ) : aiResult ? (
                        <div className="absolute bottom-0 left-0 right-0 p-8 bg-black/90 border-t border-accent/40 backdrop-blur-xl">
                          <h3 className="text-xl font-black uppercase text-accent neon-text-blue mb-4">{aiResult.name}</h3>
                          <div className="grid grid-cols-4 gap-4 mb-6">
                            <div className="text-center"><p className="text-sm font-black text-white">{aiResult.calories}</p><p className="text-[7px] text-muted-foreground uppercase font-black">KCAL</p></div>
                            <div className="text-center"><p className="text-sm font-black text-white">{aiResult.protein}g</p><p className="text-[7px] text-muted-foreground uppercase font-black">PROT</p></div>
                            <div className="text-center"><p className="text-sm font-black text-white">{aiResult.carbs}g</p><p className="text-[7px] text-muted-foreground uppercase font-black">GLUC</p></div>
                            <div className="text-center"><p className="text-sm font-black text-white">{aiResult.sugar}g</p><p className="text-[7px] text-muted-foreground uppercase font-black">SUCRE</p></div>
                          </div>
                          <Button className="w-full h-14 bg-accent text-black font-black rounded-xl" onClick={() => addMeal(aiResult, true)}>ARCHIVER DONNÉES</Button>
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
          </div>
        </section>

        <div className="space-y-12">
          {searchTerm ? (
            <div className="space-y-4">
              <h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-accent border-l-2 border-accent pl-3">RÉSULTATS DE RECHERCHE</h2>
              <div className="space-y-3">
                {globalSearchResults.length > 0 ? globalSearchResults.map((meal: any) => (
                  <div key={meal.id} onClick={() => openDetails(meal)} className="cyber-card-blue p-4 flex justify-between items-center cursor-pointer hover:border-accent group transition-all">
                    <div className="flex items-center gap-4">
                      <img 
                        src={meal.imageUrl || getFallbackImage(meal.name)} 
                        className="w-12 h-12 object-cover border border-accent/20 rounded-xl group-hover:border-accent/60 transition-all" 
                        alt="" 
                      />
                      <div>
                        <div className="flex items-center gap-2">
                           {meal.isLiquid ? <Droplet size={10} className="text-accent" /> : <Soup size={10} className="text-primary" />}
                           <h3 className="font-black text-xs uppercase tracking-tight">{meal.name}</h3>
                        </div>
                        <p className="text-[9px] text-muted-foreground uppercase font-black">{meal.calories} KCAL | {meal.date}</p>
                      </div>
                    </div>
                  </div>
                )) : (
                  <div className="p-12 text-center border border-dashed border-white/10 rounded-2xl">
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.4em]">AUCUNE ARCHIVE CORRESPONDANTE DANS LA BASE</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            ['petit-déjeuner', 'déjeuner', 'dîner', 'snack'].map((type) => {
              const sectionMeals = (meals || []).filter((m: any) => m.type === type);

              return (
                <div key={type} className="space-y-4">
                  <h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-primary/70 border-l-2 border-primary pl-3">{type.toUpperCase()}</h2>
                  <div className="space-y-3">
                    {sectionMeals.length > 0 ? sectionMeals.map((meal: any) => (
                      <div key={meal.id} onClick={() => openDetails(meal)} className="cyber-card-blue p-4 flex justify-between items-center cursor-pointer hover:border-accent group transition-all">
                        <div className="flex items-center gap-4">
                          <img 
                            src={meal.imageUrl || getFallbackImage(meal.name)} 
                            className="w-12 h-12 object-cover border border-accent/20 rounded-xl group-hover:border-accent/60 transition-all" 
                            alt="" 
                          />
                          <div>
                            <div className="flex items-center gap-2">
                               {meal.isLiquid ? <Droplet size={10} className="text-accent" /> : <Soup size={10} className="text-primary" />}
                               <h3 className="font-black text-xs uppercase tracking-tight">{meal.name}</h3>
                            </div>
                            <p className="text-[9px] text-muted-foreground uppercase font-black">{meal.calories} KCAL | {meal.sugar || 0}g SUCRE</p>
                          </div>
                        </div>
                        <Button variant="ghost" size="icon" className="text-white/10 hover:text-destructive hover:bg-destructive/10" onClick={(e) => { e.stopPropagation(); deleteMeal(meal.id); }}><Trash2 size={14} /></Button>
                      </div>
                    )) : <div className="h-[1px] w-full bg-white/5" />}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
          <DialogContent className="bg-black/95 border-accent/40 text-white rounded-[32px] p-0 overflow-hidden shadow-[0_0_80px_rgba(0,242,255,0.15)] max-w-sm">
            {selectedMeal && (
              <div className="relative">
                <DialogHeader>
                  <DialogTitle className="sr-only">Détails de l'aliment</DialogTitle>
                  <DialogDescription className="sr-only">Diagnostic moléculaire complet et micro-données.</DialogDescription>
                </DialogHeader>
                <div className="h-60 w-full relative">
                  <img src={selectedMeal.imageUrl || getFallbackImage(selectedMeal.name)} className="w-full h-full object-cover contrast-125 brightness-90 border-b border-accent/20" alt="" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
                  <DialogClose className="absolute right-5 top-5 w-10 h-10 rounded-full bg-black/60 backdrop-blur-md border border-white/20 flex items-center justify-center text-white/80">
                    <X size={20} />
                  </DialogClose>
                </div>

                <div className="p-8 space-y-8">
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      {selectedMeal.isLiquid ? <Droplet className="text-accent" size={16} /> : <Soup className="text-primary" size={16} />}
                      <p className="text-accent/60 text-[9px] font-black uppercase tracking-[0.5em] neon-text-blue">Diagnostic Moléculaire</p>
                    </div>
                    <h2 className="text-2xl font-black tracking-tighter uppercase neon-text-blue leading-none">{selectedMeal.name}</h2>
                  </div>

                  {(!selectedMeal.vitamins && !selectedMeal.minerals) ? (
                    <div className="bg-orange-500/10 border border-orange-500/40 p-4 rounded-xl space-y-3">
                      <div className="flex items-center gap-2 text-orange-500">
                        <AlertCircle size={14} />
                        <span className="text-[9px] font-black uppercase tracking-widest">Archive Incomplète</span>
                      </div>
                      <Button 
                        onClick={handleReconstruct} 
                        disabled={isReconstructing}
                        className="w-full h-10 bg-orange-500 text-black font-black text-[9px] tracking-widest hover:bg-orange-600 transition-all rounded-lg"
                      >
                        {isReconstructing ? <Loader2 className="animate-spin" size={14} /> : "RECONSTRUIRE BIO-DONNÉES"}
                      </Button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-4 gap-3">
                      <div className="cyber-card-red p-4 flex flex-col items-center justify-center bg-black/40 border-destructive/20 rounded-2xl text-center">
                        <Flame size={16} className="text-destructive mb-2" />
                        <span className="text-sm font-black text-white">{selectedMeal.calories}</span>
                        <span className="text-[7px] font-black text-muted-foreground uppercase">Kcal</span>
                      </div>
                      <div className="cyber-card-blue p-4 flex flex-col items-center justify-center bg-black/40 border-accent/20 rounded-2xl text-center">
                        <Zap size={16} className="text-accent mb-2" />
                        <span className="text-sm font-black text-white">{selectedMeal.protein}g</span>
                        <span className="text-[7px] font-black text-muted-foreground uppercase">Prot</span>
                      </div>
                      <div className="cyber-card-yellow p-4 flex flex-col items-center justify-center bg-black/40 border-primary/20 rounded-2xl text-center">
                        <Wheat size={16} className="text-primary mb-2" />
                        <span className="text-sm font-black text-white">{selectedMeal.sugar || 0}g</span>
                        <span className="text-[7px] font-black text-muted-foreground uppercase">Sucre</span>
                      </div>
                      <div className="cyber-card-blue p-4 flex flex-col items-center justify-center bg-black/40 border-accent/20 rounded-2xl text-center">
                        {selectedMeal.isLiquid ? <Coffee size={16} className="text-accent mb-2" /> : <Droplet size={16} className="text-accent mb-2" />}
                        <span className="text-sm font-black text-white">{selectedMeal.isLiquid ? selectedMeal.caffeine || 0 : selectedMeal.fat || 0}</span>
                        <span className="text-[7px] font-black text-muted-foreground uppercase">{selectedMeal.isLiquid ? 'mg' : 'g Fat'}</span>
                      </div>
                    </div>
                  )}

                  <div className="space-y-6 pt-6 border-t border-white/10">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-primary/70">Bio-Micro-Données</h3>
                    <div className="space-y-5">
                      <div className="space-y-3">
                        <span className="text-[10px] font-black text-accent/60 uppercase tracking-widest flex items-center gap-2 mb-2"><Zap size={12} className="text-accent" /> Vitamines / Minéraux</span>
                        <div className="flex flex-wrap gap-1">
                          {renderBadges(selectedMeal.vitamins)}
                          {renderBadges(selectedMeal.minerals)}
                        </div>
                      </div>
                      <div className="flex justify-between items-center text-[10px] font-black text-muted-foreground">
                        <span className="uppercase tracking-widest">Source de données :</span>
                        <span className="text-primary neon-text-yellow">{selectedMeal.isAiEstimated ? "ESTIMATION IA" : "CERTIFIÉ INDUSTRIEL"}</span>
                      </div>
                    </div>
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
