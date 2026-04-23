"use client"

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, ClipboardList, Calendar, User } from 'lucide-react';
import { cn } from '@/lib/utils';

export function BottomNav() {
  const pathname = usePathname();

  const navItems = [
    { label: 'Core', href: '/', icon: Home },
    { label: 'Logs', href: '/journal', icon: ClipboardList },
    { label: 'Archive', href: '/history', icon: Calendar },
    { label: 'Agent', href: '/profile', icon: User },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 px-4 sm:px-6 pb-6 sm:pb-10 pointer-events-none flex justify-center">
      <div className="bg-black/90 backdrop-blur-3xl border-t border-accent/40 h-20 sm:h-22 flex items-center justify-around px-2 sm:px-4 pointer-events-auto rounded-t-[20px] sm:rounded-t-[24px] shadow-[0_-10px_40px_rgba(0,242,255,0.15)] w-full max-w-md">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center space-y-1 sm:space-y-2 transition-all px-3 sm:px-5 py-2 sm:py-3",
                isActive ? "text-primary neon-text-yellow scale-110" : "text-muted-foreground hover:text-accent/60"
              )}
            >
              <Icon 
                size={20} 
                className={cn(
                  "transition-all",
                  isActive ? "drop-shadow-[0_0_12px_rgba(253,224,71,0.9)]" : "",
                  "sm:w-[22px] sm:h-[22px]"
                )} 
              />
              <span className="text-[8px] sm:text-[9px] font-black uppercase tracking-[0.3em] sm:tracking-[0.4em]">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
