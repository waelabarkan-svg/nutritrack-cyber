'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { initializeApp, getApps } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';

const firebaseConfig = {
  apiKey: 'AIzaSyA4qB0gN6V7L00JhutP1rwSiRLF9sTUXsU',
  authDomain: 'studio-7017378573-cff64.firebaseapp.com',
  projectId: 'studio-7017378573-cff64',
  storageBucket: 'studio-7017378573-cff64.firebasestorage.app',
  messagingSenderId: '328031842182',
  appId: '1:328031842182:web:508c94a3587a90eb464607'
};

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
        description: error.message
      });
    }
  };

  if (loading) return <div className="min-h-screen bg-black" />;

  return (
    <div className="flex flex-col items-center justify-center min-h-screen w-full bg-black text-white p-4 sm:p-8 selection:bg-accent/30 overflow-hidden">
      <div className="mb-12 sm:mb-16 text-center space-y-4 sm:space-y-6 animate-in fade-in slide-in-from-bottom-8 duration-1000">
        <h1 className="text-xl sm:text-2xl font-black text-accent tracking-[0.4em] sm:tracking-[0.6em] uppercase neon-text-blue">NutriTrack</h1>
        <div className="h-[2px] w-24 sm:w-32 bg-gradient-to-r from-transparent via-accent/60 to-transparent mx-auto shadow-[0_0_15px_rgba(0,242,255,0.6)]" />
        <p className="text-[8px] sm:text-[10px] font-black text-accent/50 uppercase tracking-[0.8em] sm:tracking-[1.2em]">Access Protocol</p>
      </div>

      <div className="w-full max-w-[400px] p-6 sm:p-10 bg-black/80 backdrop-blur-3xl border border-accent/30 shadow-[0_0_50px_-10px_rgba(0,242,255,0.4)] animate-in zoom-in-95 duration-700 relative rounded-[16px]">
        <form onSubmit={handleAuth} className="space-y-6 sm:space-y-8">
          {isSignUp && (
            <div className="space-y-2 sm:space-y-3">
              <Label className="text-[9px] sm:text-[10px] uppercase font-black tracking-widest text-muted-foreground ml-1">Agent Designation</Label>
              <Input 
                type="text" 
                className="bg-white/5 border-white/10 h-12 sm:h-14 font-black uppercase rounded-[8px] focus:border-accent/60 transition-all text-xs sm:text-sm tracking-widest text-white" 
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
          )}
          <div className="space-y-2 sm:space-y-3">
            <Label className="text-[9px] sm:text-[10px] uppercase font-black tracking-widest text-muted-foreground ml-1">Neural ID (Email)</Label>
            <Input 
              type="email" 
              className="bg-white/5 border-white/10 h-12 sm:h-14 font-black rounded-[8px] focus:border-accent/60 transition-all text-xs sm:text-sm tracking-widest text-white" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2 sm:space-y-3">
            <Label className="text-[9px] sm:text-[10px] uppercase font-black tracking-widest text-muted-foreground ml-1">Security Key</Label>
            <Input 
              type="password" 
              className="bg-white/5 border-white/10 h-12 sm:h-14 font-black rounded-[8px] focus:border-accent/60 transition-all text-xs sm:text-sm tracking-widest text-white" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <Button type="submit" className="w-full h-14 sm:h-16 font-black text-xs sm:text-sm tracking-[0.3em] sm:tracking-[0.5em] border-2 border-primary neon-glow-yellow bg-black hover:bg-primary/10 transition-all mt-4 sm:mt-8 rounded-[8px] group">
            <span className="group-hover:neon-text-yellow transition-all text-primary">
              {isSignUp ? 'INITIALIZE' : 'DECRYPT'}
            </span>
          </Button>
        </form>

        <div className="mt-8 sm:mt-12 text-center">
          <button 
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-[8px] sm:text-[10px] font-black text-muted-foreground hover:text-accent transition-colors uppercase tracking-[0.3em] sm:tracking-[0.5em] underline-offset-8 hover:underline"
          >
            {isSignUp ? 'Return to Portal' : 'Request Access'}
          </button>
        </div>
      </div>

      <div className="fixed bottom-8 sm:bottom-16 w-32 sm:w-48 h-[1px] bg-gradient-to-r from-transparent via-accent/30 to-transparent" />
    </div>
  );
}
