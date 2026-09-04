import { NotebookPen } from 'lucide-react';

import { SEITEN_RAND } from '@/components/ui/seite';
import { DashboardNotes } from './DashboardNotes';

export default function NotesView(): JSX.Element {
    return (
        <div className={`${SEITEN_RAND} py-7`}>
            <header className="mb-5 flex items-start gap-3.5">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-[13px] border border-accent-500/20 bg-accent-500/10 text-accent-500">
                    <NotebookPen className="size-5" aria-hidden />
                </span>
                <div>
                    <p className="font-mono text-[9.5px] font-bold uppercase tracking-[0.18em] text-accent-500">
                        Team-Arbeitsfläche
                    </p>
                    <h1 className="mt-1 font-display text-[26px] font-semibold tracking-tight text-text-primary">
                        Notizen
                    </h1>
                    <p className="mt-1 text-[12.5px] text-text-muted">
                        Wichtiges, Ideen, Verbesserungen und Aufgaben zentral festhalten.
                    </p>
                </div>
            </header>
            <DashboardNotes fullHeight />
        </div>
    );
}
