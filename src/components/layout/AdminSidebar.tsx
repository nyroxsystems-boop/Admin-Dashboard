/**
 * AdminSidebar — Premium collapsible sidebar for the Admin-Dashboard.
 *
 *  - 240px expanded / 56px collapsed
 *  - localStorage-Persistenz: `pu.admin.sidebar.collapsed.v1`
 *  - 2px Sharp Accent-Bar bei aktivem Item (kein Highlight-BG)
 *  - Tooltips bei collapsed Icons (Radix Tooltip)
 *  - Cmd+\ Toggle
 *  - Mobile: Drawer (Slide-Over via Sheet)
 *
 * Adapted from User-Dashboard `layout/SidebarV2.tsx`.
 */

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import {
  AlertCircle,
  Bot,
  Building2,
  Database,
  Inbox,
  LayoutDashboard,
  PanelLeftClose,
  PanelLeftOpen,
  ScrollText,
  Search,
  ShoppingCart,
  Spline,
  Target,
  TestTubes,
  Users,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Sheet, SheetContent } from '@/components/ui/sheet';

const STORAGE_KEY = 'pu.admin.sidebar.collapsed.v1';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
}

interface NavSection {
  id: string;
  label: string;
  items: NavItem[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    id: 'top',
    label: 'Übersicht',
    items: [
      { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
      { to: '/tenants', label: 'Tenants', icon: Building2 },
      { to: '/admins', label: 'Admins', icon: Users },
      { to: '/audit', label: 'Audit Log', icon: ScrollText },
    ],
  },
  {
    id: 'oem',
    label: 'OEM',
    items: [
      { to: '/oem/registry', label: 'OEM Registry', icon: Database },
      { to: '/oem/lookup', label: 'OEM Lookup', icon: Search },
      { to: '/oem/batch', label: 'Batch Test', icon: TestTubes },
      { to: '/oem/errors', label: 'Errors', icon: AlertCircle },
      { to: '/oem/accuracy', label: 'Accuracy', icon: Target },
    ],
  },
  {
    id: 'ops',
    label: 'Ops',
    items: [
      { to: '/bot/testing', label: 'Bot Testing', icon: Bot },
      { to: '/inbox', label: 'Inbox', icon: Inbox },
      { to: '/orders', label: 'Orders', icon: ShoppingCart },
      { to: '/scraper', label: 'Bulk Scraper', icon: Spline },
      { to: '/maintenance', label: 'Maintenance', icon: Wrench },
    ],
  },
];

function readPersistedCollapsed(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function writePersistedCollapsed(value: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, value ? '1' : '0');
  } catch {
    /* noop */
  }
}

export interface AdminSidebarProps {
  className?: string;
  /** Mobile open state (controlled). Mobile uses Sheet drawer. */
  mobileOpen?: boolean;
  onMobileOpenChange?: (open: boolean) => void;
}

export function AdminSidebar({
  className,
  mobileOpen = false,
  onMobileOpenChange,
}: AdminSidebarProps) {
  const [collapsed, setCollapsed] = useState<boolean>(() => readPersistedCollapsed());

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      writePersistedCollapsed(next);
      return next;
    });
  }, []);

  // Cmd+\ toggle
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === '\\') {
        e.preventDefault();
        toggleCollapsed();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggleCollapsed]);

  const desktopSidebar = (
    <aside
      className={cn(
        'hidden md:flex flex-col h-screen sticky top-0 shrink-0',
        'bg-[color:var(--surface,#111418)] border-r border-[color:var(--border,#252A31)]',
        'transition-[width] duration-200 ease-out',
        collapsed ? 'w-14' : 'w-60',
        className,
      )}
      aria-label="Hauptnavigation"
    >
      <SidebarBrand collapsed={collapsed} />
      <SidebarNav collapsed={collapsed} />
      <SidebarFooter collapsed={collapsed} onToggle={toggleCollapsed} />
    </aside>
  );

  return (
    <TooltipProvider delayDuration={150}>
      {desktopSidebar}
      <Sheet open={mobileOpen} onOpenChange={onMobileOpenChange}>
        <SheetContent
          side="left"
          className="w-64 p-0 bg-[color:var(--surface,#111418)] border-r border-[color:var(--border,#252A31)]"
        >
          <div className="flex flex-col h-full">
            <SidebarBrand collapsed={false} />
            <SidebarNav collapsed={false} onNavigate={() => onMobileOpenChange?.(false)} />
          </div>
        </SheetContent>
      </Sheet>
    </TooltipProvider>
  );
}

function SidebarBrand({ collapsed }: { collapsed: boolean }) {
  return (
    <div
      className={cn(
        'flex items-center h-14 px-3 border-b border-[color:var(--border,#252A31)] shrink-0',
        collapsed && 'justify-center',
      )}
    >
      <div
        className="w-8 h-8 rounded-md bg-[color:var(--accent-500,#1D6FE8)] flex items-center justify-center text-white font-bold text-sm shrink-0"
        aria-hidden
      >
        PU
      </div>
      {!collapsed && (
        <div className="ml-2 flex flex-col leading-tight">
          <span className="text-sm font-semibold text-[color:var(--text-primary,#E5E7EB)]">
            Partsunion
          </span>
          <span className="text-[10px] uppercase tracking-wider text-[color:var(--text-muted,#71717A)]">
            Admin
          </span>
        </div>
      )}
    </div>
  );
}

function SidebarNav({
  collapsed,
  onNavigate,
}: {
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  return (
    <nav className="flex-1 overflow-y-auto py-3" aria-label="Navigation">
      {NAV_SECTIONS.map((section) => (
        <SidebarSection
          key={section.id}
          section={section}
          collapsed={collapsed}
          onNavigate={onNavigate}
        />
      ))}
    </nav>
  );
}

function SidebarSection({
  section,
  collapsed,
  onNavigate,
}: {
  section: NavSection;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  return (
    <div className="mb-4">
      {!collapsed && (
        <div className="px-4 mb-1 text-[10px] uppercase tracking-wider text-[color:var(--text-muted,#71717A)] font-medium">
          {section.label}
        </div>
      )}
      <ul className="space-y-0.5">
        {section.items.map((item) => (
          <li key={item.to}>
            <SidebarLink item={item} collapsed={collapsed} onNavigate={onNavigate} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function SidebarLink({
  item,
  collapsed,
  onNavigate,
}: {
  item: NavItem;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;

  const link = (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          'group relative flex items-center h-9 mx-2 rounded-md text-sm transition-colors',
          'text-[color:var(--text-secondary,#A1A1AA)]',
          'hover:text-[color:var(--text-primary,#E5E7EB)] hover:bg-[color:var(--elevated,#1A1E24)]',
          collapsed ? 'justify-center px-0' : 'px-3 gap-3',
          isActive &&
            'text-[color:var(--text-primary,#E5E7EB)] bg-[color:var(--elevated,#1A1E24)]',
        )
      }
    >
      {({ isActive }) => (
        <>
          {/* 2px Sharp Accent-Bar bei active */}
          {isActive && (
            <span
              aria-hidden
              className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[2px] bg-[color:var(--accent-500,#1D6FE8)] rounded-r-sm"
            />
          )}
          <Icon size={16} className="shrink-0" aria-hidden />
          {!collapsed && <span className="truncate">{item.label}</span>}
        </>
      )}
    </NavLink>
  );

  if (!collapsed) return link;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right" sideOffset={8}>
        {item.label}
      </TooltipContent>
    </Tooltip>
  );
}

function SidebarFooter({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  const button = (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        'flex items-center h-9 mx-2 mb-2 rounded-md text-sm transition-colors',
        'text-[color:var(--text-muted,#71717A)] hover:text-[color:var(--text-primary,#E5E7EB)]',
        'hover:bg-[color:var(--elevated,#1A1E24)]',
        collapsed ? 'justify-center px-0' : 'px-3 gap-3 justify-start',
      )}
      aria-label={collapsed ? 'Sidebar ausklappen' : 'Sidebar einklappen'}
    >
      {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
      {!collapsed && <span>Einklappen</span>}
      {!collapsed && (
        <kbd className="ml-auto font-mono text-[10px] text-[color:var(--text-muted,#71717A)] border border-[color:var(--border,#252A31)] rounded-sm px-1">
          ⌘\
        </kbd>
      )}
    </button>
  );

  return (
    <div className="border-t border-[color:var(--border,#252A31)] py-2 shrink-0">
      {collapsed ? (
        <Tooltip>
          <TooltipTrigger asChild>{button}</TooltipTrigger>
          <TooltipContent side="right" sideOffset={8}>
            Sidebar ausklappen ( ⌘\ )
          </TooltipContent>
        </Tooltip>
      ) : (
        button
      )}
    </div>
  );
}

/** Re-export for tests / route helpers. */
export const ADMIN_NAV_SECTIONS: ReadonlyArray<NavSection> = NAV_SECTIONS;
export type { NavItem, NavSection };

// Avoid unused-import warning for ReactNode if reused
export type AdminSidebarChildren = ReactNode;
