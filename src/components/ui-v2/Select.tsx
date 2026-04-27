/**
 * Select — Radix-basiertes Dropdown.
 *
 * Tastatur:
 *  - Tab / Shift+Tab  → Fokus
 *  - Enter / Space    → Öffnen
 *  - ↑ / ↓            → Navigation
 *  - Type-ahead       → Option per Buchstabe springen
 *  - Escape           → Schließen
 */

import {
  forwardRef,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import { Check, ChevronDown, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SelectOption<T = string> {
  value: T;
  label: string;
  description?: string;
  disabled?: boolean;
}

export interface SelectProps<T = string> {
  options: SelectOption<T>[];
  value?: T;
  onChange?: (value: T) => void;
  placeholder?: string;
  label?: string;
  error?: string;
  disabled?: boolean;
  /** Fügt eine Client-seitige Such-Eingabe hinzu (für lange Listen) */
  searchable?: boolean;
  className?: string;
  id?: string;
  name?: string;
}

/**
 * Eigene Custom-Implementation (ohne @radix-ui/react-select Wrapping für jetzt).
 * Grund: die Radix-Select-API unterscheidet sich semantisch von unserem
 * `SelectOption<T>`-Interface — eine simple, vollständig typ-sichere eigene
 * Implementierung ist hier wartbarer.
 *
 * TODO (Migration, optional): Radix Select falls Screen-Reader-Parität mit
 * nativen Selects strikt erforderlich wird.
 */
export const Select = forwardRef<HTMLButtonElement, SelectProps<string>>(
  (
    {
      options,
      value,
      onChange,
      placeholder = '—',
      label,
      error,
      disabled,
      searchable,
      className,
      id,
      name,
    },
    ref,
  ) => {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [highlight, setHighlight] = useState<number>(-1);
    const containerRef = useRef<HTMLDivElement>(null);
    const listRef = useRef<HTMLUListElement>(null);
    const searchRef = useRef<HTMLInputElement>(null);
    const typeBuffer = useRef<{ text: string; ts: number }>({ text: '', ts: 0 });

    const reactId = id ?? `select-${Math.random().toString(36).slice(2, 9)}`;
    const listboxId = `${reactId}-listbox`;

    const filtered = useMemo(() => {
      if (!searchable || !search.trim()) return options;
      const q = search.trim().toLowerCase();
      return options.filter(
        (o) =>
          o.label.toLowerCase().includes(q) ||
          (o.description?.toLowerCase().includes(q) ?? false),
      );
    }, [options, search, searchable]);

    const selectedOption = options.find((o) => o.value === value);

    // Close on outside click
    useEffect(() => {
      if (!open) return;
      const onDocClick = (e: MouseEvent) => {
        if (!containerRef.current?.contains(e.target as Node)) {
          setOpen(false);
        }
      };
      document.addEventListener('mousedown', onDocClick);
      return () => document.removeEventListener('mousedown', onDocClick);
    }, [open]);

    // Focus search / scroll highlight when opening
    useEffect(() => {
      if (!open) return;
      const idx = options.findIndex((o) => o.value === value);
      setHighlight(idx >= 0 ? idx : 0);
      if (searchable) {
        queueMicrotask(() => searchRef.current?.focus());
      }
    }, [open, options, value, searchable]);

    const commit = (opt: SelectOption<string>) => {
      if (opt.disabled) return;
      onChange?.(opt.value);
      setOpen(false);
      setSearch('');
    };

    const onTriggerKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
      if (disabled) return;
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault();
        setOpen(true);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setOpen(true);
      }
    };

    const moveHighlight = (delta: number) => {
      if (filtered.length === 0) return;
      setHighlight((h) => {
        let next = h;
        for (let i = 0; i < filtered.length; i++) {
          next = (next + delta + filtered.length) % filtered.length;
          if (!filtered[next].disabled) return next;
        }
        return h;
      });
    };

    const onListKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setOpen(false);
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        moveHighlight(1);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        moveHighlight(-1);
      } else if (e.key === 'Home') {
        e.preventDefault();
        setHighlight(0);
      } else if (e.key === 'End') {
        e.preventDefault();
        setHighlight(filtered.length - 1);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const opt = filtered[highlight];
        if (opt) commit(opt);
      } else if (!searchable && e.key.length === 1) {
        // type-ahead
        const now = Date.now();
        const text =
          now - typeBuffer.current.ts < 600
            ? typeBuffer.current.text + e.key.toLowerCase()
            : e.key.toLowerCase();
        typeBuffer.current = { text, ts: now };
        const match = filtered.findIndex(
          (o) => !o.disabled && o.label.toLowerCase().startsWith(text),
        );
        if (match >= 0) setHighlight(match);
      }
    };

    return (
      <div ref={containerRef} className={cn('flex flex-col gap-1.5', className)}>
        {label && (
          <label htmlFor={reactId} className="text-sm text-text-secondary">
            {label}
          </label>
        )}
        <div className="relative">
          <button
            ref={ref}
            id={reactId}
            name={name}
            type="button"
            role="combobox"
            aria-haspopup="listbox"
            aria-expanded={open}
            aria-controls={listboxId}
            aria-invalid={!!error}
            aria-disabled={disabled}
            disabled={disabled}
            onClick={() => !disabled && setOpen((o) => !o)}
            onKeyDown={onTriggerKeyDown}
            className={cn(
              'w-full h-10 px-3 pr-9 rounded-md bg-surface border text-left text-sm',
              'text-text-primary transition-colors',
              'focus:outline-none focus:border-accent-500 focus:ring-1 focus:ring-accent-500',
              error ? 'border-status-danger' : 'border-border-subtle hover:border-border-strong',
              disabled && 'opacity-50 cursor-not-allowed',
            )}
          >
            {selectedOption ? (
              <span className="truncate block">{selectedOption.label}</span>
            ) : (
              <span className="truncate block text-text-muted">{placeholder}</span>
            )}
            <ChevronDown
              size={16}
              className={cn(
                'absolute right-3 top-1/2 -translate-y-1/2 text-text-muted transition-transform',
                open && 'rotate-180',
              )}
              aria-hidden
            />
          </button>

          {open && (
            <div
              onKeyDown={onListKeyDown}
              className={cn(
                'absolute z-dropdown mt-1 w-full min-w-full',
                'bg-surface border border-border-subtle rounded-md shadow-modal',
                'animate-fade-in overflow-hidden',
              )}
            >
              {searchable && (
                <div className="flex items-center gap-2 px-3 h-9 border-b border-border-subtle">
                  <Search size={14} className="text-text-muted flex-shrink-0" />
                  <input
                    ref={searchRef}
                    type="text"
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setHighlight(0);
                    }}
                    placeholder="Suchen…"
                    className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-muted outline-none"
                    aria-label="Optionen durchsuchen"
                  />
                </div>
              )}
              <ul
                ref={listRef}
                id={listboxId}
                role="listbox"
                aria-labelledby={reactId}
                tabIndex={-1}
                className="max-h-60 overflow-y-auto py-1"
              >
                {filtered.length === 0 ? (
                  <li className="px-3 py-2 text-sm text-text-muted">Keine Treffer</li>
                ) : (
                  filtered.map((opt, i) => {
                    const selected = opt.value === value;
                    const highlighted = i === highlight;
                    return (
                      <li
                        key={String(opt.value)}
                        role="option"
                        aria-selected={selected}
                        aria-disabled={opt.disabled}
                        onMouseEnter={() => setHighlight(i)}
                        onMouseDown={(e) => {
                          // prevent blur before click
                          e.preventDefault();
                        }}
                        onClick={() => commit(opt)}
                        className={cn(
                          'flex items-start gap-2 px-3 py-2 text-sm cursor-pointer',
                          highlighted && !opt.disabled && 'bg-elevated',
                          selected && 'text-accent-400',
                          !selected && !opt.disabled && 'text-text-primary',
                          opt.disabled && 'text-text-muted cursor-not-allowed opacity-60',
                        )}
                      >
                        <span className="flex-1 min-w-0">
                          <span className="block truncate">{opt.label}</span>
                          {opt.description && (
                            <span className="block text-xs text-text-muted truncate">
                              {opt.description}
                            </span>
                          )}
                        </span>
                        {selected && (
                          <Check size={14} className="text-accent-400 flex-shrink-0 mt-0.5" />
                        )}
                      </li>
                    );
                  })
                )}
              </ul>
            </div>
          )}
        </div>
        {error && <p role="alert" className="text-xs text-status-danger">{error}</p>}
      </div>
    );
  },
);

Select.displayName = 'Select';
