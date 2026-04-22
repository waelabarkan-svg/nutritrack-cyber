
"use client"

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth-provider';
import { BottomNav } from '@/components/bottom-nav';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { toast } from '@/hooks/use-toast';
import { UserStats } from '@/lib/nutrition-utils';

export default function ProfilePage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<UserStats>({
    gender: 'male',
    age: 25,
    height: 175,
    weight: 70,
    targetWeight: 70,
    activityLevel: 'moderate',
    goal: 'maintain'
  });

  useEffect(() => {
    if (!loading && !user) router.push('/login');
    if (user) {
      const fetchStats = async () => {
        const docRef = doc(db, 'users', user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists() && docSnap.data().weight) {
          setStats(docSnap.data() as UserStats);
        }
      };
      fetchStats();
    }
  }, [user, loading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      await setDoc(doc(db, 'users', user.uid), stats, { merge: true });
      toast({ title: "Success", description: "Profile updated successfully!" });
      router.push('/');
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    }
  };

  if (loading || !user) return null;

  return (
    <main className="px-6 pt-12 max-w-md mx-auto pb-32">
      <h1 className="text-3xl font-black mb-8">Personal Stats</h1>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Gender</Label>
            <Select 
              value={stats.gender} 
              onValueChange={(v: any) => setStats({...stats, gender: v})}
            >
              <SelectTrigger className="bg-secondary/50 border-none h-12">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="male">Male</SelectItem>
                <SelectItem value="female">Female</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Age</Label>
            <Input 
              type="number" 
              className="bg-secondary/50 border-none h-12" 
              value={stats.age}
              onChange={(e) => setStats({...stats, age: parseInt(e.target.value)})}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Height (cm)</Label>
            <Input 
              type="number" 
              className="bg-secondary/50 border-none h-12" 
              value={stats.height}
              onChange={(e) => setStats({...stats, height: parseInt(e.target.value)})}
            />
          </div>
          <div className="space-y-2">
            <Label>Current Weight (kg)</Label>
            <Input 
              type="number" 
              className="bg-secondary/50 border-none h-12" 
              value={stats.weight}
              onChange={(e) => setStats({...stats, weight: parseInt(e.target.value)})}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Target Weight (kg)</Label>
          <Input 
            type="number" 
            className="bg-secondary/50 border-none h-12" 
            value={stats.targetWeight}
            onChange={(e) => setStats({...stats, targetWeight: parseInt(e.target.value)})}
          />
        </div>

        <div className="space-y-2">
          <Label>Activity Level</Label>
          <Select 
            value={stats.activityLevel} 
            onValueChange={(v: any) => setStats({...stats, activityLevel: v})}
          >
            <SelectTrigger className="bg-secondary/50 border-none h-12">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="sedentary">Sedentary (No exercise)</SelectItem>
              <SelectItem value="light">Light (1-3 days/week)</SelectItem>
              <SelectItem value="moderate">Moderate (3-5 days/week)</SelectItem>
              <SelectItem value="active">Active (6-7 days/week)</SelectItem>
              <SelectItem value="very_active">Very Active (Twice a day)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Your Goal</Label>
          <Select 
            value={stats.goal} 
            onValueChange={(v: any) => setStats({...stats, goal: v})}
          >
            <SelectTrigger className="bg-secondary/50 border-none h-12">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="lose">Weight Loss</SelectItem>
              <SelectItem value="maintain">Maintenance</SelectItem>
              <SelectItem value="gain">Weight Gain</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button type="submit" className="w-full h-14 font-bold text-lg rounded-2xl">
          Save Profile
        </Button>
      </form>

      <BottomNav />
    </main>
  );
}
