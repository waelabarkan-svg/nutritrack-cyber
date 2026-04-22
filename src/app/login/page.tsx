"use client"

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useFirestore, useAuth } from '@/firebase';
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
        router.push('/profile');
      } else {
        await signInWithEmailAndPassword(auth, email, password);
        router.push('/');
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Access Denied",
        description: error.message
      });
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-8 bg-black text-white">
      <div className="w-full max-w-sm space-y-16">
        <div className="text-center space-y-4">
          <h1 className="text-5xl font-black text-primary tracking-tighter uppercase neon-text-red">NutriTrack</h1>
          <div className="h-[1px] w-12 bg-primary/40 mx-auto" />
          <p className="text-[9px] font-black text-muted-foreground uppercase tracking-[0.6em]">Advanced Nutrition OS</p>
        </div>

        <form onSubmit={handleAuth} className="space-y-10">
          {isSignUp && (
            <div className="space-y-3">
              <Label className="text-[9px] uppercase font-black tracking-widest text-muted-foreground">Designation</Label>
              <Input 
                type="text" 
                className="bg-white/5 border-white/10 h-14 font-black uppercase" 
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
          )}
          <div className="space-y-3">
            <Label className="text-[9px] uppercase font-black tracking-widest text-muted-foreground">Email Vector</Label>
            <Input 
              type="email" 
              className="bg-white/5 border-white/10 h-14 font-black" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-3">
            <Label className="text-[9px] uppercase font-black tracking-widest text-muted-foreground">Access Key</Label>
            <Input 
              type="password" 
              className="bg-white/5 border-white/10 h-14 font-black" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <Button type="submit" className="w-full h-18 font-black text-lg tracking-[0.3em] border-primary neon-glow-red">
            {isSignUp ? 'INITIALIZE AGENT' : 'DECRYPT ACCESS'}
          </Button>
        </form>

        <div className="text-center">
          <button 
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-[10px] font-black text-muted-foreground hover:text-primary transition-colors uppercase tracking-[0.3em]"
          >
            {isSignUp ? 'Existing Agent Detected? Return' : 'New Agent? Request Authorization'}
          </button>
        </div>
      </div>
    </div>
  );
}