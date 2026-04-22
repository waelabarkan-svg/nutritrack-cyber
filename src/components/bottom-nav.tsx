"use client"

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, ClipboardList, Calendar, User } from 'lucide-react';
import { cn } from '@/lib/utils';

export function BottomNav() {
  const pathname = usePathname();

  const navItems = [
    { label: 'Aujourd\'hui', href: '/', icon: Home },
    { label: 'Journal', href: '/journal', icon: ClipboardList },
    { label: 'Historique', href: '/history', icon: Calendar },
    { label: 'Profil', href: '/profile', icon: User },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 px-4 pb-6 md:hidden">
      <div className="bg-black/80 backdrop-blur-xl border border-white/10 rounded-2xl h-16 flex items-center justify-around shadow-2xl">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center space-y-1 transition-all",
                isActive ? "text-primary neon-text scale-110" : "text-muted-foreground hover:text-white"
              )}
            >
              <Icon size={20} className={isActive ? "drop-shadow-[0_0_8px_rgba(227,0,34,0.6)]" : ""} />
              <span className="text-[10px] font-bold uppercase tracking-tighter">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}