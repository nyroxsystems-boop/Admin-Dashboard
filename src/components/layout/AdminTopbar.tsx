/**
 * AdminTopbar — 56px Topbar with breadcrumb, quick-actions, ⌘K trigger,
 * notifications, theme toggle, user menu.
 *
 * Adapted from User-Dashboard `layout/TopbarV2.tsx` for Admin context.
 */

import { Fragment, useEffect, useState, type ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Bell,
  ChevronRight,
  Command as CommandIcon,
  LogOut,
  Menu,
  Moon,
  Plus,
  Settings,
  ShieldCheck,
  Sun,
  TerminalSquare,
  User as UserIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/context/AuthContext';
import { useNotifications } from '@/hooks/useNotifications';
import type { Admin } from '@/api/types';

const ROUTE_LABELS: Record<string, string> = {
  '': 'Dashboard',
  tenants: 'Tenants',
  admins: 'Admins',
  audit: 'Audit Log',
  oem: 'OEM',
  registry: 'Registry',
  lookup: 'Lookup',
  batch: 'Batch Test',
  errors: 'Errors',
  accuracy: 'Accuracy',
  bot: 'Bot',
  testing: 'Testing',
  inbox: 'Inbox',
  orders: 'Orders',
  scraper: 'Bulk Scraper',
  maintenance: 'Maintenance',
  settings: 'Settings',
  profile: 'Profile',
};

function humanize(segment: string): string {
  return ROUTE_LABELS[segment] ?? segment.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

interface BreadcrumbCrumb {
  label: string;
  to: string;
  isLast: boolean;
}

function buildBreadcrumbs(pathname: string): BreadcrumbCrumb[] {
  const parts = pathname.split('/').filter(Boolean);
  if (parts.length === 0) {
    return [{ label: 'Dashboard', to: '/', isLast: true }];
  }
  const crumbs: BreadcrumbCrumb[] = [{ label: 'Dashboard', to: '/', isLast: false }];
  let acc = '';
  parts.forEach((seg, idx) => {
    acc += `/${seg}`;
    crumbs.push({
      label: humanize(seg),
      to: acc,
      isLast: idx === parts.length - 1,
    });
  });
  return crumbs;
}

export interface AdminTopbarProps {
  /** Trigger when user opens command palette (⌘K). */
  onOpenCommandPalette?: () => void;
  /** Trigger to toggle the mobile sidebar (hamburger). */
  onOpenMobileSidebar?: () => void;
  /** Optional slot for tenant-specific quick actions. */
  rightSlot?: ReactNode;
  className?: string;
}

export function AdminTopbar({
  onOpenCommandPalette,
  onOpenMobileSidebar,
  rightSlot,
  className,
}: AdminTopbarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const crumbs = buildBreadcrumbs(location.pathname);
  const { unread } = useNotifications();
  const { user, logout } = useAuth();

  const handleLogout = async (): Promise<void> => {
    await logout();
  };

  return (
    <header
      className={cn(
        'flex items-center h-14 px-3 md:px-4 gap-2 sticky top-0 z-30',
        'bg-[color:var(--surface,#111418)] border-b border-[color:var(--border,#252A31)]',
        className,
      )}
      role="banner"
    >
      {/* Mobile: hamburger */}
      <button
        type="button"
        onClick={onOpenMobileSidebar}
        className="md:hidden inline-flex items-center justify-center w-9 h-9 rounded-md text-[color:var(--text-secondary,#A1A1AA)] hover:text-[color:var(--text-primary,#E5E7EB)] hover:bg-[color:var(--elevated,#1A1E24)]"
        aria-label="Navigation öffnen"
      >
        <Menu size={18} />
      </button>

      <Breadcrumbs crumbs={crumbs} />

      <div className="flex-1" />

      {/* Quick-Action Pills (hidden on small screens) */}
      <div className="hidden lg:flex items-center gap-1.5">
        <QuickAction
          icon={<Plus size={14} />}
          label="New Tenant"
          onClick={() => navigate('/tenants/new')}
        />
        <QuickAction
          icon={<TerminalSquare size={14} />}
          label="Run Seeder"
          onClick={() => onOpenCommandPalette?.()}
        />
        <QuickAction
          icon={<ShieldCheck size={14} />}
          label="System Health"
          onClick={() => navigate('/maintenance')}
        />
      </div>

      <CommandTrigger onClick={onOpenCommandPalette} />
      <NotificationsBell unread={unread} />
      <ThemeToggle />
      <UserMenu user={user} onLogout={handleLogout} />

      {rightSlot}
    </header>
  );
}

function Breadcrumbs({ crumbs }: { crumbs: BreadcrumbCrumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="hidden sm:flex items-center min-w-0">
      <ol className="flex items-center gap-1 text-sm min-w-0">
        {crumbs.map((c, i) => (
          <Fragment key={`${c.to}-${i}`}>
            {i > 0 && (
              <ChevronRight
                size={14}
                className="text-[color:var(--text-muted,#71717A)] shrink-0"
                aria-hidden
              />
            )}
            <li className={cn('truncate max-w-[180px]', c.isLast && 'font-medium')}>
              {c.isLast ? (
                <span
                  aria-current="page"
                  className="text-[color:var(--text-primary,#E5E7EB)]"
                >
                  {c.label}
                </span>
              ) : (
                <Link
                  to={c.to}
                  className="text-[color:var(--text-secondary,#A1A1AA)] hover:text-[color:var(--text-primary,#E5E7EB)] transition-colors"
                >
                  {c.label}
                </Link>
              )}
            </li>
          </Fragment>
        ))}
      </ol>
    </nav>
  );
}

function QuickAction({
  icon,
  label,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  onClick?: () => void;
}) {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={onClick}
      className="h-8 px-2.5 gap-1.5 text-xs font-medium"
    >
      {icon}
      {label}
    </Button>
  );
}

function CommandTrigger({ onClick }: { onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-2 h-8 px-2.5 rounded-md',
        'border border-[color:var(--border,#252A31)] bg-[color:var(--canvas,#0A0B0D)]',
        'text-xs text-[color:var(--text-muted,#71717A)] hover:text-[color:var(--text-primary,#E5E7EB)]',
        'hover:border-[color:var(--border-strong,#3A4049)] transition-colors',
      )}
      aria-label="Befehlspalette öffnen"
    >
      <span className="hidden md:inline">Suche…</span>
      <kbd className="hidden md:inline-flex items-center gap-0.5 font-mono text-[10px]">
        <CommandIcon size={10} /> K
      </kbd>
      <CommandIcon size={14} className="md:hidden" />
    </button>
  );
}

function NotificationsBell({ unread }: { unread: number }) {
  return (
    <button
      type="button"
      className="relative inline-flex items-center justify-center w-9 h-9 rounded-md text-[color:var(--text-secondary,#A1A1AA)] hover:text-[color:var(--text-primary,#E5E7EB)] hover:bg-[color:var(--elevated,#1A1E24)] transition-colors"
      aria-label={unread > 0 ? `${unread} ungelesene Benachrichtigungen` : 'Benachrichtigungen'}
    >
      <Bell size={16} />
      {unread > 0 && (
        <span
          aria-hidden
          className="absolute top-1.5 right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-[color:var(--accent-500,#1D6FE8)] text-[9px] font-mono font-semibold text-white flex items-center justify-center"
        >
          {unread > 99 ? '99+' : unread}
        </span>
      )}
    </button>
  );
}

const THEME_KEY = 'pu.admin.theme.v1';
type Theme = 'dark' | 'light';

function readTheme(): Theme {
  if (typeof window === 'undefined') return 'dark';
  try {
    const v = window.localStorage.getItem(THEME_KEY);
    if (v === 'light' || v === 'dark') return v;
  } catch {
    /* noop */
  }
  return 'dark';
}

function applyTheme(theme: Theme) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.classList.toggle('dark', theme === 'dark');
  root.dataset.theme = theme;
}

function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(() => readTheme());

  useEffect(() => {
    applyTheme(theme);
    try {
      window.localStorage.setItem(THEME_KEY, theme);
    } catch {
      /* noop */
    }
  }, [theme]);

  const isDark = theme === 'dark';
  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className="inline-flex items-center justify-center w-9 h-9 rounded-md text-[color:var(--text-secondary,#A1A1AA)] hover:text-[color:var(--text-primary,#E5E7EB)] hover:bg-[color:var(--elevated,#1A1E24)] transition-colors duration-200"
      aria-label={isDark ? 'Light Mode aktivieren' : 'Dark Mode aktivieren'}
    >
      {isDark ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}

function UserMenu({
  user,
  onLogout,
}: {
  user: Admin | null;
  onLogout: () => void | Promise<void>;
}) {
  const displayName = user?.username ?? 'Admin';
  const initials = user
    ? displayName
        .split(/[\s._-]+/)
        .filter(Boolean)
        .map((p) => p[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : 'AD';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center justify-center w-9 h-9 rounded-md bg-[color:var(--elevated,#1A1E24)] text-[color:var(--text-primary,#E5E7EB)] text-xs font-semibold hover:ring-2 hover:ring-[color:var(--accent-500,#1D6FE8)]/40 transition-all"
          aria-label="Benutzermenü"
        >
          {initials}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="w-56">
        <DropdownMenuLabel className="flex flex-col">
          <span className="text-sm font-medium">{displayName}</span>
          <span className="text-xs text-[color:var(--text-muted,#71717A)]">
            {user?.email ?? 'nicht angemeldet'}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/profile" className="flex items-center gap-2 cursor-pointer">
            <UserIcon size={14} /> Profil
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/" className="flex items-center gap-2 cursor-pointer">
            <Settings size={14} /> Einstellungen
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={(event) => {
            event.preventDefault();
            void onLogout();
          }}
          className="flex items-center gap-2 text-[color:var(--danger-500,#F87171)] focus:text-[color:var(--danger-500,#F87171)]"
        >
          <LogOut size={14} /> Abmelden
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
