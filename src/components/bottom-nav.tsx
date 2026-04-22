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
    { label: 'Archive', href: '/history', icon: Calendar },
    { label: 'Agent', href: '/profile', icon: User },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 px-6 pb-8 md:hidden pointer-events-none">
      <div className="bg-black/80 backdrop-blur-xl border-t border-primary/20 h-20 flex items-center justify-around px-4 pointer-events-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center space-y-1 transition-all px-4 py-2",
                isActive ? "text-primary neon-text-red" : "text-muted-foreground hover:text-white/40"
              )}
            >
              <Icon size={20} className={isActive ? "drop-shadow-[0_0_8px_rgba(255,0,0,0.8)]" : ""} />
              <span className="text-[8px] font-black uppercase tracking-[0.3em]">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}