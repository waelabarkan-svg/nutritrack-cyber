"use client"

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useFirestore, useCollection } from '@/firebase';
import { BottomNav } from '@/components/bottom-nav';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Plus, Trash2, Search, Camera, Upload, X, Check, Loader2, Scan, Volume2, VolumeX, Sparkles } from 'lucide-react';
import { collection, addDoc, query, where, deleteDoc, doc } from 'firebase/firestore';
import { toast } from '@/hooks/use-toast';
import foodDb from '@/lib/food-db.json';
import { estimateDish } from '@/ai/flows/estimate-dish-flow';
import { scanDish } from '@/ai/flows/scan-dish-flow';
import { addXp } from '@/lib/gamification-utils';

type MealType = 'petit-déjeuner' | 'déjeuner' | 'dîner' | 'snack';

export default function JournalPage() {
  const { user, loading } = useUser();
  const db = useFirestore();
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<MealType>('petit-déjeuner');
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  
  const [aiEstimating, setAiEstimating] = useState(false);
  const [aiResult, setAiResult] = useState<any>(null);
  const [scanningImage, setScanningImage] = useState<string | null>(null);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const today = useMemo(() => new Date().toISOString().split('T')[0], []);

  const mealsQuery = useMemo(() => {
    if (!user) return null;
    return query(collection(db, 'users', user.uid, 'meals'), where('date', '==', today));
  }, [user, today, db]);

  const { data: meals } = useCollection(mealsQuery);

  const filteredFood = useMemo(() => {
    if (!searchTerm) return [];
    return foodDb
      .filter(f => f.name.toLowerCase().includes(searchTerm.toLowerCase()))
      .slice(0, 8);
  }, [searchTerm]);

  const speak = (text: string) => {
    if (isMuted || typeof window === 'undefined' || !window.speechSynthesis) return;
    
    window.speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'fr-FR';
    utterance.pitch = 0.7; // Tonalité grave SF
    utterance.rate = 0.9;  // Rythme calculé
    utterance.volume = 1;

    // Sélection de voix premium
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(v => 
      (v.lang.includes('fr')) && 
      (v.name.includes('Google') || v.name.includes('Neural') || v.name.includes('Female'))
    ) || voices.find(v => v.lang.includes('fr'));

    if (preferredVoice) utterance.voice = preferredVoice;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    
    window.speechSynthesis.speak(utterance);
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
      console.error('Error accessing camera:', err);
      setHasCameraPermission(false);
      toast({ variant: "destructive", title: "ACCÈS CAMÉRA REFUSÉ" });
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach(track => track.stop());
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

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setScanningImage(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const runImageAnalysis = async () => {
    if (!scanningImage || aiEstimating) return;
    setAiEstimating(true);
    setAiResult(null);
    try {
      const result = await scanDish({ photoDataUri: scanningImage });
      setAiResult(result);
      
      if (result.healthAdvice) {
        speak(result.healthAdvice);
      }
    } catch (e: any) {
      toast({ variant: "destructive", title: "DATA LINK OVERLOAD", description: "Échec de l'analyse optique." });
    } finally {
      setAiEstimating(false);
    }
  };

  const addMeal = async (food: any, isScan = false) => {
    if (!user) return;
    try {
      await addDoc(collection(db, 'users', user.uid, 'meals'), {
        name: food.name.toUpperCase(),
        calories: Number(food.calories),
        protein: Number(food.protein),
        carbs: Number(food.carbs),
        fat: Number(food.fat),
        type: selectedType,
        date: today,
        createdAt: new Date().toISOString()
      });

      if (isScan) {
        const res = addXp(50, 'scan');
        if (res && res.reason === 'limit_reached') {
          toast({ title: "LIMITE XP ATTEINTE", description: "Quota de scans journaliers saturé." });
        } else if (res?.leveledUp) {
          toast({ title: "LEVEL UP!", description: `NIVEAU ${res.level} ATTEINT !`, className: "bg-accent text-black font-black" });
        }
      }

      setSearchTerm('');
      setAiResult(null);
      setScanningImage(null);
      setIsScannerOpen(false);
      toast({ title: "SYSTÈME MIS À JOUR" });
    } catch (e) {
      toast({ variant: "destructive", title: "ERREUR SYNCHRO" });
    }
  };

  const handleAiEstimate = async () => {
    if (!searchTerm || searchTerm.length < 3 || aiEstimating) return;
    setAiEstimating(true);
    try {
      const result = await estimateDish({ dishName: searchTerm });
      setAiResult(result);
    } catch (e) {
      toast({ variant: "destructive", title: "ERREUR SYSTÈME" });
    } finally {
      setAiEstimating(false);
    }
  };

  const deleteMeal = async (id: string) => {
    if (!user) return;
    deleteDoc(doc(db, 'users', user.uid, 'meals', id));
  };

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
                <div className="eq-bar" />
                <div className="eq-bar" style={{ animationDelay: '0.1s' }} />
                <div className="eq-bar" style={{ animationDelay: '0.2s' }} />
                <div className="eq-bar" style={{ animationDelay: '0.3s' }} />
              </div>
            )}
            <Button 
              variant="ghost" 
              size="icon" 
              className={`w-10 h-10 border transition-all ${isMuted ? 'text-destructive border-destructive/20' : 'text-accent border-accent/20'}`}
              onClick={() => {
                const newState = !isMuted;
                setIsMuted(newState);
                if (newState) window.speechSynthesis.cancel();
              }}
            >
              {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </Button>
          </div>
        </div>

        <section className="mb-12 space-y-6">
          <div className="flex gap-2 mb-4 overflow-x-auto pb-2 scrollbar-hide">
            {['petit-déjeuner', 'déjeuner', 'dîner', 'snack'].map((type) => (
              <button
                key={type}
                onClick={() => setSelectedType(type as MealType)}
                className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest border rounded-full transition-all whitespace-nowrap ${
                  selectedType === type 
                  ? 'bg-primary text-black border-primary shadow-[0_0_15px_rgba(253,224,71,0.5)]' 
                  : 'border-white/10 text-muted-foreground'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
          
          <div className="flex flex-col gap-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-primary/40" size={18} />
                <Input 
                  className="bg-white/5 border-primary/20 h-14 pl-12 font-black uppercase tracking-widest focus:border-primary/60 transition-all rounded-[12px]" 
                  placeholder="RECHERCHER ALIMENT..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              
              <Dialog open={isScannerOpen} onOpenChange={(open) => { setIsScannerOpen(open); if (!open) { stopCamera(); setScanningImage(null); setAiResult(null); window.speechSynthesis.cancel(); }}}>
                <DialogTrigger asChild>
                  <Button className="h-14 w-14 border-accent bg-black text-accent neon-glow-blue rounded-[12px]" onClick={startCamera}>
                    <Camera size={20} />
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-black border-accent/40 text-white rounded-[20px] max-w-[95vw] sm:max-w-md p-0 overflow-hidden">
                  <DialogHeader className="sr-only">
                    <DialogTitle>Scan Optique</DialogTitle>
                    <DialogDescription>Analyse par Llama 4 Scout.</DialogDescription>
                  </DialogHeader>
                  <div className="relative h-[70vh] bg-black">
                    {!scanningImage ? (
                      <>
                        <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                        <div className="absolute inset-0 pointer-events-none border-[20px] border-black/40">
                          <div className="w-full h-full border border-accent/30 flex items-center justify-center">
                            <div className="w-48 h-48 border-2 border-dashed border-accent/50 rounded-2xl" />
                          </div>
                        </div>
                        <div className="absolute bottom-6 left-0 right-0 flex justify-around items-center px-10">
                           <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="image/*" className="hidden" />
                           <Button variant="ghost" className="text-white/40" onClick={() => fileInputRef.current?.click()}>
                              <Upload size={24} />
                           </Button>
                           <Button className="w-16 h-16 rounded-full border-4 border-accent bg-transparent" onClick={capturePhoto} />
                           <Button variant="ghost" className="text-white/40" onClick={() => setIsScannerOpen(false)}>
                              <X size={24} />
                           </Button>
                        </div>
                      </>
                    ) : (
                      <div className="w-full h-full relative">
                        <img src={scanningImage} className="w-full h-full object-cover" alt="Captured" />
                        
                        {aiEstimating && (
                          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm">
                             <div className="absolute top-0 left-0 w-full h-[2px] bg-accent shadow-[0_0_20px_rgba(0,242,255,1)] animate-[bounce_2s_infinite]" />
                             <div className="flex flex-col items-center justify-center h-full gap-4">
                               <Loader2 className="animate-spin text-accent" size={48} />
                               <p className="text-[12px] font-black tracking-[0.6em] text-accent uppercase animate-pulse neon-text-blue">LIAISON GROQ...</p>
                             </div>
                          </div>
                        )}

                        {!aiEstimating && !aiResult && (
                          <div className="absolute bottom-6 left-0 right-0 flex flex-col items-center gap-4 px-6">
                            <Button className="w-full h-14 bg-accent text-black font-black uppercase tracking-[0.2em] rounded-xl neon-glow-blue" onClick={runImageAnalysis}>
                              <Scan className="mr-2" size={20} />
                              Lancer l'Analyse
                            </Button>
                            <Button variant="outline" className="w-full border-white/20 text-[10px] font-black tracking-widest uppercase" onClick={() => setScanningImage(null)}>Prendre une autre photo</Button>
                          </div>
                        )}

                        {!aiEstimating && aiResult && (
                          <div className="absolute bottom-0 left-0 right-0 p-6 bg-black/90 backdrop-blur-xl border-t border-accent/40 animate-in slide-in-from-bottom-full duration-500">
                            <div className="flex justify-between items-start mb-4">
                              <div>
                                <span className="text-[8px] font-black text-accent uppercase tracking-[0.3em] block mb-1">ANALYSE OPTIQUE TERMINÉE</span>
                                <h3 className="text-xl font-black text-white uppercase tracking-tighter">{aiResult.name}</h3>
                                {aiResult.healthAdvice && (
                                  <p className="text-[10px] text-primary font-bold uppercase tracking-tight mt-1 flex items-center gap-1">
                                    <Sparkles size={10} className={isSpeaking ? "animate-pulse text-accent" : ""} /> {aiResult.healthAdvice}
                                  </p>
                                )}
                              </div>
                              <Button className="border-accent neon-glow-blue h-12 w-12" onClick={() => addMeal(aiResult, true)}>
                                <Check size={24} />
                              </Button>
                            </div>
                            <div className="grid grid-cols-4 gap-2 mb-4">
                              {[
                                { val: aiResult.calories, unit: 'KCAL', color: 'text-primary' },
                                { val: aiResult.protein + 'g', unit: 'PROT', color: 'text-white' },
                                { val: aiResult.carbs + 'g', unit: 'GLUC', color: 'text-white' },
                                { val: aiResult.fat + 'g', unit: 'LIPID', color: 'text-white' }
                              ].map((stat, i) => (
                                <div key={i} className="text-center bg-white/5 p-2 rounded-lg">
                                  <p className={`text-[14px] font-black ${stat.color}`}>{stat.val}</p>
                                  <p className="text-[7px] text-muted-foreground uppercase font-black">{stat.unit}</p>
                                </div>
                              ))}
                            </div>
                            <Button variant="outline" className="w-full text-[10px] font-black tracking-widest" onClick={() => { setScanningImage(null); setAiResult(null); window.speechSynthesis.cancel(); }}>RESCANNER</Button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <canvas ref={canvasRef} className="hidden" />
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {(filteredFood.length > 0 || searchTerm.length > 2) && (
            <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
              {filteredFood.map((food, idx) => (
                <div key={idx} className="cyber-card-yellow p-4 flex justify-between items-center bg-black/90 border-primary/40 rounded-[12px]">
                  <div className="space-y-1">
                    <p className="font-black text-xs tracking-wider uppercase">{food.name}</p>
                    <p className="text-[9px] text-muted-foreground uppercase">{food.calories} KCAL | P: {food.protein}G</p>
                  </div>
                  <Button size="icon" className="w-10 h-10 border-primary neon-glow-yellow" onClick={() => addMeal(food)}>
                    <Plus size={18} />
                  </Button>
                </div>
              ))}

              {!aiResult && searchTerm.length > 3 && (
                <Button onClick={handleAiEstimate} disabled={aiEstimating} className="w-full h-14 border-[#a855f7] bg-black/80 text-[#a855f7] shadow-[0_0_20px_rgba(168,85,247,0.3)]">
                  {aiEstimating ? <Loader2 className="animate-spin mr-2" size={16} /> : <Sparkles className="mr-2" size={16} />}
                  <span className="font-black text-[10px] tracking-[0.2em] uppercase">ANALYSE SMART DISH [IA]</span>
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
                <h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-primary/70">PROTOC {type.toUpperCase()}</h2>
                <div className="space-y-3">
                  {sectionMeals.length > 0 ? sectionMeals.map((meal: any) => (
                    <div key={meal.id} className="cyber-card-blue p-4 flex justify-between items-center bg-black/40 border-accent/20">
                      <div className="space-y-1">
                        <h3 className="font-black text-xs uppercase tracking-wider">{meal.name}</h3>
                        <p className="text-[9px] font-black text-muted-foreground uppercase">{meal.calories} KCAL | P: {meal.protein}G</p>
                      </div>
                      <Button variant="ghost" size="icon" className="text-white/10 hover:text-destructive" onClick={() => deleteMeal(meal.id)}><Trash2 size={14} /></Button>
                    </div>
                  )) : <div className="h-[1px] w-full bg-white/5" />}
                </div>
              </div>
            );
          })}
        </div>

        <BottomNav />
      </main>
    </TooltipProvider>
  );
}
