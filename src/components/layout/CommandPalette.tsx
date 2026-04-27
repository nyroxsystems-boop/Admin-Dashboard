/**
 * CommandPalette — Globale ⌘K-Suche für das Admin-Dashboard.
 *
 *  - cmdk-Library Integration (Fuzzy-Search, Keyboard-Navigation)
 *  - Kategorien: "Navigation", "Aktionen"
 *  - Recent-Items in localStorage `pu.admin.recent`
 *  - Globaler ⌘K / Ctrl+K Handler
 *  - Backdrop + ESC zum Schließen
 *
 * Adapted from User-Dashboard `ui-v2/CommandPaletteV2.tsx`.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { Command } from 'cmdk';
import {
  AlertCircle,
  ArrowRight,
  Bot,
  Building2,
  Clock,
  Command as CommandIcon,
  Database,
  Inbox,
  LayoutDashboard,
  Plus,
  Power,
  ScrollText,
  Search,
  ShoppingCart,
  Spline,
  Target,
  TerminalSquare,
  TestTubes,
  Users,
  Wrench,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { triggerOemSeeder } from '@/api/oem';
import { getMaintenanceState, setMaintenanceState } from '@/api/maintenance';
import { parseError } from '@/api/client';

const RECENT_KEY = 'pu.admin.recent';
const MAX_RECENT = 5;

interface CmdItem {
  id: string;
  label: string;
  hint?: string;
  keywords?: string[];
  icon?: ReactNode;
  group: 'Navigation' | 'Aktionen';
  onSelect: () => void;
  disabled?: boolean;
}

function safeRead(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((s): s is string => typeof s === 'string') : [];
  } catch {
    return [];
  }
}

function safeWrite(value: string[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(value));
  } catch {
    /* noop */
  }
}

export interface CommandPaletteProps {
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  /** Override or extend with custom commands (e.g. context-specific). */
  extraItems?: CmdItem[];
  className?: string;
}

export function CommandPalette({
  open,
  onOpen,
  onClose,
  extraItems = [],
  className,
}: CommandPaletteProps) {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [recentIds, setRecentIds] = useState<string[]>(() => safeRead());

  // Reset query on close
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!open) setSearch('');
  }, [open]);

  // Global ⌘K / Ctrl+K
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (open) onClose();
        else onOpen();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onOpen, onClose]);

  const runSeeder = useCallback(async (): Promise<void> => {
    if (
      typeof window !== 'undefined' &&
      !window.confirm('OEM-Seeder jetzt starten? Das kann mehrere Minuten dauern.')
    ) {
      return;
    }
    await toast.promise(triggerOemSeeder(), {
      loading: 'OEM-Seeder läuft…',
      success: (r) => `Seeder gestartet: ${r.message ?? r.jobId ?? 'OK'}`,
      error: (e) => `Seeder-Fehler: ${parseError(e).message}`,
    });
  }, []);

  const toggleMaintenance = useCallback(async (): Promise<void> => {
    let current;
    try {
      current = await getMaintenanceState();
    } catch {
      toast.error('Wartungsstatus konnte nicht geladen werden');
      return;
    }
    const next = !current.enabled;
    await toast.promise(
      setMaintenanceState({
        enabled: next,
        message: next ? 'Wartungsmodus aktiv' : undefined,
      }),
      {
        loading: 'Setze Wartungsmodus…',
        success: () => `Wartungsmodus: ${next ? 'AN' : 'AUS'}`,
        error: (e) => `Fehler: ${parseError(e).message}`,
      },
    );
  }, []);

  const items = useMemo<CmdItem[]>(() => {
    const nav = (
      to: string,
      label: string,
      icon: ReactNode,
      keywords?: string[],
    ): CmdItem => ({
      id: `nav:${to}`,
      label,
      group: 'Navigation',
      icon,
      keywords,
      onSelect: () => navigate(to),
    });

    return [
      nav('/', 'Dashboard', <LayoutDashboard size={14} />, ['home', 'übersicht']),
      nav('/tenants', 'Tenants', <Building2 size={14} />, ['kunden', 'mandanten']),
      nav('/admins', 'Admins', <Users size={14} />),
      nav('/audit', 'Audit Log', <ScrollText size={14} />, ['log', 'historie']),
      nav('/oem/registry', 'OEM Registry', <Database size={14} />),
      nav('/oem/lookup', 'OEM Lookup', <Search size={14} />),
      nav('/oem/batch', 'OEM Batch Test', <TestTubes size={14} />),
      nav('/oem/errors', 'OEM Errors', <AlertCircle size={14} />),
      nav('/oem/accuracy', 'OEM Accuracy', <Target size={14} />),
      nav('/bot/testing', 'Bot Testing', <Bot size={14} />),
      nav('/inbox', 'Inbox', <Inbox size={14} />),
      nav('/orders', 'Orders', <ShoppingCart size={14} />),
      nav('/scraper', 'Bulk Scraper', <Spline size={14} />),
      nav('/maintenance', 'Maintenance', <Wrench size={14} />),

      {
        id: 'action:new-tenant',
        label: 'Neuen Tenant anlegen',
        hint: 'CREATE',
        group: 'Aktionen',
        icon: <Plus size={14} />,
        keywords: ['add', 'create', 'mandant'],
        onSelect: () => navigate('/tenants/new'),
      },
      {
        id: 'action:run-seeder',
        label: 'Seeder ausführen',
        hint: 'OPS',
        group: 'Aktionen',
        icon: <TerminalSquare size={14} />,
        keywords: ['db', 'seed', 'fixtures'],
        onSelect: () => {
          void runSeeder();
        },
      },
      {
        id: 'action:toggle-maintenance',
        label: 'Maintenance-Modus umschalten',
        hint: 'OPS',
        group: 'Aktionen',
        icon: <Power size={14} />,
        keywords: ['wartung', 'downtime'],
        onSelect: () => {
          void toggleMaintenance();
        },
      },
      ...extraItems,
    ];
  }, [navigate, extraItems, runSeeder, toggleMaintenance]);

  const recordRecent = useCallback((id: string) => {
    setRecentIds((prev) => {
      const next = [id, ...prev.filter((x) => x !== id)].slice(0, MAX_RECENT);
      safeWrite(next);
      return next;
    });
  }, []);

  const handleSelect = useCallback(
    (item: CmdItem) => {
      if (item.disabled) return;
      recordRecent(item.id);
      onClose();
      queueMicrotask(() => item.onSelect());
    },
    [onClose, recordRecent],
  );

  const groups = useMemo(() => {
    const map = new Map<string, CmdItem[]>();
    for (const item of items) {
      const list = map.get(item.group) ?? [];
      list.push(item);
      map.set(item.group, list);
    }
    return Array.from(map.entries());
  }, [items]);

  const recentItems = useMemo(() => {
    if (recentIds.length === 0 || search.trim()) return [];
    return recentIds
      .map((id) => items.find((i) => i.id === id))
      .filter((i): i is CmdItem => Boolean(i));
  }, [recentIds, items, search]);

  if (!open) return null;

  return (
    <div
      className={cn(
        'fixed inset-0 z-50 flex items-start justify-center pt-[15vh]',
        'bg-black/60 backdrop-blur-sm',
        className,
      )}
      onClick={onClose}
      role="presentation"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={cn(
          'w-[640px] max-w-[92vw] bg-[color:var(--surface,#111418)]',
          'border border-[color:var(--border,#252A31)] rounded-md shadow-2xl overflow-hidden',
        )}
      >
        <Command label="Command Palette" shouldFilter loop className="flex flex-col max-h-[60vh]">
          <div className="flex items-center gap-2 px-4 h-12 border-b border-[color:var(--border,#252A31)]">
            <Search size={16} className="text-[color:var(--text-muted,#71717A)] shrink-0" aria-hidden />
            <Command.Input
              value={search}
              onValueChange={setSearch}
              placeholder="Suche nach Aktion, Seite, Tenant…"
              autoFocus
              className="flex-1 bg-transparent outline-none text-sm text-[color:var(--text-primary,#E5E7EB)] placeholder:text-[color:var(--text-muted,#71717A)]"
            />
            <kbd className="hidden sm:inline-flex items-center gap-0.5 font-mono text-[10px] text-[color:var(--text-muted,#71717A)] border border-[color:var(--border,#252A31)] rounded-sm px-1.5 py-0.5">
              <CommandIcon size={10} /> K
            </kbd>
          </div>

          <Command.List className="flex-1 overflow-y-auto py-2">
            <Command.Empty className="px-4 py-8 text-center text-sm text-[color:var(--text-muted,#71717A)]">
              Keine Treffer.
            </Command.Empty>

            {recentItems.length > 0 && (
              <Command.Group
                heading="Zuletzt verwendet"
                className="[&_[cmdk-group-heading]]:px-4 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-[color:var(--text-muted,#71717A)]"
              >
                {recentItems.map((item) => (
                  <Row key={`recent-${item.id}`} item={item} recent onSelect={() => handleSelect(item)} />
                ))}
              </Command.Group>
            )}

            {groups.map(([groupLabel, groupItems]) => (
              <Command.Group
                key={groupLabel}
                heading={groupLabel}
                className="[&_[cmdk-group-heading]]:px-4 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-[color:var(--text-muted,#71717A)]"
              >
                {groupItems.map((item) => (
                  <Row key={item.id} item={item} onSelect={() => handleSelect(item)} />
                ))}
              </Command.Group>
            ))}
          </Command.List>

          <div className="flex items-center justify-between px-4 h-9 border-t border-[color:var(--border,#252A31)] text-[10px] text-[color:var(--text-muted,#71717A)]">
            <span className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <kbd className="font-mono border border-[color:var(--border,#252A31)] rounded-sm px-1">↑↓</kbd>
                navigieren
              </span>
              <span className="flex items-center gap-1">
                <kbd className="font-mono border border-[color:var(--border,#252A31)] rounded-sm px-1">↵</kbd>
                auswählen
              </span>
              <span className="flex items-center gap-1">
                <kbd className="font-mono border border-[color:var(--border,#252A31)] rounded-sm px-1">Esc</kbd>
                schließen
              </span>
            </span>
            <span className="font-mono uppercase tracking-wider">PARTSUNION ADMIN</span>
          </div>
        </Command>
      </div>
    </div>
  );
}

interface RowProps {
  item: CmdItem;
  onSelect: () => void;
  recent?: boolean;
}

function Row({ item, onSelect, recent }: RowProps) {
  return (
    <Command.Item
      value={[item.id, item.label, ...(item.keywords ?? [])].join(' ')}
      disabled={item.disabled}
      onSelect={onSelect}
      className={cn(
        'group flex items-center gap-3 px-4 py-2 cursor-pointer text-sm',
        'text-[color:var(--text-secondary,#A1A1AA)]',
        'aria-selected:bg-[color:var(--elevated,#1A1E24)] aria-selected:text-[color:var(--text-primary,#E5E7EB)]',
        'data-[disabled]:opacity-40 data-[disabled]:cursor-not-allowed',
      )}
    >
      <span className="flex items-center justify-center w-5 h-5 shrink-0 text-[color:var(--text-muted,#71717A)] group-aria-selected:text-[color:var(--accent-500,#1D6FE8)]">
        {recent ? <Clock size={14} /> : item.icon ?? <ArrowRight size={14} />}
      </span>
      <span className="flex-1 min-w-0 truncate">{item.label}</span>
      {item.hint && (
        <span className="font-mono text-[10px] text-[color:var(--text-muted,#71717A)] shrink-0 uppercase tracking-wider">
          {item.hint}
        </span>
      )}
    </Command.Item>
  );
}
