"use client"

import React, { useState, useEffect, useMemo } from 'react';
import { Sparkles, AlertTriangle, Zap } from 'lucide-react';
import { getCoachFeedback, CoachFeedbackOutput } from '@/ai/flows/coach-feedback-flow';
import { UserStats } from '@/lib/nutrition-utils';
import { useFirestore, useUser } from '@/firebase';
import { doc, onSnapshot } from 'firebase/firestore';

interface CoachFeedbackProps {
  stats: UserStats;
  dailyLog: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
}

export function CoachFeedback({ stats, dailyLog }: CoachFeedbackProps) {
  const { user } = useUser();
  const db = useFirestore();
  const [feedback, setFeedback] = useState<CoachFeedbackOutput | null>(null);
  const [loading, setLoading] = useState(false);
  const [hydration, setHydration] = useState(0);

  const today = useMemo(() => new Date().toISOString().split('T')[0], []);

  useEffect(() => {
    if (!user) return;
    const docRef = doc(db, 'users', user.uid, 'hydration', today);
    const unsubscribe = onSnapshot(docRef, (snap) => {
      if (snap.exists()) {
        setHydration(snap.data().amount || 0);
      } else {
        setHydration(0);
      }
    });
    return () => unsubscribe();
  }, [user, db, today]);

  useEffect(() => {
    async function fetchFeedback() {
      setLoading(true);
      try {
        const result = await getCoachFeedback({
          stats: {
            weight: stats.weight,
            targetWeight: stats.targetWeight,
            goal: stats.goal,
            activityLevel: stats.activityLevel,
          },
          dailyLog,
          hydration
        });
        setFeedback(result);
      } catch (error) {
        console.error("Erreur de liaison neurale IA:", error);
      } finally {
        setLoading(false);
      }
    }

    const timer = setTimeout(fetchFeedback, 1500);
    return () => clearTimeout(timer);
  }, [dailyLog, stats, hydration]);

  const isUrgent = feedback?.status === 'urgent';

  return (
    <div className={isUrgent ? "cyber-card-red p-6 mb-8 border-destructive/60" : "cyber-card-blue p-6 mb-8 border-accent/60"}>
      <div className="flex items-center gap-3 mb-4">
        {loading ? (
          <Zap className="text-primary animate-pulse" size={18} />
        ) : isUrgent ? (
          <AlertTriangle className="text-destructive animate-bounce" size={18} />
        ) : (
          <Sparkles className="text-accent" size={18} />
        )}
        <h3 className={`text-[10px] font-black uppercase tracking-[0.4em] ${isUrgent ? 'text-destructive neon-text-red' : 'text-accent neon-text-blue'}`}>
          {loading ? "Neural Uplink..." : "Coach Feedback"}
        </h3>
      </div>
      
      <p className="text-xs font-black leading-relaxed tracking-wide text-white/90 uppercase">
        {loading ? (
          <span className="opacity-50 italic">Analyse des données biométriques...</span>
        ) : (
          feedback?.feedback || "Système en veille. En attente de données métaboliques."
        )}
      </p>
    </div>
  );
}
