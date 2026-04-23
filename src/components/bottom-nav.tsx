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
    <div className="fixed bottom-0 left-0 right-0 z-50 px-6 pb-10 md:hidden pointer-events-none">
      <div className="bg-black/90 backdrop-blur-3xl border-t border-accent/40 h-22 flex items-center justify-around px-4 pointer-events-auto rounded-t-[24px] shadow-[0_-10px_40px_rgba(0,242,255,0.15)]">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center space-y-2 transition-all px-5 py-3",
                isActive ? "text-primary neon-text-yellow scale-110" : "text-muted-foreground hover:text-accent/60"
              )}
            >
              <Icon size={22} className={isActive ? "drop-shadow-[0_0_12px_rgba(253,224,71,0.9)]" : ""} />
              <span className="text-[9px] font-black uppercase tracking-[0.4em]">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}