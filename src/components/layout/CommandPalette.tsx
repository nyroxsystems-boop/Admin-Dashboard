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
  Activity,
  ArrowRight,
  Bot,
  Building2,
  Boxes,
  Clock,
  Command as CommandIcon,
  Headset,
  Inbox,
  KeyRound,
  LayoutDashboard,
  MessageSquareText,
  Megaphone,
  NotebookPen,
  Plus,
  Power,
  ScrollText,
  Search,
  ShoppingCart,
  Users,
  Workflow,
  Wrench,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { getMaintenanceState, setMaintenanceState } from '@/api/maintenance';
import { parseError } from '@/api/client';
import { usePermissions } from '@/auth/usePermissions';
import { useGlobalSearch } from '@/hooks/useGlobalSearch';

const RECENT_KEY = 'pu.admin.recent';
const MAX_RECENT = 5;

interface CmdItem {
  id: string;
  label: string;
  hint?: string;
  keywords?: string[];
  icon?: ReactNode;
  group: 'Navigation' | 'Aktionen' | 'Suchergebnisse';
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
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [recentIds, setRecentIds] = useState<string[]>(() => safeRead());
  const { can, isSuperAdmin } = usePermissions();
  const canCreateTenants = can('tenants.create');

  // Reset query on close
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!open) setSearch('');
  }, [open]);

  // P1.5: Query entprellen, bevor die globale Backend-Suche feuert.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 200);
    return () => clearTimeout(t);
  }, [search]);

  const { results: searchResults } = useGlobalSearch(open ? debouncedSearch : '');

  // Global ⌘K / Ctrl+K
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (open && e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (open) onClose();
        else onOpen();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onOpen, onClose]);

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
      setMaintenanceState({ enabled: next }),
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
      nav('/tenants', 'Kunden', <Building2 size={14} />, ['kunden', 'mandanten', 'tenants', 'händler']),
      nav('/access-requests', 'Zugänge beantragen', <KeyRound size={14} />, ['großhändler', 'tecdoc', 'zugang', 'zugänge', 'access', 'lieferant']),
      nav('/calendar', 'Kalender', <LayoutDashboard size={14} />, ['termine', 'kalender']),
      nav('/notizen', 'Notizen', <NotebookPen size={14} />, ['notizen', 'ideen', 'intern']),
      nav('/feedback', 'Feedback', <MessageSquareText size={14} />, ['feedback', 'verbesserung', 'rückmeldung', 'nutzer']),
      nav('/onboarding', 'Onboarding', <Building2 size={14} />, ['onboarding', 'einrichtung']),
      nav('/mail', 'E-Mail', <Inbox size={14} />, ['mail', 'posteingang', 'inbox', 'nachrichten']),
      nav('/oem-finder', 'OEM-Finder', <Workflow size={14} />, ['oem', 'teile', 'nummer']),
      nav('/marketing', 'Marketing-Zentrale', <Megaphone size={14} />, ['google ads', 'meta ads', 'statistik', 'website', 'kampagnen']),
      nav('/erp', 'ERP & Warenwirtschaft', <Boxes size={14} />, ['erp', 'wawi', 'lager', 'bestand', 'einkauf', 'rechnungen', 'forderungen']),

      // Einstellungen — die Bereiche sind einzeln auffindbar, damit man sie
      // nicht erst über die Sammelseite suchen muss.
      nav('/einstellungen', 'Einstellungen', <Wrench size={14} />, ['einstellungen', 'settings']),
      nav('/einstellungen', 'Profil & Signatur', <Users size={14} />, ['signatur', 'profil', 'account']),
      ...(isSuperAdmin ? [nav('/einstellungen/admins', 'Admins', <Users size={14} />)] : []),
      ...(isSuperAdmin ? [nav('/einstellungen/postfaecher', 'Postfach-Rechte', <KeyRound size={14} />, ['postfach', 'rechte', 'broschüre'])] : []),
      nav('/einstellungen/support', 'Support-Konsole', <Headset size={14} />, ['support', 'hilfe', 'händler', 'chats', 'probleme']),
      nav('/einstellungen/audit', 'Audit-Log', <ScrollText size={14} />, ['log', 'historie']),
      ...(isSuperAdmin ? [nav('/einstellungen/wartung', 'Wartung', <Wrench size={14} />, ['maintenance', 'wartung'])] : []),

      // Nicht in der Seitenleiste, aber im Betrieb gebraucht — genau dafür ist
      // eine Kommandopalette da. "Bestellungen" ist aus 12 Stellen der
      // Anwendung verlinkt, war hier aber als englisches "Orders" beschriftet
      // und damit über den deutschen Namen nicht auffindbar.
      nav('/orders', 'Bestellungen', <ShoppingCart size={14} />, ['orders', 'bestellungen', 'auftraege', 'aufträge']),
      nav('/oe-quality', 'OE-Qualität', <ShoppingCart size={14} />, ['oe', 'qualität']),

      /**
       * Entwicklerwerkzeuge — NUR im Entwicklungsbau.
       *
       * Bot-Test-Lab, E2E-Flow-Runner und Live-Simulation sind Werkzeuge zum
       * Bauen, keine Arbeitsmittel im Betrieb. Nachgesehen: sie sind aus
       * NULL anderen Stellen der Anwendung verlinkt — die Palette war ihr
       * einziger Zugang, und dadurch standen sie im Suchfeld gleichwertig
       * neben "Kunden" und "Kalender". "E2E-Flow-Runner" war sogar der erste
       * Eintrag, den man beim Öffnen sah.
       *
       * Eine Suche zeigt, was man tun KANN. Steht dort etwas, das man nie
       * anklicken soll, ist entweder der Eintrag falsch oder die Suche.
       *
       * Im Entwicklungsbau bleiben sie: dort sind sie genau das Arbeitsmittel,
       * als das sie gedacht waren. Die Routen selbst bleiben unangetastet und
       * sind über die Adresszeile weiterhin erreichbar.
       */
      ...(import.meta.env.DEV
        ? [
            nav('/bot/testing', 'Bot-Test-Lab', <Bot size={14} />, ['bot', 'test', 'simulator']),
            nav('/testing/e2e-runner', 'E2E-Flow-Runner', <Workflow size={14} />, ['e2e', 'flow', 'pipeline', 'runner']),
            nav('/testing/live-sim', 'Live-Simulation', <Activity size={14} />, ['sim', 'simulation', 'händler-tag', 'live']),
          ]
        : []),

      ...(canCreateTenants
        ? [{
            id: 'action:new-tenant',
            label: 'Neuen Kunden anlegen',
            hint: 'CREATE',
            group: 'Aktionen' as const,
            icon: <Plus size={14} />,
            keywords: ['add', 'create', 'mandant', 'kunde', 'tenant'],
            onSelect: () => navigate('/tenants/new'),
          }]
        : []),
      ...(isSuperAdmin
        ? [{
            id: 'action:toggle-maintenance',
            label: 'Maintenance-Modus umschalten',
            hint: 'OPS',
            group: 'Aktionen' as const,
            icon: <Power size={14} />,
            keywords: ['wartung', 'downtime'],
            onSelect: () => {
              void toggleMaintenance();
            },
          }]
        : []),
      ...extraItems,
    ];
  }, [navigate, extraItems, canCreateTenants, isSuperAdmin, toggleMaintenance]);

  // P1.5: globale Suchtreffer als CmdItems. keywords:[search] sorgt dafür, dass
  // cmdk sie NICHT wegfiltert (das Backend hat bereits gefiltert).
  const searchItems = useMemo<CmdItem[]>(
    () =>
      searchResults.map((r) => ({
        id: `search:${r.type}:${r.id}`,
        label: r.label,
        hint: r.type === 'tenant' ? 'HÄNDLER' : 'ORDER',
        group: 'Suchergebnisse' as const,
        icon: r.type === 'tenant' ? <Building2 size={14} /> : <ShoppingCart size={14} />,
        keywords: [search],
        onSelect: () => navigate(`/tenants/${r.tenantId}`),
      })),
    [searchResults, search, navigate],
  );

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
        role="dialog"
        aria-modal="true"
        aria-label="Befehlspalette"
        className={cn(
          'w-[640px] max-w-[92vw] bg-surface',
          'border border-border-subtle rounded-md shadow-2xl overflow-hidden',
        )}
      >
        <Command label="Command Palette" shouldFilter loop className="flex flex-col max-h-[60vh]">
          <div className="flex items-center gap-2 px-4 h-12 border-b border-border-subtle">
            <Search size={16} className="text-text-muted shrink-0" aria-hidden />
            <Command.Input
              value={search}
              onValueChange={setSearch}
              placeholder="Suche nach Aktion, Seite, Kunde…"
              autoFocus
              className="flex-1 bg-transparent outline-none text-sm text-text-primary placeholder:text-text-muted"
            />
            <kbd className="hidden sm:inline-flex items-center gap-0.5 font-mono text-[10px] text-text-muted border border-border-subtle rounded-sm px-1.5 py-0.5">
              <CommandIcon size={10} /> K
            </kbd>
          </div>

          <Command.List className="flex-1 overflow-y-auto py-2">
            <Command.Empty className="px-4 py-8 text-center text-sm text-text-muted">
              Keine Treffer.
            </Command.Empty>

            {searchItems.length > 0 && (
              <Command.Group
                heading="Suchergebnisse"
                className="[&_[cmdk-group-heading]]:px-4 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-text-muted"
              >
                {searchItems.map((item) => (
                  <Row key={item.id} item={item} onSelect={() => handleSelect(item)} />
                ))}
              </Command.Group>
            )}

            {recentItems.length > 0 && (
              <Command.Group
                heading="Zuletzt verwendet"
                className="[&_[cmdk-group-heading]]:px-4 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-text-muted"
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
                className="[&_[cmdk-group-heading]]:px-4 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-text-muted"
              >
                {groupItems.map((item) => (
                  <Row key={item.id} item={item} onSelect={() => handleSelect(item)} />
                ))}
              </Command.Group>
            ))}
          </Command.List>

          <div className="flex items-center justify-between px-4 h-9 border-t border-border-subtle text-[10px] text-text-muted">
            <span className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <kbd className="font-mono border border-border-subtle rounded-sm px-1">↑↓</kbd>
                navigieren
              </span>
              <span className="flex items-center gap-1">
                <kbd className="font-mono border border-border-subtle rounded-sm px-1">↵</kbd>
                auswählen
              </span>
              <span className="flex items-center gap-1">
                <kbd className="font-mono border border-border-subtle rounded-sm px-1">Esc</kbd>
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
        'text-text-secondary',
        'aria-selected:bg-elevated aria-selected:text-text-primary',
        'data-[disabled]:opacity-40 data-[disabled]:cursor-not-allowed',
      )}
    >
      <span className="flex items-center justify-center w-5 h-5 shrink-0 text-text-muted group-aria-selected:text-accent-500">
        {recent ? <Clock size={14} /> : item.icon ?? <ArrowRight size={14} />}
      </span>
      <span className="flex-1 min-w-0 truncate">{item.label}</span>
      {item.hint && (
        <span className="font-mono text-[10px] text-text-muted shrink-0 uppercase tracking-wider">
          {item.hint}
        </span>
      )}
    </Command.Item>
  );
}
