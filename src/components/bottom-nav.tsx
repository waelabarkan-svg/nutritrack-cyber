
"use client"

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, ClipboardList, Calendar, User, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

export function BottomNav() {
  const pathname = usePathname();

  const navItems = [
    { label: 'Today', href: '/', icon: Home },
    { label: 'Journal', href: '/journal', icon: ClipboardList },
    { label: 'History', href: '/history', icon: Calendar },
    { label: 'Profile', href: '/profile', icon: User },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 px-4 pb-4 md:hidden">
      <div className="glass rounded-2xl h-16 flex items-center justify-around shadow-2xl relative">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center space-y-1 transition-colors",
                isActive ? "text-primary" : "text-muted-foreground"
              )}
            >
              <Icon size={22} />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
