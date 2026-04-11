'use client';

import React, { Suspense, lazy } from 'react';
import { useAppStore } from '@/stores/app-store';
import { useIsMobile } from '@/hooks/use-mobile';
import { AnimatePresence, motion } from 'framer-motion';
import { useSheetsSync } from '@/hooks/use-data';
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  LayoutDashboard,
  Users,
  Building2,
  IndianRupee,
  Receipt,
  HandCoins,
  CheckSquare,
  HardHat,
  Package,
  Truck,
  FileText,
  Calendar,
  BarChart3,
  Bot,
  Settings,
  Menu,
  Sparkles,
  Zap,
  RefreshCw,
  Loader2,
  Target,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

// ── Lazy Tab Imports (fast initial load) ──────────────────────────────
const DashboardTab = lazy(() => import('@/components/tabs/dashboard'));
const ClientsTab = lazy(() => import('@/components/tabs/clients'));
const SitesTab = lazy(() => import('@/components/tabs/sites'));
const PaymentsTab = lazy(() => import('@/components/tabs/payments'));
const ExpensesTab = lazy(() => import('@/components/tabs/expenses'));
const ReceivablesTab = lazy(() => import('@/components/tabs/receivables'));
const TasksTab = lazy(() => import('@/components/tabs/tasks'));
const LabourTab = lazy(() => import('@/components/tabs/labour'));
const MaterialsTab = lazy(() => import('@/components/tabs/materials'));
const VehiclesTab = lazy(() => import('@/components/tabs/vehicles'));
const DiaryTab = lazy(() => import('@/components/tabs/diary'));
const HabitsTab = lazy(() => import('@/components/tabs/habits'));
const CalendarTab = lazy(() => import('@/components/tabs/calendar'));
const ReportsTab = lazy(() => import('@/components/tabs/reports'));
const ChatTab = lazy(() => import('@/components/tabs/chat'));
const SettingsTab = lazy(() => import('@/components/tabs/settings'));

// ── Navigation Configuration ─────────────────────────────────────────

interface NavItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    label: 'Overview',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    ],
  },
  {
    label: 'Business',
    items: [
      { id: 'clients', label: 'Clients', icon: Users },
      { id: 'sites', label: 'Sites & Projects', icon: Building2 },
      { id: 'payments', label: 'Payments', icon: IndianRupee },
      { id: 'expenses', label: 'Expenses', icon: Receipt },
      { id: 'receivables', label: 'Receivables', icon: HandCoins },
    ],
  },
  {
    label: 'Operations',
    items: [
      { id: 'tasks', label: 'Tasks', icon: CheckSquare },
      { id: 'labour', label: 'Labour', icon: HardHat },
      { id: 'materials', label: 'Materials', icon: Package },
      { id: 'vehicles', label: 'Vehicles', icon: Truck },
    ],
  },
  {
    label: 'Productivity',
    items: [
      { id: 'diary', label: 'Diary & Journal', icon: FileText },
      { id: 'habits', label: 'Habits', icon: Target },
      { id: 'calendar', label: 'Calendar', icon: Calendar },
    ],
  },
  {
    label: 'Intelligence',
    items: [
      { id: 'reports', label: 'Reports', icon: BarChart3 },
      { id: 'chat', label: 'AI Chat', icon: Bot },
    ],
  },
];

const systemItems: NavItem[] = [
  { id: 'settings', label: 'Settings', icon: Settings },
];

// ── Tab Component Map ────────────────────────────────────────────────

const tabComponentMap: Record<string, React.ComponentType> = {
  dashboard: DashboardTab,
  clients: ClientsTab,
  sites: SitesTab,
  payments: PaymentsTab,
  expenses: ExpensesTab,
  receivables: ReceivablesTab,
  tasks: TasksTab,
  labour: LabourTab,
  materials: MaterialsTab,
  vehicles: VehiclesTab,
  diary: DiaryTab,
  habits: HabitsTab,
  calendar: CalendarTab,
  reports: ReportsTab,
  chat: ChatTab,
  settings: SettingsTab,
};

// Flat lookup for labels
const allNavItems: NavItem[] = [
  ...navGroups.flatMap((g) => g.items),
  ...systemItems,
];

// ── Sidebar Navigation Component ─────────────────────────────────────

function SidebarNav({ onItemClick }: { onItemClick?: () => void }) {
  const activeTab = useAppStore((s) => s.activeTab);
  const setActiveTab = useAppStore((s) => s.setActiveTab);

  const handleClick = (id: string) => {
    setActiveTab(id);
    onItemClick?.();
  };

  const renderNavItem = (item: NavItem) => {
    const isActive = activeTab === item.id;
    const Icon = item.icon;

    return (
      <button
        key={item.id}
        onClick={() => handleClick(item.id)}
        className={cn(
          'relative w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] transition-all duration-150 outline-none',
          'focus-visible:ring-2 focus-visible:ring-emerald-500/50',
          isActive
            ? 'bg-emerald-500/10 text-emerald-400 font-medium'
            : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
        )}
      >
        {/* Active indicator bar */}
        {isActive && (
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-emerald-500" />
        )}
        <Icon
          className={cn(
            'w-[18px] h-[18px] shrink-0',
            isActive ? 'text-emerald-400' : 'text-muted-foreground/70'
          )}
        />
        <span className="truncate">{item.label}</span>
      </button>
    );
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* ── Logo Area ── */}
      <div className="flex items-center gap-3 px-4 h-14 shrink-0">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/25">
          <Sparkles className="w-5 h-5 text-white" />
        </div>
        <div className="flex flex-col min-w-0">
          <h1 className="font-bold text-[15px] leading-tight tracking-tight">
            GenuineOS
          </h1>
          <p className="text-[10px] text-muted-foreground/70 leading-tight flex items-center gap-1">
            <Zap className="w-2.5 h-2.5 text-emerald-500" />
            AI-First Business Suite
          </p>
        </div>
      </div>

      <Separator className="opacity-50" />

      {/* ── Main Navigation (everything scrollable) ── */}
      <ScrollArea className="flex-1 min-h-0 px-3 py-2">
        <div className="flex flex-col gap-4">
          {navGroups.map((group) => (
            <div key={group.label}>
              <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/40 select-none">
                {group.label}
              </p>
              <div className="flex flex-col gap-0.5">
                {group.items.map(renderNavItem)}
              </div>
            </div>
          ))}

          {/* System / Settings at bottom of scroll */}
          <Separator className="opacity-50 my-1" />
          <div>
            <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/40 select-none">
              System
            </p>
            <div className="flex flex-col gap-0.5">
              {systemItems.map(renderNavItem)}
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}

// ── Desktop Sidebar with Tooltips ────────────────────────────────────

function DesktopSidebar() {
  return (
    <aside className="hidden md:flex md:flex-col md:fixed md:inset-y-0 md:w-[260px] border-r border-border/40 bg-card/80 backdrop-blur-sm z-40 overflow-hidden">
      <SidebarNav />
    </aside>
  );
}

// ── Header Sync Button ────────────────────────────────────────────

function HeaderSyncButton() {
  const { syncSheets, isSyncing } = useSheetsSync();
  const { toast } = useToast();

  const handleSync = async () => {
    const result = await syncSheets('sync');
    if (result.success) {
      toast({ title: 'Sync Complete', description: result.message || 'Data synced from sheets' });
    } else {
      toast({ title: 'Sync Failed', description: result.error || result.message, variant: 'destructive' });
    }
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleSync}
          disabled={isSyncing}
          className="text-muted-foreground hover:text-foreground h-8 w-8"
        >
          <RefreshCw className={cn('w-4 h-4', isSyncing && 'animate-spin text-emerald-500')} />
          <span className="sr-only">Sync Sheets</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs">
        {isSyncing ? 'Syncing...' : 'Sync Google Sheets'}
      </TooltipContent>
    </Tooltip>
  );
}

// ── Main Application Shell ──────────────────────────────────────────

export default function Home() {
  const activeTab = useAppStore((s) => s.activeTab);
  const sidebarOpen = useAppStore((s) => s.sidebarOpen);
  const setSidebarOpen = useAppStore((s) => s.setSidebarOpen);
  const isMobile = useIsMobile();

  const ActiveTabComponent = tabComponentMap[activeTab] || DashboardTab;
  const activeLabel =
    allNavItems.find((i) => i.id === activeTab)?.label || 'Dashboard';

  return (
    <div className="h-screen flex overflow-hidden bg-background">
      {/* ── Desktop Sidebar ── */}
      <DesktopSidebar />

      {/* ── Mobile Sidebar Sheet ── */}
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent
          side="left"
          className="w-[280px] p-0 bg-card border-r border-border/40 overflow-hidden"
        >
          <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
          <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
            <SidebarNav onItemClick={() => setSidebarOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>

      {/* ── Main Content Area ── */}
      <div className="flex-1 md:pl-[260px] flex flex-col min-w-0">
        {/* ── Top Header ── */}
        <header className="sticky top-0 z-30 h-14 border-b border-border/40 bg-background/80 backdrop-blur-xl flex items-center justify-between px-4 md:px-6 shrink-0">
          {/* Left: Mobile menu + Title */}
          <div className="flex items-center gap-3">
            {isMobile && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSidebarOpen(true)}
                className="shrink-0 -ml-1"
              >
                <Menu className="w-5 h-5" />
                <span className="sr-only">Toggle menu</span>
              </Button>
            )}

            {/* Mobile: Show app branding */}
            {isMobile && (
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center">
                  <Sparkles className="w-3.5 h-3.5 text-white" />
                </div>
                <span className="font-semibold text-sm">GenuineOS</span>
              </div>
            )}

            {/* Desktop: Show active section breadcrumb */}
            {!isMobile && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Home</span>
                <span className="text-muted-foreground/40">/</span>
                <span className="font-medium text-foreground">{activeLabel}</span>
              </div>
            )}
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-1">
            {isMobile && (
              <span className="text-xs text-muted-foreground mr-1">
                {activeLabel}
              </span>
            )}
            <HeaderSyncButton />
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground hover:text-foreground h-8 w-8"
                >
                  <Zap className="w-4 h-4 text-emerald-500" />
                  <span className="sr-only">AI Features</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                AI Features Active
              </TooltipContent>
            </Tooltip>
          </div>
        </header>

        {/* ── Tab Content ── */}
        <main className="flex-1 overflow-y-auto">
          <Suspense fallback={
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
            </div>
          }>
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.08 }}
                className="p-4 md:p-6"
              >
                <ActiveTabComponent />
              </motion.div>
            </AnimatePresence>
          </Suspense>
        </main>
      </div>
    </div>
  );
}
