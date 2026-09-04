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

import { useCallback, useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  Building2,
  Calendar,
  KeyRound,
  LayoutDashboard,
  Mail,
  MessageSquareText,
  NotebookPen,
  PanelLeftClose,
  PanelLeftOpen,
  Rocket,
  Search,
  Send,
  Settings,
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
import { usePermissions } from '@/auth/usePermissions';
import { useSystemHealth } from '@/hooks/useSystemHealth';

const STORAGE_KEY = 'pu.admin.sidebar.collapsed.v1';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
  /** Only shown to SUPER_ADMIN — route is also SUPER_ADMIN-guarded. */
  superAdmin?: boolean;
}

interface NavSection {
  id: string;
  label: string;
  items: NavItem[];
}

/**
 * Die Navigation trägt nur noch das Tagesgeschäft.
 *
 * Alles, was selten oder nur zur Verwaltung gebraucht wird — Admins, Audit-Log,
 * Support-Konsole, Postfach-Rechte, Wartung — liegt unter /einstellungen.
 * Eine Leiste mit dreizehn Einträgen ist keine Navigation mehr, sondern eine
 * Liste, in der man sucht.
 *
 * Das Mailsystem steht bewusst NICHT hier: es läuft als eigenständige
 * Vollbild-Anwendung unter /mail, außerhalb dieses Rahmens.
 */
const NAV_SECTIONS: NavSection[] = [
  {
    id: 'top',
    label: 'Übersicht',
    items: [
      { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
      { to: '/calendar', label: 'Kalender', icon: Calendar },
      { to: '/notizen', label: 'Notizen', icon: NotebookPen },
      { to: '/feedback', label: 'Feedback', icon: MessageSquareText },
    ],
  },
  {
    id: 'kunden',
    label: 'Kunden',
    items: [
      { to: '/tenants', label: 'Kundenliste', icon: Building2 },
      { to: '/onboarding', label: 'Onboarding', icon: Rocket },
      { to: '/access-requests', label: 'Zugänge beantragen', icon: KeyRound },
    ],
  },
  {
    id: 'werkzeuge',
    label: 'Werkzeuge',
    items: [
      { to: '/mail', label: 'E-Mail', icon: Mail },
      { to: '/oem-finder', label: 'OEM-Finder', icon: Search },
      { to: '/outreach', label: 'Outreach', icon: Send },
    ],
  },
  {
    id: 'system',
    label: 'System',
    items: [
      { to: '/einstellungen', label: 'Einstellungen', icon: Settings },
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
        // Redesign: durchscheinende Verlaufsflaeche statt deckendem Grau. Die
        // Leiste sitzt damit auf dem Lichtverlauf der Seite, statt ihn zu
        // verdecken.
        'border-r border-border-subtle',
        'bg-gradient-to-b from-overlay/[0.028] to-overlay/[0.006]',
        'transition-[width] duration-200 ease-out',
        collapsed ? 'w-16' : 'w-64',
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
          className="w-64 p-0 bg-surface border-r border-border-subtle"
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

/**
 * Markenblock nach dem Redesign: Verlaufsquadrat, daneben Name und
 * "ADMIN CONSOLE" in Versalien.
 *
 * Im Quadrat steht UNSER Symbol, nicht das gezeichnete "P" des Entwurfs. Die
 * Geometrie ist die des Entwurfs (32 px, 9 px Radius, Akzentverlauf), der
 * Inhalt ist die echte Marke.
 *
 * Warum die weisse Ausstanzung und nicht das farbige Logo: das Markenblau
 * (#2260cd) auf dem Akzentverlauf ergibt keinen Kontrast — Blau auf Blau. Auf
 * farbigem Grund nimmt man die einfarbige Fassung, das ist bei jeder Marke so.
 * Die Datei ist aus der Wortmarke freigestellt, nicht nachgezeichnet.
 */
function SidebarBrand({ collapsed }: { collapsed: boolean }) {
  return (
    <div
      className={cn(
        'flex shrink-0 items-center gap-2.5 px-4 pb-4 pt-5',
        collapsed && 'justify-center px-0',
      )}
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-[9px] bg-gradient-to-br from-accent-500 to-accent-700">
        <img
          src="/partsunion-symbol-weiss.png"
          alt="Partsunion"
          width={19}
          height={19}
          className="size-[19px]"
        />
      </span>
      {!collapsed && (
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate font-display text-sm font-bold tracking-[0.02em] text-text-primary">
            Partsunion
          </span>
          <span className="font-mono text-[9px] font-semibold tracking-[0.18em] text-accent-500">
            ADMIN CONSOLE
          </span>
        </span>
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
  const { isSuperAdmin } = usePermissions();
  // Hide SUPER_ADMIN-only entries from non-super admins so they don't click a
  // link that dead-ends at the 403 ForbiddenView (the route guard still enforces it).
  const sections = NAV_SECTIONS
    .map((section) => ({
      ...section,
      items: section.items.filter((it) => !it.superAdmin || isSuperAdmin),
    }))
    .filter((section) => section.items.length > 0);
  return (
    <nav className="flex-1 overflow-y-auto px-0 pb-3 pt-1.5" aria-label="Navigation">
      {sections.map((section) => (
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
    <div className="mb-5">
      {!collapsed && (
        <div className="mb-2 px-[22px] font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-text-muted">
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
          // Redesign: 10 px Radius, Manrope halbfett, durchscheinende
          // Auflage beim Ueberfahren statt deckender Flaeche.
          'group relative mx-3 flex items-center rounded-[10px] text-[12.5px] font-semibold transition-colors',
          'py-[9px]',
          'text-text-tertiary',
          'hover:bg-overlay/[0.05] hover:text-text-primary',
          collapsed ? 'justify-center px-0' : 'gap-[11px] px-[11px]',
          // Aktiv: waagerechter Akzentverlauf, der nach rechts ausläuft — plus
          // der 2-px-Balken am linken Rand (unten als Element, nicht als
          // inset-Schatten: der wuerde beim Radius mitgerundet).
          isActive &&
            // text-text-primary, NICHT text-white: der Verlauf ist
            // durchscheinend, und im Hellmodus wäre weisse Schrift darauf
            // unsichtbar. Am Bild nachgemessen.
            'bg-gradient-to-r from-accent-500/[0.16] via-accent-500/[0.03] to-transparent text-text-primary',
        )
      }
    >
      {({ isActive }) => (
        <>
          {/* 2px Sharp Accent-Bar bei active */}
          {isActive && (
            <span
              aria-hidden
              className="absolute inset-y-0 left-0 w-[2px] rounded-r-full bg-accent-500"
            />
          )}
          <Icon
            size={16}
            className={cn('shrink-0 transition-colors', isActive ? 'text-accent-500' : 'text-text-faint group-hover:text-text-tertiary')}
            aria-hidden
          />
          {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
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
        'flex w-full items-center rounded-lg py-1.5 text-xs font-semibold transition-colors',
        'text-text-muted hover:text-text-primary',
        collapsed ? 'justify-center px-0' : 'justify-start gap-2 px-1',
      )}
      aria-label={collapsed ? 'Sidebar ausklappen' : 'Sidebar einklappen'}
    >
      {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
      {!collapsed && <span>Einklappen</span>}
      {!collapsed && (
        <kbd className="ml-auto rounded-[5px] bg-overlay/[0.05] px-1.5 py-[3px] font-mono text-[10px] font-medium text-text-muted">
          ⌘\
        </kbd>
      )}
    </button>
  );

  return (
    <div className="shrink-0 border-t border-border-subtle p-3.5">
      {!collapsed && <SidebarStatus />}
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

/**
 * Statusfeld der Vorlage.
 *
 * Zwei Abweichungen von der Vorlage, beide mit Absicht:
 *
 * 1. KEINE "99,98 %". Das war eine Zahl im Entwurf, die niemand berechnet. Eine
 *    erfundene Verfügbarkeit ist im Betrieb schlimmer als keine — man verlässt
 *    sich darauf. Sie kommt, sobald es einen Messwert dafür gibt.
 * 2. Der Zustand ist nicht fest "normal", sondern kommt aus /health. Ein
 *    Statusfeld, das immer grün leuchtet, ist eine Lampe ohne Kabel.
 */
function SidebarStatus() {
    const { zustand: lebenszeichen, isLoading } = useSystemHealth();

    /**
     * Nur noch EINE Aussage, weil nur eine belegbar ist.
     *
     * Hier standen drei Einzelampeln fuer Datenbank, Redis und Warteschlange.
     * Die Adresse dahinter (`/api/admin/health`) gab es nie — die Anzeige
     * stand deshalb dauerhaft auf "Status wird geprueft". Erreichbar ist von
     * aussen allein `/health/live`, und das liefert ein Lebenszeichen, sonst
     * nichts. Aus einem Lebenszeichen drei Einzelampeln abzuleiten waere die
     * Lampe ohne Kabel, vor der der Kommentar oben warnt.
     */
    const stufe = isLoading && !lebenszeichen
        ? 'unbekannt'
        : lebenszeichen?.erreichbar
            ? 'ok'
            : 'gestoert';

    const farben = {
        ok: 'border-success/[0.16] bg-success/[0.06] text-success',
        gestoert: 'border-danger/20 bg-danger/[0.07] text-danger',
        unbekannt: 'border-border-subtle bg-overlay/[0.03] text-text-muted',
    }[stufe];

    const text = {
        ok: 'API erreichbar',
        gestoert: 'API nicht erreichbar',
        unbekannt: 'Status wird geprüft',
    }[stufe];

    const punkt = {
        ok: 'bg-success shadow-[0_0_10px_hsl(var(--success))] motion-safe:animate-pulse',
        gestoert: 'bg-danger shadow-[0_0_10px_hsl(var(--danger))] motion-safe:animate-pulse',
        unbekannt: 'bg-text-faint',
    }[stufe];

  return (
    <div
      className={cn('mb-2.5 flex items-center gap-2.5 rounded-[11px] border px-3 py-2.5', farben)}
      role="status"
    >
      <span aria-hidden className={cn('size-[7px] shrink-0 rounded-full', punkt)} />
      <span className="flex-1 text-[11px] font-semibold leading-tight">{text}</span>
    </div>
  );
}

/** Re-export for tests / route helpers. */
export const ADMIN_NAV_SECTIONS: ReadonlyArray<NavSection> = NAV_SECTIONS;
export type { NavItem, NavSection };
