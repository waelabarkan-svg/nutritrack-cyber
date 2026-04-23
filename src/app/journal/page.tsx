"use client"

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useFirestore, useCollection } from '@/firebase';
import { BottomNav } from '@/components/bottom-nav';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Label } from '@/components/ui/label';
import { Plus, Trash2, Search, Coffee, Utensils, Moon, Apple, Zap, Sparkles, Loader2, Camera, Upload, X, Check, AlertCircle, Scan } from 'lucide-react';
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
  const [isCustomOpen, setIsCustomOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  
  const [aiEstimating, setAiEstimating] = useState(false);
  const [aiResult, setAiResult] = useState<any>(null);
  const [scanningImage, setScanningImage] = useState<string | null>(null);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [customFood, setCustomFood] = useState({
    name: '',
    calories: '',
    protein: '',
    carbs: '',
    fat: ''
  });

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
      toast({ 
        variant: "destructive", 
        title: "ACCÈS CAMÉRA REFUSÉ", 
        description: "Veuillez autoriser l'accès à la caméra." 
      });
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
        const dataUri = event.target?.result as string;
        setScanningImage(dataUri);
      };
      reader.readAsDataURL(file);
    }
  };

  const runImageAnalysis = async () => {
    if (!scanningImage || aiEstimating) return;
    
    setAiEstimating(true);
    setAiResult(null);
    try {
      if (typeof window !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(50);
      const result = await scanDish({ photoDataUri: scanningImage });
      setAiResult(result);
      if (typeof window !== 'undefined' && 'vibrate' in navigator) navigator.vibrate([100, 50, 100]);
    } catch (e: any) {
      console.error('Scan error:', e);
      toast({ 
        variant: "destructive", 
        title: "ERREUR DE LECTURE OPTIQUE", 
        description: "Liaison saturée ou image illisible. Réessaie."
      });
    } finally {
      setAiEstimating(false);
    }
  };

  const handleAiEstimate = async () => {
    if (!searchTerm || searchTerm.length < 3 || aiEstimating) return;
    setAiEstimating(true);
    setAiResult(null);
    try {
      const result = await estimateDish({ dishName: searchTerm });
      setAiResult(result);
    } catch (e: any) {
      toast({ 
        variant: "destructive", 
        title: "ERREUR SYSTÈME", 
        description: "Liaison IA interrompue." 
      });
    } finally {
      setAiEstimating(false);
    }
  };

  const saveToBiometricMemory = (food: any, isScan = false) => {
    const history = JSON.parse(localStorage.getItem('biometric_memory') || '[]');
    const dateKey = new Date().toISOString().split('T')[0];
    
    const index = history.findIndex((item: any) => item.date === dateKey);
    if (index > -1) {
      history[index].calories += Number(food.calories);
      history[index].protein += Number(food.protein);
      if (isScan) history[index].scans = (history[index].scans || 0) + 1;
    } else {
      history.push({
        date: dateKey,
        calories: Number(food.calories),
        protein: Number(food.protein),
        scans: isScan ? 1 : 0
      });
    }
    
    const limitedHistory = history.slice(-180); // Garder 6 mois
    localStorage.setItem('biometric_memory', JSON.stringify(limitedHistory));
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

      // Toujours enregistrer en mémoire biométrique locale pour le graphique
      saveToBiometricMemory(food, isScan);

      // Gain d'XP si scan
      if (isScan) {
        const result = addXp(50);
        if (result?.leveledUp) {
          toast({
            title: "LEVEL UP!",
            description: `VOUS AVEZ ATTEINT LE NIVEAU ${result.level} !`,
            className: "bg-accent text-black font-black"
          });
        }
      }

      setSearchTerm('');
      setAiResult(null);
      setScanningImage(null);
      setIsScannerOpen(false);
      toast({ 
        title: "SYSTÈME MIS À JOUR", 
        description: "DONNÉES SYNCHRONISÉES." 
      });
    } catch (e) {
      toast({ variant: "destructive", title: "ERREUR", description: "Échec de l'enregistrement." });
    }
  };

  const addCustomMeal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !customFood.name || !customFood.calories) return;
    
    const food = {
      name: customFood.name.toUpperCase(),
      calories: parseInt(customFood.calories),
      protein: parseInt(customFood.protein || '0'),
      carbs: parseInt(customFood.carbs || '0'),
      fat: parseInt(customFood.fat || '0'),
    };

    try {
      await addDoc(collection(db, 'users', user.uid, 'meals'), {
        ...food,
        type: selectedType,
        date: today,
        createdAt: new Date().toISOString()
      });
      
      saveToBiometricMemory(food, false);

      setIsCustomOpen(false);
      setCustomFood({ name: '', calories: '', protein: '', carbs: '', fat: '' });
      toast({ title: "SAISIE VALIDÉE", description: "DONNÉES SYNCHRONISÉES." });
    } catch (e) {
      toast({ variant: "destructive", title: "ERREUR", description: "Échec de la saisie manuelle." });
    }
  };

  const deleteMeal = async (id: string) => {
    if (!user) return;
    deleteDoc(doc(db, 'users', user.uid, 'meals', id));
  };

  const mealSections: { type: MealType; label: string; icon: any }[] = [
    { type: 'petit-déjeuner', label: 'Protocole Petit-Déj', icon: Coffee },
    { type: 'déjeuner', label: 'Protocole Déjeuner', icon: Utensils },
    { type: 'dîner', label: 'Protocole Dîner', icon: Moon },
    { type: 'snack', label: 'Protocole Snack', icon: Apple },
  ];

  return (
    <TooltipProvider>
      <main className="px-4 sm:px-6 pt-12 sm:pt-16 max-w-md mx-auto pb-32 min-h-screen bg-black text-white">
        <div className="space-y-1 mb-8 sm:mb-12">
          <p className="text-primary/60 text-[8px] sm:text-[9px] font-black uppercase tracking-[0.5em] neon-text-yellow">Interface Log</p>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tighter uppercase neon-text-yellow">Journal de Bord</h1>
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
              
              <Dialog open={isScannerOpen} onOpenChange={(open) => {
                setIsScannerOpen(open);
                if (!open) {
                  stopCamera();
                  setScanningImage(null);
                  setAiResult(null);
                }
              }}>
                <DialogTrigger asChild>
                  <Button 
                    className="h-14 w-14 border-accent bg-black text-accent neon-glow-blue rounded-[12px]"
                    onClick={startCamera}
                  >
                    <Camera size={20} />
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-black border-accent/40 text-white rounded-[20px] max-w-[95vw] sm:max-w-md p-0 overflow-hidden">
                  <DialogHeader className="sr-only">
                    <DialogTitle>Scan Optique</DialogTitle>
                    <DialogDescription>Analyse de la composition moléculaire des aliments par vision artificielle.</DialogDescription>
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
                        {hasCameraPermission === false && (
                          <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center p-8 text-center gap-4">
                            <AlertCircle size={48} className="text-destructive" />
                            <p className="font-black text-xs uppercase tracking-widest">Accès caméra désactivé</p>
                            <Button onClick={startCamera} variant="outline" className="border-accent text-accent">Réessayer</Button>
                          </div>
                        )}
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
                               <p className="text-[12px] font-black tracking-[0.6em] text-accent uppercase animate-pulse neon-text-blue">SCAN EN COURS...</p>
                               <p className="text-[8px] font-black text-accent/60 uppercase tracking-widest">Liaison Neurale Établie (GROQ)</p>
                             </div>
                          </div>
                        )}

                        {!aiEstimating && !aiResult && (
                          <div className="absolute bottom-6 left-0 right-0 flex flex-col items-center gap-4 px-6">
                            <Button 
                              className="w-full h-14 bg-accent text-black font-black uppercase tracking-[0.2em] rounded-xl neon-glow-blue"
                              onClick={runImageAnalysis}
                            >
                              <Scan className="mr-2" size={20} />
                              Lancer l'Analyse
                            </Button>
                            <Button 
                              variant="outline" 
                              className="w-full border-white/20 text-[10px] font-black tracking-widest uppercase"
                              onClick={() => setScanningImage(null)}
                            >
                              Prendre une autre photo
                            </Button>
                          </div>
                        )}

                        {!aiEstimating && aiResult && (
                          <div className="absolute bottom-0 left-0 right-0 p-6 bg-black/90 backdrop-blur-xl border-t border-accent/40 animate-in slide-in-from-bottom-full duration-500">
                            <div className="flex justify-between items-start mb-4">
                              <div>
                                <span className="text-[8px] font-black text-accent uppercase tracking-[0.3em] block mb-1">ANALYSE OPTIQUE TERMINÉE</span>
                                <h3 className="text-xl font-black text-white uppercase tracking-tighter">{aiResult.name}</h3>
                              </div>
                              <Button className="border-accent neon-glow-blue h-12 w-12" onClick={() => addMeal(aiResult, true)}>
                                <Check size={24} />
                              </Button>
                            </div>
                            <div className="grid grid-cols-4 gap-2 mb-4">
                              <div className="text-center bg-white/5 p-2 rounded-lg">
                                <p className="text-[14px] font-black text-primary">{aiResult.calories}</p>
                                <p className="text-[7px] text-muted-foreground uppercase font-black">KCAL</p>
                              </div>
                              <div className="text-center bg-white/5 p-2 rounded-lg">
                                <p className="text-[14px] font-black text-white">{aiResult.protein}g</p>
                                <p className="text-[7px] text-muted-foreground uppercase font-black">PROT</p>
                              </div>
                              <div className="text-center bg-white/5 p-2 rounded-lg">
                                <p className="text-[14px] font-black text-white">{aiResult.carbs}g</p>
                                <p className="text-[7px] text-muted-foreground uppercase font-black">GLUC</p>
                              </div>
                              <div className="text-center bg-white/5 p-2 rounded-lg">
                                <p className="text-[14px] font-black text-white">{aiResult.fat}g</p>
                                <p className="text-[7px] text-muted-foreground uppercase font-black">LIPID</p>
                              </div>
                            </div>
                            
                            <div className="space-y-2 mb-4">
                              <p className="text-[9px] italic text-accent/80 font-black uppercase tracking-wider border-l-2 border-accent pl-2">
                                "{aiResult.aiAnalysis}"
                              </p>
                              {aiResult.healthAdvice && (
                                <p className="text-[10px] text-primary font-bold uppercase tracking-tight leading-tight">
                                  💡 {aiResult.healthAdvice}
                                </p>
                              )}
                            </div>

                            <Button variant="outline" className="w-full text-[10px] font-black tracking-widest" onClick={() => { setScanningImage(null); setAiResult(null); }}>RESCANNER</Button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <canvas ref={canvasRef} className="hidden" />
                </DialogContent>
              </Dialog>
            </div>

            <div className="flex gap-2">
              <Dialog open={isCustomOpen} onOpenChange={setIsCustomOpen}>
                <DialogTrigger asChild>
                  <Button className="h-14 flex-1 border-primary neon-glow-yellow bg-black rounded-[12px]">
                    <Plus size={20} className="mr-2" />
                    <span className="font-black text-[10px] tracking-widest uppercase">Custom +</span>
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-black border-primary/40 text-white rounded-[20px] max-w-[90vw] sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle className="text-xl font-black uppercase tracking-tighter neon-text-yellow">Saisie Manuelle</DialogTitle>
                    <DialogDescription className="sr-only">Entrez manuellement les informations nutritionnelles de votre aliment.</DialogDescription>
                  </DialogHeader>
                  <form onSubmit={addCustomMeal} className="space-y-4 pt-4">
                    <div className="space-y-2">
                      <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Désignation</Label>
                      <Input 
                        placeholder="EX: BARRE PROTÉINÉE" 
                        className="bg-white/5 border-white/10 font-black h-12"
                        value={customFood.name}
                        onChange={(e) => setCustomFood({...customFood, name: e.target.value})}
                        required
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Énergie (KCAL)</Label>
                        <Input 
                          type="number" 
                          className="bg-white/5 border-white/10 font-black h-12"
                          value={customFood.calories}
                          onChange={(e) => setCustomFood({...customFood, calories: e.target.value})}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Prot (G)</Label>
                        <Input 
                          type="number" 
                          className="bg-white/5 border-white/10 font-black h-12"
                          value={customFood.protein}
                          onChange={(e) => setCustomFood({...customFood, protein: e.target.value})}
                        />
                      </div>
                    </div>
                    <Button type="submit" className="w-full h-14 border-primary neon-glow-yellow mt-4">
                      VALIDER L'ARCHIVE
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {(filteredFood.length > 0 || searchTerm.length > 2) && (
            <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
              {filteredFood.map((food, idx) => (
                <div key={idx} className="cyber-card-yellow p-4 flex justify-between items-center bg-black/90 border-primary/40 rounded-[12px]">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="font-black text-xs tracking-wider uppercase">{food.name}</p>
                      {food.isDish && <span className="text-[7px] bg-primary/20 text-primary px-1 font-black rounded">PLAT</span>}
                    </div>
                    <p className="text-[9px] text-muted-foreground uppercase">{food.calories} KCAL | P: {food.protein}G | G: {food.carbs}G</p>
                  </div>
                  <Button 
                    size="icon" 
                    className="w-10 h-10 border-primary neon-glow-yellow"
                    onClick={() => addMeal(food)}
                  >
                    <Plus size={18} />
                  </Button>
                </div>
              ))}

              {!aiResult && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      onClick={handleAiEstimate}
                      disabled={aiEstimating}
                      className="w-full h-14 border-[#a855f7] bg-black/80 text-[#a855f7] shadow-[0_0_20px_rgba(168,85,247,0.3)] hover:bg-[#a855f7]/10"
                    >
                      {aiEstimating ? <Loader2 className="animate-spin mr-2" size={16} /> : <Sparkles className="mr-2" size={16} />}
                      <span className="font-black text-[10px] tracking-[0.2em] uppercase">
                        {aiEstimating ? "ANALYSE EN COURS..." : "ANALYSE SMART DISH [IA]"}
                      </span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent className="bg-black border-[#a855f7] text-[8px] p-2 max-w-[200px]">
                    ANALYSE TON PLAT COMPLEXE GRÂCE À L'IA POUR ESTIMER LES MACROS INVISIBLES.
                  </TooltipContent>
                </Tooltip>
              )}

              {aiResult && !scanningImage && (
                <div className="cyber-card-blue p-5 bg-black/90 border-[#a855f7] shadow-[0_0_30px_rgba(168,85,247,0.4)] rounded-[12px] animate-in zoom-in-95 duration-500">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <span className="text-[8px] font-black text-[#a855f7] uppercase tracking-[0.3em] block mb-1">ESTIMATION IA [EXPÉRIMENTAL]</span>
                      <h3 className="text-sm font-black text-white uppercase tracking-wider">{aiResult.name}</h3>
                    </div>
                    <Button 
                      size="icon" 
                      className="w-12 h-12 border-[#a855f7] bg-black text-[#a855f7] neon-glow-blue"
                      onClick={() => addMeal(aiResult, true)}
                    >
                      <Plus size={24} />
                    </Button>
                  </div>
                  <div className="grid grid-cols-4 gap-2 mb-4">
                    <div className="text-center">
                      <p className="text-[12px] font-black text-primary">{aiResult.calories}</p>
                      <p className="text-[7px] text-muted-foreground uppercase font-black">KCAL</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[12px] font-black text-white">{aiResult.protein}g</p>
                      <p className="text-[7px] text-muted-foreground uppercase font-black">PROT</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[12px] font-black text-white">{aiResult.carbs}g</p>
                      <p className="text-[7px] text-muted-foreground uppercase font-black">GLUC</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[12px] font-black text-white">{aiResult.fat}g</p>
                      <p className="text-[7px] text-muted-foreground uppercase font-black">LIPID</p>
                    </div>
                  </div>
                  <div className="space-y-2 border-t border-[#a855f7]/20 pt-2">
                    <p className="text-[9px] italic text-[#a855f7]/80 font-black uppercase tracking-wider">
                      "{aiResult.aiAnalysis}"
                    </p>
                    {aiResult.healthAdvice && (
                      <p className="text-[10px] text-primary font-bold uppercase tracking-tight">
                        💡 {aiResult.healthAdvice}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        <div className="space-y-12">
          {mealSections.map((section) => {
            const sectionMeals = (meals || []).filter((m: any) => m.type === section.type);
            const Icon = section.icon;
            return (
              <div key={section.type} className="space-y-4">
                <div className="flex items-center gap-3">
                  <Icon size={14} className="text-primary" />
                  <h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-primary/70">{section.label}</h2>
                </div>
                
                <div className="space-y-3">
                  {sectionMeals.length > 0 ? sectionMeals.map((meal: any) => (
                    <div key={meal.id} className="cyber-card-blue p-4 flex justify-between items-center bg-black/40 border-accent/20">
                      <div className="space-y-1">
                        <h3 className="font-black text-xs uppercase tracking-wider">{meal.name}</h3>
                        <div className="flex gap-3 text-[9px] font-black text-muted-foreground uppercase">
                          <span className="text-primary">{meal.calories} KCAL</span>
                          <span className="opacity-20">|</span>
                          <span>P: {meal.protein}G</span>
                          <span>G: {meal.carbs}G</span>
                        </div>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="text-white/10 hover:text-destructive hover:bg-destructive/5 border-none"
                        onClick={() => deleteMeal(meal.id)}
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  )) : (
                    <div className="h-[1px] w-full bg-white/5" />
                  )}
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
