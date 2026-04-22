"use client"

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { initializeApp, getApps } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';

// Config forcée en dur pour éliminer le bug "api-key-not-valid"
const firebaseConfig = {
  apiKey: 'AIzaSyA4qB0gN6V7L00JhutP1rwSiRLF9sTUXsU',
  authDomain: 'studio-7017378573-cff64.firebaseapp.com',
  projectId: 'studio-7017378573-cff64',
  storageBucket: 'studio-7017378573-cff64.firebasestorage.app',
  messagingSenderId: '328031842182',
  appId: '1:328031842182:web:508c94a3587a90eb464607'
};

// Initialisation sécurisée locale à la page pour bypasser les erreurs globales
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const auth = getAuth(app);
const db = getFirestore(app);

export default function LoginPage() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        router.push('/');
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [router]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isSignUp) {
        const res = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(res.user, { displayName: name });
        await setDoc(doc(db, 'users', res.user.uid), {
          name,
          email,
          createdAt: new Date().toISOString()
        });
        toast({ title: "IDENTITY INITIALIZED", description: "Biometric link established." });
      } else {
        await signInWithEmailAndPassword(auth, email, password);
        toast({ title: "ACCESS GRANTED", description: "Decryption successful." });
      }
      router.push('/');
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "ACCESS DENIED",
        description: error.message || "Credential validation failed."
      });
    }
  };

  if (loading) return <div className="min-h-screen bg-black" />;

  return (
    <div className="flex flex-col items-center justify-center min-h-screen w-full bg-black text-white p-6 selection:bg-primary/30">
      {/* NutriTrack Title Floating Above */}
      <div className="mb-12 text-center space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-1000">
        <h1 className="text-xl font-black text-primary tracking-[0.5em] uppercase neon-text-red">NutriTrack</h1>
        <div className="h-[1px] w-24 bg-gradient-to-r from-transparent via-primary/50 to-transparent mx-auto" />
        <p className="text-[8px] font-black text-primary/40 uppercase tracking-[1em]">Secure Access Protocol</p>
      </div>

      {/* Floating Glassmorphism Card */}
      <div className="w-full max-w-[400px] p-10 bg-black/60 backdrop-blur-2xl border border-primary/20 shadow-[0_0_40px_-5px_rgba(255,0,0,0.4)] animate-in zoom-in-95 duration-700 relative rounded-[16px]">
        <form onSubmit={handleAuth} className="space-y-8">
          {isSignUp && (
            <div className="space-y-3">
              <Label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground ml-1">Designation</Label>
              <Input 
                type="text" 
                className="bg-black/40 border-white/10 h-14 font-black uppercase rounded-[8px] focus:border-primary/50 transition-all text-sm tracking-widest" 
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
          )}
          <div className="space-y-3">
            <Label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground ml-1">Email Vector</Label>
            <Input 
              type="email" 
              className="bg-black/40 border-white/10 h-14 font-black rounded-[8px] focus:border-primary/50 transition-all text-sm tracking-widest" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-3">
            <Label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground ml-1">Access Key</Label>
            <Input 
              type="password" 
              className="bg-black/40 border-white/10 h-14 font-black rounded-[8px] focus:border-primary/50 transition-all text-sm tracking-widest" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <Button type="submit" className="w-full h-16 font-black text-sm tracking-[0.4em] border-primary neon-glow-red bg-black hover:bg-primary/10 transition-all mt-6 rounded-[8px] border group">
            <span className="group-hover:neon-text-red transition-all">
              {isSignUp ? 'INITIALIZE' : 'DECRYPT'}
            </span>
          </Button>
        </form>

        <div className="mt-10 text-center">
          <button 
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-[9px] font-black text-muted-foreground hover:text-primary transition-colors uppercase tracking-[0.4em] underline-offset-8 hover:underline"
          >
            {isSignUp ? 'Return to Access Gate' : 'Request Authorization'}
          </button>
        </div>
      </div>

      {/* Finishing laser line at bottom */}
      <div className="fixed bottom-12 w-32 h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent" />
    </div>
  );
}