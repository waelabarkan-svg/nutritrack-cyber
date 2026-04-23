"use client"

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/firebase';
import { BottomNav } from '@/components/bottom-nav';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import { Activity, Flame, Beef, Zap, AlertTriangle } from 'lucide-react';

type TimeRange = '7J' | '1M' | '6M';

export default function AnalysisPage() {
  const { user, loading } = useUser();
  const router = useRouter();
  const [timeRange, setTimeRange] = useState<TimeRange>('7J');
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    if (!loading && !user) router.push('/login');
    
    // Charger la mémoire biométrique réelle depuis le localStorage
    const storedHistory = JSON.parse(localStorage.getItem('biometric_memory') || '[]');
    setHistory(storedHistory);
  }, [user, loading, router]);

  const filteredData = useMemo(() => {
    const now = new Date();
    let days = 7;
    if (timeRange === '1M') days = 30;
    if (timeRange === '6M') days = 180;

    return history
      .filter(item => {
        const itemDate = new Date(item.date);
        const diffTime = Math.abs(now.getTime() - itemDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays <= days;
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [history, timeRange]);

  const stats = useMemo(() => {
    if (filteredData.length === 0) return { avgCal: 0, avgProt: 0, totalScans: 0 };
    const totalCal = filteredData.reduce((acc, curr) => acc + curr.calories, 0);
    const totalProt = filteredData.reduce((acc, curr) => acc + curr.protein, 0);
    const totalScans = filteredData.reduce((acc, curr) => acc + (curr.scans || 0), 0);
    return {
      avgCal: Math.round(totalCal / filteredData.length),
      avgProt: Math.round(totalProt / filteredData.length),
      totalScans
    };
  }, [filteredData]);

  if (loading || !user) return null;

  const hasData = filteredData.length > 0;

  return (
    <main className="px-6 pt-16 max-w-md mx-auto pb-32 min-h-screen bg-black text-white selection:bg-primary/20">
      <div className="space-y-1 mb-8">
        <p className="text-primary/60 text-[9px] font-black uppercase tracking-[0.5em] neon-text-yellow">Index: Biométrie</p>
        <h1 className="text-3xl font-black tracking-tighter uppercase neon-text-yellow">Analyse</h1>
      </div>

      <div className="flex gap-2 mb-8">
        {(['7J', '1M', '6M'] as TimeRange[]).map((range) => (
          <button
            key={range}
            onClick={() => setTimeRange(range)}
            className={`flex-1 py-2 text-[10px] font-black border rounded-lg transition-all ${
              timeRange === range 
                ? 'bg-primary text-black border-primary shadow-[0_0_15px_rgba(253,224,71,0.4)]' 
                : 'border-white/5 text-muted-foreground hover:border-white/20'
            }`}
          >
            {range}
          </button>
        ))}
      </div>

      <div className="cyber-card-yellow p-4 mb-8 h-[250px] bg-black/40 border-primary/20 flex flex-col justify-center items-center">
        {!hasData ? (
          <div className="flex flex-col items-center gap-4 animate-pulse">
            <AlertTriangle className="text-primary" size={32} />
            <p className="text-[10px] font-black text-primary uppercase tracking-[0.4em] text-center">
              AUCUNE DONNÉE BIOMÉTRIQUE DÉTECTÉE
            </p>
            <p className="text-[8px] text-muted-foreground uppercase text-center">
              Enregistrez vos repas pour générer la courbe de flux.
            </p>
          </div>
        ) : (
          <>
            <div className="flex justify-between items-center mb-4 w-full px-2">
              <span className="text-[8px] font-black text-primary/80 uppercase tracking-widest">Projection Energétique (KCAL)</span>
              <Activity size={12} className="text-primary animate-pulse" />
            </div>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={filteredData}>
                <defs>
                  <linearGradient id="colorCal" x1="0" y1="0" x2="0" y2="1">
                    <span className="sr-only">Gradient</span>
                    <stop offset="5%" stopColor="#fde047" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#fde047" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                <XAxis 
                  dataKey="date" 
                  hide 
                />
                <YAxis 
                  hide 
                  domain={['dataMin - 100', 'dataMax + 100']} 
                />
                <RechartsTooltip 
                  contentStyle={{ backgroundColor: '#000', border: '1px solid #fde04744', borderRadius: '8px', fontSize: '10px' }}
                  itemStyle={{ color: '#fde047', fontWeight: 'bold' }}
                  labelStyle={{ display: 'none' }}
                />
                <Area 
                  type="monotone" 
                  dataKey="calories" 
                  stroke="#fde047" 
                  strokeWidth={3}
                  fillOpacity={1} 
                  fill="url(#colorCal)" 
                  animationDuration={1500}
                />
              </AreaChart>
            </ResponsiveContainer>
          </>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 mb-12">
        <div className="cyber-card-yellow p-6 flex justify-between items-center bg-black/40 border-primary/10">
          <div className="space-y-1">
            <span className="text-[8px] font-black text-muted-foreground uppercase tracking-widest block">Moyenne Flux</span>
            <span className="text-2xl font-black neon-text-yellow">{stats.avgCal} <span className="text-[10px] tracking-normal">KCAL</span></span>
          </div>
          <div className="w-12 h-12 border border-primary/20 flex items-center justify-center rounded-xl bg-primary/5">
             <Flame className="text-primary" size={20} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="cyber-card-blue p-6 flex flex-col justify-center bg-black/40 border-accent/10">
            <span className="text-[8px] font-black text-muted-foreground uppercase tracking-widest mb-2">Synthèse Prot</span>
            <span className="text-xl font-black neon-text-blue">{stats.avgProt}g</span>
            <div className="mt-2 pt-2 border-t border-white/5">
               <Beef className="text-accent/60" size={14} />
            </div>
          </div>
          <div className="cyber-card-yellow p-6 flex flex-col justify-center bg-black/40 border-primary/10">
            <span className="text-[8px] font-black text-muted-foreground uppercase tracking-widest mb-2">Scans Totaux</span>
            <span className="text-xl font-black neon-text-yellow">{stats.totalScans}</span>
            <div className="mt-2 pt-2 border-t border-white/5">
               <Zap className="text-primary/60" size={14} />
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4 mb-12">
        <h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-muted-foreground px-1">Liaisons récentes</h2>
        {!hasData ? (
          <p className="text-[8px] text-muted-foreground uppercase text-center py-8">Aucune archive détectée</p>
        ) : (
          filteredData.slice(-5).reverse().map((item, i) => (
            <div key={i} className="flex items-center justify-between p-4 bg-white/5 border border-white/5 rounded-xl">
               <div className="flex items-center gap-3">
                 <div className="w-2 h-2 rounded-full bg-primary neon-glow-yellow" />
                 <span className="text-[10px] font-black uppercase tracking-wider">{new Date(item.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}</span>
               </div>
               <div className="text-right">
                 <span className="text-xs font-black text-white">{item.calories} KCAL</span>
                 <span className="text-[8px] text-muted-foreground block uppercase font-black">{item.scans || 0} SCANS OPTIQUES</span>
               </div>
            </div>
          ))
        )}
      </div>

      <BottomNav />
    </main>
  );
}