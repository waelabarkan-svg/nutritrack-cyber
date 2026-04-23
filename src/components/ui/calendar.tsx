"use client"

import React from 'react';

export type CalendarProps = {
  selected?: Date;
  onSelect?: (date: Date | undefined) => void;
  className?: string;
  mode?: string;
}

const Calendar = ({ selected, onSelect, className }: CalendarProps) => {
  const days = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
  // Grille fixe pour Avril 2026 (commence un Mercredi)
  const dates = [29, 30, 31, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 1, 2];

  return (
    <div className={`w-full max-w-full mx-auto p-4 bg-black/20 rounded-[20px] border border-accent/20 ${className}`}>
      <div className="text-primary text-center font-black mb-6 tracking-[0.4em] uppercase text-[10px] neon-text-yellow">Avril 2026</div>
      <div className="grid grid-cols-7 gap-1 mb-2">
        {days.map(d => (
          <div key={d} className="text-accent text-[9px] font-black text-center uppercase tracking-widest py-2">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {dates.map((date, i) => {
          // Logique simple pour identifier le mois actuel dans la grille fixe
          const isCurrentMonth = i >= 3 && i <= 32;
          const isToday = isCurrentMonth && date === 23;
          
          return (
            <button 
              key={i} 
              onClick={() => {
                if (isCurrentMonth) {
                  onSelect?.(new Date(2026, 3, date));
                }
              }}
              className={`aspect-square flex items-center justify-center text-[10px] font-black rounded-lg transition-all ${
                isToday 
                  ? 'bg-primary text-black shadow-[0_0_15px_rgba(253,224,71,0.6)]' 
                  : isCurrentMonth 
                    ? 'text-white hover:bg-primary/10' 
                    : 'text-white/10'
              }`}
            >
              {date}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export { Calendar };
