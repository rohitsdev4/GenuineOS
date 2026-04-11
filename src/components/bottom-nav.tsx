'use client';

import { useAppStore } from '@/stores/app-store';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  LayoutDashboard,
  IndianRupee,
  Receipt,
  Building2,
  Settings,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const tabs = [
  { id: 'dashboard', icon: LayoutDashboard, label: 'Home' },
  { id: 'payments', icon: IndianRupee, label: 'Payments' },
  { id: 'expenses', icon: Receipt, label: 'Expenses' },
  { id: 'sites', icon: Building2, label: 'Sites' },
  { id: 'settings', icon: Settings, label: 'Settings' },
];

export function BottomNav() {
  const activeTab = useAppStore((s) => s.activeTab);
  const setActiveTab = useAppStore((s) => s.setActiveTab);
  const isMobile = useIsMobile();

  // Only show on mobile
  if (!isMobile) return null;

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 bg-card/95 backdrop-blur-xl border-t border-border/60"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="flex items-center justify-around h-14">
        {tabs.map(({ id, icon: Icon, label }) => {
          const active = activeTab === id;
          return (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={cn(
                'flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all duration-150 min-w-[56px]',
                active
                  ? 'text-emerald-400'
                  : 'text-muted-foreground active:text-foreground'
              )}
            >
              <Icon
                className={cn(
                  'w-5 h-5 transition-transform duration-150',
                  active && 'scale-110'
                )}
              />
              <span className={cn(
                'text-[10px] font-medium leading-tight',
                active && 'font-semibold'
              )}>
                {label}
              </span>
              {active && (
                <div className="absolute -top-px w-5 h-0.5 rounded-full bg-emerald-400" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
