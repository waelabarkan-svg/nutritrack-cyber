"use client"

import React, { useState, useEffect } from 'react';
import { Sparkles, AlertTriangle, Zap } from 'lucide-react';
import { getCoachFeedback, CoachFeedbackOutput } from '@/ai/flows/coach-feedback-flow';
import { UserStats } from '@/lib/nutrition-utils';

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
  const [feedback, setFeedback] = useState<CoachFeedbackOutput | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function fetchFeedback() {
      // On déclenche le feedback si au moins un log existe ou pour souhaiter la bienvenue
      setLoading(true);
      try {
        const result = await getCoachFeedback({
          stats: {
            weight: stats.weight,
            targetWeight: stats.targetWeight,
            goal: stats.goal,
            activityLevel: stats.activityLevel,
          },
          dailyLog
        });
        setFeedback(result);
      } catch (error) {
        console.error("Erreur de liaison neurale IA:", error);
      } finally {
        setLoading(false);
      }
    }

    const timer = setTimeout(fetchFeedback, 1000);
    return () => clearTimeout(timer);
  }, [dailyLog, stats]);

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
          <span className="opacity-50 italic">Analyzing biometric data...</span>
        ) : (
          feedback?.feedback || "System standby. Awaiting caloric input."
        )}
      </p>
    </div>
  );
}