
"use client"

import React from 'react';

interface CircularProgressProps {
  size?: number;
  strokeWidth?: number;
  progress: number; // 0 to 1
  color: string;
  label?: string;
  value?: string | number;
  unit?: string;
  children?: React.ReactNode;
}

export function CircularProgress({
  size = 120,
  strokeWidth = 10,
  progress,
  color,
  label,
  value,
  unit,
  children
}: CircularProgressProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const safeProgress = Math.min(Math.max(progress, 0), 1);
  const offset = circumference - (safeProgress * circumference);

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="transparent"
          className="text-muted/20"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          fill="transparent"
          className="transition-all duration-500 ease-out"
        />
      </svg>
      <div className="absolute flex flex-col items-center justify-center text-center">
        {children || (
          <>
            <span className="text-2xl font-bold">{value}</span>
            {unit && <span className="text-[10px] text-muted-foreground uppercase">{unit}</span>}
            {label && <span className="text-[10px] text-muted-foreground mt-1 uppercase font-semibold">{label}</span>}
          </>
        )}
      </div>
    </div>
  );
}
