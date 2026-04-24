
"use client"

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useFirestore, useCollection } from '@/firebase';
import { BottomNav } from '@/components/bottom-nav';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Plus, Trash2, Search, Camera, X, Check, Loader2, Volume2, VolumeX, Sparkles, Barcode, AlertCircle, RefreshCw, Flame, Zap, Wheat, Droplet, Coffee } from 'lucide-react';
import { collection, addDoc, query, where, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { toast } from '@/hooks/use-toast';
import foodDb from '@/lib/food-db.json';
import { estimateDish } from '@/ai/flows/estimate-dish-flow';
import { scanDish } from '@/ai/flows/scan-dish-flow';
import { addXp } from '@/lib/gamification-utils';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type MealType = 'petit-déjeuner' | 'déjeuner' | 'dîner' | 'snack' | 'boisson';

export default function JournalPage() {
  const { user, loading } = useUser();
  const db = useFirestore();
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');
  const [mealType, setMealType] = useState<MealType>('déjeuner');
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isBarcodeOpen, setIsBarcodeOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [selectedMeal, setSelectedMeal] = useState<any>(null);
  const [isMuted, setIsMuted] = useState(false);
  
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

  const globalSearchResults = useMemo(() => {
    if (!searchTerm || searchTerm.length < 2) return [];
    try {
      const searchLower = searchTerm.toLowerCase();
      const dbResults = foodDb.filter(f => f.name.toLowerCase().includes(searchLower));
      const memory = JSON.parse(localStorage.getItem('biometric_memory') || '[]');
      const memoryResults = memory
        .filter((h: any) => h.name?.toLowerCase().includes(searchLower))
        .map((h: any) => ({ ...h, isFromHistory: true }));

      const combined = [...memoryResults, ...dbResults];
      return Array.from(new Map(combined.map(item => [item.name.toUpperCase(), item])).values()).slice(0, 10);
    } catch (e) {
      return [];
    }
  }, [searchTerm]);

  const announceResults = (data: any) => {
    if (isMuted || typeof window === 'undefined' || !window.speechSynthesis) return;
    const formatValue = (val: any) => (val !== undefined && val !== null ? val : 'non détecté');
    const script = `Analyse terminée. Produit : ${data.name}. Apport énergétique : ${formatValue(data.calories)} calories. Protéines : ${formatValue(data.protein)} grammes. Lipides : ${formatValue(data.fat)} grammes. Glucides : ${formatValue(data.carbs)} grammes.`;
    
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
    } catch (e) {
      toast({ variant: "destructive", title: "DATA LINK OVERLOAD" });
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
        fiber: Number(food.fiber || 0),
        vitamins: food.vitamins || null,
        minerals: food.minerals || null,
        type: mealType,
        date: today,
        imageUrl: food.imageUrl || null,
        createdAt: new Date().toISOString(),
        isAiEstimated: isScan
      };
      await addDoc(collection(db, 'users', user.uid, 'meals'), mealData);
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

  const deleteMeal = async (id: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'meals', id));
      toast({ title: "DONNÉE EFFACÉE" });
    } catch (e) {
      toast({ variant: "destructive", title: "ERREUR SUPPRESSION" });
    }
  };

  const getFallbackImage = (name: string) => {
    const term = name.toLowerCase();
    return `https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&q=80&w=400&h=300&sig=${encodeURIComponent(term)}`;
  };

  return (
    <TooltipProvider>
      <main className="px-6 pt-16 max-w-md mx-auto pb-32 min-h-screen bg-black text-white selection:bg-primary/30">
        {/* HEADER CYBER-NEON */}
        <div className="flex justify-between items-start mb-12">
          <div className="space-y-1">
            <p className="text-primary/60 text-[9px] font-black uppercase tracking-[0.5em] neon-text-yellow">Interface Log</p>
            <h1 className="text-3xl font-black tracking-tighter uppercase neon-text-yellow">Journal de Bord</h1>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            className={cn(
              "w-10 h-10 rounded-full border transition-all duration-500",
              isMuted ? "border-destructive/30 text-destructive" : "border-accent/30 text-accent neon-glow-blue"
            )}
            onClick={() => { setIsMuted(!isMuted); window.speechSynthesis.cancel(); }}
          >
            {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </Button>
        </div>

        {/* REPAS TYPE SELECTOR */}
        <div className="flex gap-2 overflow-x-auto pb-4 scrollbar-hide mb-8">
          {['petit-déjeuner', 'déjeuner', 'dîner', 'snack'].map((type) => (
            <button 
              key={type} 
              onClick={() => setMealType(type as MealType)} 
              className={cn(
                "px-5 py-2.5 text-[10px] font-black uppercase tracking-widest transition-all duration-300 rounded-full whitespace-nowrap border",
                mealType === type 
                  ? "bg-primary text-black border-primary shadow-[0_0_15px_rgba(253,224,71,0.5)]" 
                  : "bg-black border-white/10 text-muted-foreground hover:border-primary/40"
              )}
            >
              {type}
            </button>
          ))}
        </div>

        {/* SEARCH & SCAN AREA */}
        <div className="flex gap-2 mb-12">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-primary/40" size={16} />
            <Input 
              className="bg-[#0a0a0a] border-white/10 h-12 pl-12 font-black uppercase text-[10px] tracking-[0.2em] rounded-xl focus:border-primary/60 transition-all placeholder:text-white/20" 
              placeholder="RECHERCHER..." 
              value={searchTerm} 
              onChange={(e) => setSearchTerm(e.target.value)} 
            />
          </div>
          <div className="flex gap-2">
            <Dialog open={isScannerOpen} onOpenChange={(o) => { setIsScannerOpen(o); if(o) setTimeout(startCamera,100); else stopCamera(); }}>
              <DialogTrigger asChild>
                <Button className="h-12 w-12 border border-accent/40 bg-black text-accent rounded-xl hover:shadow-[0_0_15px_rgba(0,242,255,0.3)] transition-all">
                  <Camera size={20} />
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-black border-accent/40 text-white rounded-[24px] p-0 overflow-hidden max-w-sm">
                <div className="relative h-[70vh]">
                  {!scanningImage ? (
                    <>
                      <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                      <div className="absolute bottom-10 left-0 right-0 flex justify-center">
                        <button className="w-20 h-20 rounded-full border-8 border-accent/30 bg-black/20 backdrop-blur-md flex items-center justify-center group" onClick={capturePhoto}>
                          <div className="w-12 h-12 rounded-full bg-accent group-active:scale-90 transition-transform" />
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="w-full h-full relative">
                      <img src={scanningImage} className="w-full h-full object-cover contrast-125" alt="" />
                      <div className="absolute bottom-0 left-0 right-0 p-8 bg-black/90 border-t border-accent/40 backdrop-blur-xl">
                        {aiEstimating ? (
                          <div className="flex flex-col items-center gap-4 py-8">
                            <Loader2 className="animate-spin text-accent" size={48} />
                            <p className="text-[12px] font-black tracking-[0.6em] text-accent uppercase animate-pulse">LIAISON NEURALE...</p>
                          </div>
                        ) : aiResult ? (
                          <>
                            <h3 className="text-xl font-black uppercase mb-6 tracking-tight text-accent neon-text-blue">{aiResult.name}</h3>
                            <div className="grid grid-cols-4 gap-4 mb-8">
                              <div className="text-center"><p className="text-sm font-black text-white">{aiResult.calories}</p><p className="text-[7px] text-muted-foreground uppercase font-black">KCAL</p></div>
                              <div className="text-center"><p className="text-sm font-black text-white">{aiResult.protein}g</p><p className="text-[7px] text-muted-foreground uppercase font-black">PROT</p></div>
                              <div className="text-center"><p className="text-sm font-black text-white">{aiResult.carbs}g</p><p className="text-[7px] text-muted-foreground uppercase font-black">GLUC</p></div>
                              <div className="text-center"><p className="text-sm font-black text-white">{aiResult.fat}g</p><p className="text-[7px] text-muted-foreground uppercase font-black">LIPID</p></div>
                            </div>
                            <Button className="w-full h-14 bg-accent text-black font-black neon-glow-blue rounded-xl" onClick={() => addMeal(aiResult, true)}>ARCHIVER DONNÉES</Button>
                          </>
                        ) : (
                          <div className="flex gap-2">
                            <Button variant="outline" className="flex-1 h-14 border-white/20 text-white font-black rounded-xl" onClick={() => setScanningImage(null)}>REPRENDRE</Button>
                            <Button className="flex-[2] h-14 bg-accent text-black font-black rounded-xl" onClick={runImageAnalysis}>ANALYSER</Button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </DialogContent>
            </Dialog>

            <Dialog open={isBarcodeOpen} onOpenChange={(o) => { setIsBarcodeOpen(o); if(o) startBarcodeScanner(); else if(barcodeScannerRef.current) barcodeScannerRef.current.clear(); }}>
              <DialogTrigger asChild>
                <Button className="h-12 w-12 border border-primary/40 bg-black text-primary rounded-xl hover:shadow-[0_0_15px_rgba(253,224,71,0.3)] transition-all">
                  <Barcode size={20} />
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-black border-primary/40 text-white rounded-[24px] p-6 max-w-sm">
                <div id="reader" className="w-full min-h-[300px] bg-black/50 border border-primary/20 rounded-2xl overflow-hidden" />
                {isFetchingBarcode && <div className="flex justify-center mt-6"><Loader2 className="animate-spin text-primary" /></div>}
                {barcodeResult && (
                  <div className="mt-8 p-6 border border-primary/40 bg-primary/5 rounded-2xl">
                    <h3 className="font-black uppercase mb-3 text-sm tracking-tight text-primary neon-text-yellow">{barcodeResult.name}</h3>
                    <div className="grid grid-cols-4 gap-2 text-center mb-6">
                      <div><p className="text-[11px] font-black">{barcodeResult.calories}</p><p className="text-[7px] text-muted-foreground font-black">KCAL</p></div>
                      <div><p className="text-[11px] font-black">{barcodeResult.protein}g</p><p className="text-[7px] text-muted-foreground font-black">PROT</p></div>
                      <div><p className="text-[11px] font-black">{barcodeResult.carbs}g</p><p className="text-[7px] text-muted-foreground font-black">GLUC</p></div>
                      <div><p className="text-[11px] font-black">{barcodeResult.fat}g</p><p className="text-[7px] text-muted-foreground font-black">LIPID</p></div>
                    </div>
                    <Button className="w-full h-12 bg-primary text-black font-black neon-glow-yellow rounded-xl" onClick={() => addMeal(barcodeResult, true)}>ARCHIVER PRODUIT</Button>
                  </div>
                )}
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* CONTENU PRINCIPAL (JOURNAL OU RECHERCHE) */}
        {searchTerm.length >= 2 ? (
          <div className="space-y-4">
            <h2 className="text-[10px] font-black text-primary/40 uppercase tracking-[0.4em] px-1 mb-6">Index des Archives</h2>
            {globalSearchResults.length === 0 ? (
              <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest text-center py-12 italic">Séquence non trouvée dans les archives</p>
            ) : (
              <div className="grid gap-3">
                {globalSearchResults.map((food: any, idx) => (
                  <div key={idx} className="flex justify-between items-center p-4 bg-accent/5 border border-accent/20 rounded-xl group hover:border-accent transition-all">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 border border-accent/20 flex items-center justify-center bg-black rounded-lg">
                        <Soup className="text-accent" size={16} />
                      </div>
                      <div>
                        <p className="font-black text-[11px] uppercase tracking-tight text-white">{food.name}</p>
                        <p className="text-[8px] text-muted-foreground font-black uppercase">{food.calories} KCAL | P: {food.protein}G</p>
                      </div>
                    </div>
                    <Button size="icon" className="w-10 h-10 border-accent/40 bg-transparent text-accent shadow-none hover:bg-accent/10" onClick={() => addMeal(food)}>
                      <Plus size={18} />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-12">
            {['petit-déjeuner', 'déjeuner', 'dîner', 'snack'].map((section) => {
              const sectionMeals = (meals as any)?.filter((m: any) => m.type === section) || [];
              return (
                <div key={section} className="space-y-4">
                  <div className="flex items-center gap-2 border-b border-white/10 pb-2 mb-4">
                    <div className="w-1 h-3 bg-primary" />
                    <h3 className="text-[10px] font-black text-primary uppercase tracking-[0.4em]">{section}</h3>
                  </div>
                  
                  {sectionMeals.length === 0 ? (
                    <p className="text-[8px] text-white/20 font-black uppercase tracking-widest italic py-2">Veuillez scanner ou rechercher un aliment</p>
                  ) : (
                    <div className="space-y-1">
                      {sectionMeals.map((meal: any) => (
                        <div key={meal.id} className="flex justify-between items-center py-3 border-b border-white/5 group hover:bg-white/[0.02] transition-all px-1">
                          <div className="flex items-center gap-3">
                            <p className="text-[10px] font-black uppercase tracking-tight text-white/90">{meal.name}</p>
                            {meal.isAiEstimated && <Badge variant="outline" className="text-[6px] border-accent/30 text-accent py-0 h-3">IA</Badge>}
                          </div>
                          <div className="flex items-center gap-4">
                            <span className="text-[11px] font-black text-[#00FFFF]">{meal.calories} <span className="text-[7px] text-white/40 ml-0.5">KCAL</span></span>
                            <button onClick={() => deleteMeal(meal.id)} className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive/40 hover:text-destructive">
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

        <BottomNav />
        <canvas ref={canvasRef} className="hidden" />
      </main>
    </TooltipProvider>
  );
}

function Soup(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 21a9 9 0 0 0 9-9H3a9 9 0 0 0 9 9Z" />
      <path d="M7 21h10" />
      <path d="M19 12v-2" />
      <path d="M5 12v-2" />
      <path d="M12 12V7" />
      <path d="M12 3v1" />
      <path d="M16 4v1" />
      <path d="M8 4v1" />
    </svg>
  )
}
