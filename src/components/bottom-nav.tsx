"use client"

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, ClipboardList, Calendar, User } from 'lucide-react';
import { cn } from '@/lib/utils';

export function BottomNav() {
  const pathname = usePathname();

  const navItems = [
    { label: 'Status', href: '/', icon: Home },
    { label: 'Logs', href: '/journal', icon: ClipboardList },
    { label: 'History', href: '/history', icon: Calendar },
    { label: 'Profile', href: '/profile', icon: User },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 px-6 pb-6 md:hidden">
      <div className="bg-black/90 backdrop-blur-md border border-primary/20 rounded-full h-16 flex items-center justify-around shadow-[0_0_20px_rgba(255,0,0,0.1)] px-4">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center space-y-1 transition-all px-3 py-1 rounded-full",
                isActive ? "text-primary neon-text" : "text-muted-foreground hover:text-white/60"
              )}
            >
              <Icon size={18} className={isActive ? "drop-shadow-[0_0_5px_rgba(255,0,0,0.8)]" : ""} />
              <span className="text-[8px] font-black uppercase tracking-widest">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}