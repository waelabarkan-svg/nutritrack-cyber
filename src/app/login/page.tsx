
"use client"

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db } from '@/lib/firebase';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';

export default function LoginPage() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const router = useRouter();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isSignUp) {
        const res = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(res.user, { displayName: name });
        // Initialize default user record
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
        title: "Error",
        description: error.message
      });
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen px-6 bg-[#121814]">
      <Card className="w-full max-w-sm glass border-none">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-black text-primary">NutriTrack</CardTitle>
          <CardDescription className="text-muted-foreground">
            {isSignUp ? 'Create your health profile' : 'Welcome back to your health journey'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAuth} className="space-y-4">
            {isSignUp && (
              <div className="space-y-1">
                <Label htmlFor="name">Name</Label>
                <Input 
                  id="name" 
                  type="text" 
                  className="bg-secondary/50 border-none h-12" 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
            )}
            <div className="space-y-1">
              <Label htmlFor="email">Email</Label>
              <Input 
                id="email" 
                type="email" 
                className="bg-secondary/50 border-none h-12" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="password">Password</Label>
              <Input 
                id="password" 
                type="password" 
                className="bg-secondary/50 border-none h-12" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full h-12 font-bold text-lg mt-4">
              {isSignUp ? 'Sign Up' : 'Sign In'}
            </Button>
          </form>
          <div className="text-center mt-6">
            <button 
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
