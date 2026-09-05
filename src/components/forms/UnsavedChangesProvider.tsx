import { useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { UNSAFE_DataRouterContext, useBlocker } from 'react-router-dom';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useBeforeUnload } from '@/hooks/useBeforeUnload';
import { UnsavedChangesContext as Context, type UnsavedDraft as Draft } from '@/hooks/useUnsavedChanges';

export function UnsavedChangesProvider({ children }: { children: ReactNode }): JSX.Element {
  const [drafts, setDrafts] = useState<Map<string, Draft>>(new Map());
  const dataRouter = useContext(UNSAFE_DataRouterContext);
  const register = useCallback((id: string, draft: Draft | null) => {
    setDrafts((previous) => {
      const current = previous.get(id);
      if ((!draft && !current) || (draft && current?.label === draft.label && current.busy === draft.busy)) return previous;
      const next = new Map(previous);
      if (draft) next.set(id, draft); else next.delete(id);
      return next;
    });
  }, []);
  const confirmDiscard = useCallback(() => {
    if ([...drafts.values()].some((draft) => draft.busy)) {
      window.alert('Die Speicherung läuft noch. Bitte das Ergebnis abwarten.');
      return false;
    }
    return drafts.size === 0 || window.confirm('Ungespeicherte Änderungen verwerfen?');
  }, [drafts]);
  const registry = useMemo(() => ({ register, confirmDiscard }), [register, confirmDiscard]);
  useBeforeUnload(drafts.size > 0);
  return <Context.Provider value={registry}>{children}{dataRouter && <RouteLeavePrompt drafts={[...drafts.values()]} />}</Context.Provider>;
}

function RouteLeavePrompt({ drafts }: { drafts: Draft[] }): JSX.Element {
  const blocker = useBlocker(({ currentLocation, nextLocation }) => drafts.length > 0
    && currentLocation.pathname + currentLocation.search !== nextLocation.pathname + nextLocation.search);
  const busy = drafts.some((draft) => draft.busy);
  const blocked = blocker.state === 'blocked';
  // Saving or an enforced session expiry can unmount/clean every editor while a navigation is pending.
  useEffect(() => { if (blocked && drafts.length === 0) blocker.proceed(); }, [blocked, drafts.length, blocker]);
  return <Dialog open={blocked} onOpenChange={(open) => { if (!open && blocked) blocker.reset(); }}>
    <DialogContent className="w-[calc(100vw_-_2rem)] max-w-md">
      <DialogHeader><DialogTitle>{busy ? 'Speicherung läuft' : 'Ungespeicherte Änderungen'}</DialogTitle><DialogDescription>{busy
        ? 'Warte die Serverantwort ab. Ein Wechsel während der Speicherung kann zu einem unklaren Bearbeitungsstand führen.'
        : 'In diesen Bereichen liegen noch ungespeicherte Eingaben vor. Möchtest du hier weiterarbeiten oder sie verwerfen?'}</DialogDescription></DialogHeader>
      <ul className="space-y-2 rounded-md border border-border-subtle bg-elevated p-3 text-sm" aria-label="Noch nicht gespeicherte Bereiche">{drafts.map((draft, index) => <li key={`${draft.label}:${index}`}>{draft.label}{draft.busy ? ' · Speichert…' : ''}</li>)}</ul>
      <DialogFooter><Button autoFocus onClick={() => { if (blocked) blocker.reset(); }}>Weiter bearbeiten</Button><Button variant="outline" disabled={busy} onClick={() => { if (blocked && !busy) blocker.proceed(); }}>Verwerfen und wechseln</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}
