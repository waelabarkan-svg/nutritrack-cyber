
"use client"

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useFirestore, useDoc } from '@/firebase';
import { BottomNav } from '@/components/bottom-nav';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend } from 'recharts';
import { Activity, Flame, Zap, AlertTriangle, Cpu, Target, TrendingUp, Calendar } from 'lucide-react';
import { getUserGamification, getRank } from '@/lib/gamification-utils';
import { calculateNutritionGoals, UserStats } from '@/lib/nutrition-utils';
import { doc } from 'firebase/firestore';
import { cn } from '@/lib/utils';

type TimeRange = '7J' | '1M' | '6M' | '1A';

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-black/90 border border-white/10 p-3 rounded-lg backdrop-blur-md shadow-2xl">
        <p className="text-[10px] font-black text-white/50 mb-2 uppercase tracking-widest">{label}</p>
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-4">
            <span className="text-[9px] font-black text-destructive uppercase">Calories</span>
            <span className="text-xs font-black text-white">{Math.round(payload[0].value)} kcal</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-[9px] font-black text-accent uppercase">Protéines</span>
            <span className="text-xs font-black text-white">{Math.round(payload[1].value)} g</span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

export default function AnalysisPage() {
  const { user, loading } = useUser();
  const db = useFirestore();
  const router = useRouter();
  const [timeRange, setTimeRange] = useState<TimeRange>('7J');
  const [history, setHistory] = useState<any[]>([]);
  const [gamification, setGamification] = useState({ xp: 0, level: 1 });

  const profileRef = useMemo(() => user ? doc(db, 'users', user.uid) : null, [db, user]);
  const { data: profileStats } = useDoc<UserStats>(profileRef as any);

  const goals = useMemo(() => {
    const stats: UserStats = (profileStats as UserStats) || {
      gender: 'male', age: 25, height: 175, weight: 70, targetWeight: 70, activityLevel: 'moderate', goal: 'maintain'
    };
    return calculateNutritionGoals(stats);
  }, [profileStats]);

  useEffect(() => {
    if (!loading && !user) router.push('/login');
    
    const storedHistory = JSON.parse(localStorage.getItem('biometric_memory') || '[]');
    setHistory(storedHistory);
    setGamification(getUserGamification());
  }, [user, loading, router]);

  const aggregatedData = useMemo(() => {
    const groups: Record<string, any> = {};
    const now = new Date();
    
    const filteredHistory = history.filter(item => {
      const itemDate = new Date(item.date);
      const diffTime = Math.abs(now.getTime() - itemDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (timeRange === '7J') return diffDays <= 7;
      if (timeRange === '1M') return diffDays <= 30;
      if (timeRange === '6M') return diffDays <= 180;
      if (timeRange === '1A') return diffDays <= 365;
      return true;
    });

    filteredHistory.forEach(item => {
      let key = item.date; // Default daily
      
      if (timeRange === '6M' || timeRange === '1A') {
        // Group by Month/Year for long term
        const d = new Date(item.date);
        key = d.toLocaleString('fr-FR', { month: 'short', year: '2-digit' }).toUpperCase();
      }

      if (!groups[key]) {
        groups[key] = { 
          label: key, 
          calories: 0, 
          protein: 0, 
          count: 0,
          rawDate: item.date 
        };
      }
      groups[key].calories += Number(item.calories || 0);
      groups[key].protein += Number(item.protein || 0);
      groups[key].count += 1;
    });

    return Object.values(groups)
      .sort((a: any, b: any) => a.rawDate.localeCompare(b.rawDate))
      .map((g: any) => ({
        ...g,
        // Pour les vues long terme, on peut afficher la moyenne quotidienne du mois
        calories: (timeRange === '6M' || timeRange === '1A') ? g.calories / (g.count || 1) : g.calories,
        protein: (timeRange === '6M' || timeRange === '1A') ? g.protein / (g.count || 1) : g.protein,
      }));
  }, [history, timeRange]);

  const todayStr = new Date().toISOString().split('T')[0];
  const todayStats = useMemo(() => {
    const todayEntries = history.filter(h => h.date === todayStr);
    return todayEntries.reduce((acc, curr) => ({
      calories: acc.calories + (Number(curr.calories) || 0),
      protein: acc.protein + (Number(curr.protein) || 0)
    }), { calories: 0, protein: 0 });
  }, [history, todayStr]);

  const stats = useMemo(() => {
    if (aggregatedData.length === 0) return { avgCal: 0, avgProt: 0, totalScans: history.length };
    const totalCal = aggregatedData.reduce((acc, curr) => acc + curr.calories, 0);
    const totalProt = aggregatedData.reduce((acc, curr) => acc + curr.protein, 0);
    return {
      avgCal: Math.round(totalCal / aggregatedData.length),
      avgProt: Math.round(totalProt / aggregatedData.length),
      totalScans: history.length
    };
  }, [aggregatedData, history]);

  if (loading || !user) return null;

  const hasData = aggregatedData.length > 0;
  const rank = getRank(gamification.level);

  return (
    <main className="px-6 pt-16 max-w-md mx-auto pb-32 min-h-screen bg-black text-white selection:bg-primary/20">
      <div className="space-y-1 mb-8">
        <p className="text-primary/60 text-[9px] font-black uppercase tracking-[0.5em] neon-text-yellow">Index: Biométrie & Performance</p>
        <h1 className="text-3xl font-black tracking-tighter uppercase neon-text-yellow">Dashboard</h1>
      </div>

      {/* Résumé Gamification */}
      <div className="cyber-card-blue p-4 mb-8 bg-black/40 border-accent/40 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 border border-accent/40 flex items-center justify-center rounded-lg bg-accent/5">
            <Cpu size={20} className="text-accent" />
          </div>
          <div>
            <span className="text-[7px] font-black text-accent/60 uppercase tracking-widest block">{rank}</span>
            <span className="text-xs font-black uppercase tracking-tighter">NIVEAU {gamification.level}</span>
          </div>
        </div>
        <div className="text-right">
          <span className="text-[10px] font-black neon-text-blue">{Math.floor(gamification.xp)} XP</span>
          <span className="text-[7px] text-muted-foreground block uppercase font-black">PROGRESSION NEURALE</span>
        </div>
      </div>

      {/* Objectifs Quotidiens */}
      <div className="space-y-6 mb-10">
        <div className="flex items-center gap-2 mb-2">
          <Target size={14} className="text-primary" />
          <h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-primary">Status Objectifs Quotidiens</h2>
        </div>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between items-end">
              <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">FLUX ÉNERGÉTIQUE (KCAL)</span>
              <span className="text-[10px] font-black neon-text-red">{todayStats.calories} / {goals.calories}</span>
            </div>
            <div className="h-2 w-full bg-white/5 border border-white/5 rounded-full overflow-hidden">
               <div 
                 className="h-full bg-destructive shadow-[0_0_15px_rgba(255,0,85,0.6)] transition-all duration-1000"
                 style={{ width: `${Math.min((todayStats.calories / (goals.calories || 1)) * 100, 100)}%` }}
               />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-end">
              <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">SYNTHÈSE PROTÉIQUE (G)</span>
              <span className="text-[10px] font-black neon-text-blue">{todayStats.protein} / {goals.protein}</span>
            </div>
            <div className="h-2 w-full bg-white/5 border border-white/5 rounded-full overflow-hidden">
               <div 
                 className="h-full bg-accent shadow-[0_0_15px_rgba(0,242,255,0.6)] transition-all duration-1000"
                 style={{ width: `${Math.min((todayStats.protein / (goals.protein || 1)) * 100, 100)}%` }}
               />
            </div>
          </div>
        </div>
      </div>

      {/* Sélecteur de Période Néon */}
      <div className="flex gap-1 p-1 bg-white/5 border border-white/10 rounded-xl mb-8">
        {(['7J', '1M', '6M', '1A'] as TimeRange[]).map((range) => (
          <button
            key={range}
            onClick={() => setTimeRange(range)}
            className={cn(
              "flex-1 py-2 text-[9px] font-black rounded-lg transition-all duration-300 uppercase tracking-widest",
              timeRange === range 
                ? "bg-primary text-black shadow-[0_0_10px_rgba(253,224,71,0.3)]" 
                : "text-muted-foreground hover:text-white hover:bg-white/5"
            )}
          >
            {range}
          </button>
        ))}
      </div>

      {/* Graphique d'Évolution */}
      <div className="cyber-card-yellow p-4 mb-8 h-[300px] bg-black/40 border-primary/20 relative">
        {!hasData ? (
          <div className="flex flex-col h-full justify-center items-center gap-4 animate-pulse">
            <Calendar className="text-primary/40" size={32} />
            <p className="text-[10px] font-black text-primary/40 uppercase tracking-[0.4em] text-center">
              SYNC_WAIT: ARCHIVES VIDES
            </p>
          </div>
        ) : (
          <>
            <div className="flex justify-between items-center mb-6 w-full px-2">
              <div className="flex items-center gap-2">
                <Activity size={12} className="text-primary" />
                <span className="text-[8px] font-black text-primary uppercase tracking-[0.3em]">Projection Bio-Temporelle</span>
              </div>
              <TrendingUp size={12} className="text-primary/40 animate-pulse" />
            </div>
            <div className="h-[220px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={aggregatedData}>
                  <defs>
                    <linearGradient id="colorCal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ff0055" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#ff0055" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorProt" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#00f2ff" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#00f2ff" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                  <XAxis 
                    dataKey="label" 
                    hide={timeRange === '1M'} 
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 7, fill: '#666', fontWeight: 900 }}
                    minTickGap={10}
                  />
                  <YAxis yAxisId="left" hide />
                  <YAxis yAxisId="right" orientation="right" hide />
                  <RechartsTooltip content={<CustomTooltip />} />
                  <Area 
                    yAxisId="left"
                    type="monotone" 
                    dataKey="calories" 
                    stroke="#ff0055" 
                    strokeWidth={3}
                    fillOpacity={1} 
                    fill="url(#colorCal)" 
                    name="CALORIES"
                    animationDuration={1500}
                  />
                  <Area 
                    yAxisId="right"
                    type="monotone" 
                    dataKey="protein" 
                    stroke="#00f2ff" 
                    strokeWidth={3}
                    fillOpacity={1} 
                    fill="url(#colorProt)" 
                    name="PROTÉINES"
                    animationDuration={1500}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 mb-12">
        <div className="cyber-card-red p-6 flex flex-col justify-center bg-black/40 border-destructive/10">
          <div className="flex items-center gap-2 mb-2">
            <Flame className="text-destructive" size={14} />
            <span className="text-[8px] font-black text-muted-foreground uppercase tracking-widest block">Moyenne Flux</span>
          </div>
          <span className="text-xl font-black neon-text-red">{stats.avgCal} <span className="text-[8px] tracking-normal">KCAL</span></span>
        </div>

        <div className="cyber-card-blue p-6 flex flex-col justify-center bg-black/40 border-accent/10">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="text-accent" size={14} />
            <span className="text-[8px] font-black text-muted-foreground uppercase tracking-widest block">Moyenne Synthèse</span>
          </div>
          <span className="text-xl font-black neon-text-blue">{stats.avgProt} <span className="text-[8px] tracking-normal">G</span></span>
        </div>
      </div>

      <BottomNav />
    </main>
  );
}
