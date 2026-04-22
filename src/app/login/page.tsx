"use client"

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useFirestore, useAuth, useUser } from '@/firebase';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';

export default function LoginPage() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const router = useRouter();
  const db = useFirestore();
  const auth = useAuth();
  const { user, loading } = useUser();

  useEffect(() => {
    if (!loading && user) {
      router.push('/');
    }
  }, [user, loading, router]);

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
        toast({ title: "Identity Initialized", description: "Biometric link established." });
      } else {
        await signInWithEmailAndPassword(auth, email, password);
        toast({ title: "Access Granted", description: "Decryption successful." });
      }
      router.push('/');
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Access Denied",
        description: error.message
      });
    }
  };

  if (loading) return null;

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6 bg-black text-white">
      <div className="mb-10 text-center space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-1000">
        <h1 className="text-4xl font-black text-primary tracking-tighter uppercase neon-text-red">NutriTrack</h1>
        <div className="h-[1px] w-12 bg-gradient-to-r from-transparent via-primary to-transparent mx-auto" />
        <p className="text-[8px] font-black text-primary/40 uppercase tracking-[0.8em]">Core OS v2.0</p>
      </div>

      <div className="w-full max-w-sm p-8 rounded-[2rem] bg-black/60 backdrop-blur-2xl border border-primary/20 shadow-[0_20px_60px_rgba(255,0,0,0.2)] animate-in zoom-in-95 duration-700">
        <form onSubmit={handleAuth} className="space-y-8">
          {isSignUp && (
            <div className="space-y-3">
              <Label className="text-[9px] uppercase font-black tracking-widest text-muted-foreground ml-1">Designation</Label>
              <Input 
                type="text" 
                className="bg-white/5 border-white/10 h-14 font-black uppercase rounded-xl focus:border-primary/50 transition-all" 
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
          )}
          <div className="space-y-3">
            <Label className="text-[9px] uppercase font-black tracking-widest text-muted-foreground ml-1">Email Vector</Label>
            <Input 
              type="email" 
              className="bg-white/5 border-white/10 h-14 font-black rounded-xl focus:border-primary/50 transition-all" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-3">
            <Label className="text-[9px] uppercase font-black tracking-widest text-muted-foreground ml-1">Access Key</Label>
            <Input 
              type="password" 
              className="bg-white/5 border-white/10 h-14 font-black rounded-xl focus:border-primary/50 transition-all" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <Button type="submit" className="w-full h-16 font-black text-base tracking-[0.4em] border-primary neon-glow-red rounded-xl bg-black hover:bg-primary/5 transition-all">
            {isSignUp ? 'INITIALIZE' : 'DECRYPT'}
          </Button>
        </form>

        <div className="mt-8 text-center">
          <button 
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-[9px] font-black text-muted-foreground hover:text-primary transition-colors uppercase tracking-[0.4em]"
          >
            {isSignUp ? 'Return to Access' : 'Request Authorization'}
          </button>
        </div>
      </div>

      <div className="fixed bottom-12 w-24 h-[1px] bg-white/5" />
    </div>
  );
}
