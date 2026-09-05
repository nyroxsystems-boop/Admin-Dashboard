import { useEffect, useId, useRef, useState } from 'react';
import { suggestContacts, type ContactSuggestion } from '@/api/inbox';
import { useDebounce } from '@/hooks/useDebounce';
import { Input } from '@/components/ui/input';

/** Accessible keyboard autocomplete for An, Cc and Bcc. No stale prefix results. */
export function RecipientField({ label, value, onChange, error, disabled, autoFocus = false }: {
    label: string; value: string; onChange: (value: string) => void; error?: string; disabled?: boolean; autoFocus?: boolean;
}): JSX.Element {
    const id = useId();
    const input = useRef<HTMLInputElement>(null);
    const [focused, setFocused] = useState(false);
    const [result, setResult] = useState<{ token: string; items: ContactSuggestion[] }>({ token: '', items: [] });
    const [active, setActive] = useState(-1);
    const token = (value.split(/[;,\n]/).pop() || '').trim();
    const debounced = useDebounce(token, 200);
    useEffect(() => {
        if (!focused || disabled || debounced.length < 2 || debounced.includes('@') && debounced.includes('.')) return;
        let cancelled = false;
        void suggestContacts(debounced).then(items => { if (!cancelled) setResult({ token: debounced, items }); }).catch(() => { if (!cancelled) setResult({ token: debounced, items: [] }); });
        return () => { cancelled = true; };
    }, [debounced, focused, disabled]);
    const items = focused && token.length >= 2 && result.token === token ? result.items : [];
    const choose = (address: string) => {
        onChange(`${value.replace(/[^;,\n]*$/, '')}${address}; `);
        setActive(-1); setResult({ token: '', items: [] }); input.current?.focus();
    };
    return <div className="grid grid-cols-[44px_minmax(0,1fr)] items-start gap-2 text-sm sm:grid-cols-[56px_minmax(0,1fr)]">
        <label htmlFor={id} className="pt-2 text-text-muted">{label}</label>
        <div className="relative min-w-0">
            <Input ref={input} id={id} role="combobox" aria-autocomplete="list" aria-expanded={items.length > 0} aria-controls={`${id}-suggestions`} aria-activedescendant={active >= 0 && items[active] ? `${id}-${active}` : undefined}
                autoComplete="off" inputMode="email" autoFocus={autoFocus} disabled={disabled} value={value}
                onFocus={() => setFocused(true)} onBlur={() => { setFocused(false); setActive(-1); }}
                onChange={event => { setActive(-1); onChange(event.target.value); }}
                onKeyDown={event => {
                    if (event.key === 'Escape' && items.length) { event.preventDefault(); event.stopPropagation(); setResult({ token: '', items: [] }); }
                    if (items.length && ['ArrowDown', 'ArrowUp'].includes(event.key)) { event.preventDefault(); setActive(previous => (previous + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length); }
                    if (event.key === 'Enter' && items[active]) { event.preventDefault(); choose(items[active].address); }
                }}
                aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined} className="h-9 shadow-none" placeholder={label === 'An' ? 'Name oder E-Mail-Adresse' : undefined} />
            {items.length > 0 && <ul id={`${id}-suggestions`} role="listbox" aria-label={`${label}: Adressvorschläge`} className="absolute inset-x-0 top-full z-20 mt-1 max-h-48 overflow-y-auto rounded-md border border-border-strong bg-surface py-1 shadow-lg">
                {items.map((item, index) => <li key={item.address} id={`${id}-${index}`} role="option" aria-selected={active === index} className={`cursor-pointer px-3 py-2 text-xs ${active === index ? 'bg-elevated' : ''}`} onMouseDown={event => event.preventDefault()} onClick={() => choose(item.address)}><span className="block font-medium">{item.displayName || item.address}</span>{item.displayName && <span className="break-all text-text-muted">{item.address}</span>}</li>)}
            </ul>}
            {error && <p id={`${id}-error`} className="mt-1 text-xs text-danger">{error}</p>}
        </div>
    </div>;
}
