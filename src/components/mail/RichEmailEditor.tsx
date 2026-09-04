import {
    useEffect,
    useRef,
    useState,
    type ClipboardEvent as ReactClipboardEvent,
    type MouseEvent as ReactMouseEvent,
    type ReactNode,
} from 'react';
import {
    Bold,
    Italic,
    Link,
    List as ListIcon,
    ListOrdered,
    Quote,
    Redo2,
    RemoveFormatting,
    Strikethrough,
    Underline,
    Undo2,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { sanitizeEmailEditorHtml } from '@/utils/emailHtml';

interface RichEmailEditorProps {
    initialHtml?: string;
    onChange: (value: { html: string; text: string }) => void;
    invalid?: boolean;
}

interface ToolbarButtonProps {
    label: string;
    onPress: () => void;
    children: ReactNode;
}

function ToolbarButton({ label, onPress, children }: ToolbarButtonProps): JSX.Element {
    function handleMouseDown(event: ReactMouseEvent<HTMLButtonElement>): void {
        event.preventDefault();
        onPress();
    }

    return (
        <button
            type="button"
            title={label}
            aria-label={label}
            onMouseDown={handleMouseDown}
            className="flex size-8 shrink-0 items-center justify-center rounded text-text-secondary transition-colors hover:bg-elevated hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500"
        >
            {children}
        </button>
    );
}

/**
 * Die drei Auswahlfelder der Werkzeugleiste.
 *
 * Vorher stand hier `border-0 bg-transparent`. Das reicht nicht: Safari und
 * Chrome zeichnen um ein <select> ihre EIGENE Hülle mit Rahmen, Verlauf und
 * Doppelpfeil, und die überlebt jede Farbangabe. In einer Leiste, in der alle
 * anderen Bedienelemente unsere Form haben, stachen sie als Fremdkörper
 * heraus — genau das war zu sehen.
 *
 * `appearance-none` schaltet die Systemhülle ab; danach zeichnen wir alles
 * selbst. Der Pfeil kommt als Hintergrundbild, weil ein echtes Symbol daneben
 * einen zweiten Baustein und eine Umhüllung bräuchte — für drei Felder zu
 * viel Aufwand.
 *
 * `bg-[position]` statt `background-position` als Klasse: der Pfeil sitzt
 * rechts mit 10 px Abstand, und rechts bleibt Platz dafür (`pr-7`).
 */
const AUSWAHL_FELD = cn(
    /**
     * FESTE Breite je Feld (unten), denn ein <select> ist so breit wie seine
     * laengste gewaehlte Beschriftung. "Zwischenueberschrift" ist doppelt so
     * breit wie "Normal" — waehlt man sie, wuchs die Leiste und schob das
     * letzte Werkzeug in eine zweite Zeile. Die Leiste veraenderte also ihre
     * Hoehe, je nachdem was eingestellt war.
     *
     * Mit fester Breite schneidet der Browser lange Beschriftungen selbst ab,
     * und die Leiste bleibt in jeder Einstellung gleich hoch.
     */
    'h-8 shrink-0 appearance-none truncate rounded-[7px] border border-overlay/[0.08] bg-overlay/[0.04]',
    'py-0 pl-2.5 pr-6 text-[11.5px] font-medium text-text-secondary',
    'transition-colors hover:bg-overlay/[0.07] hover:text-text-primary',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/50',
    // Doppelpfeil in text-muted, als Datenadresse eingebettet (kein Abruf).
    "bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2010%206%22%20fill%3D%22none%22%20stroke%3D%22%237D8397%22%20stroke-width%3D%221.5%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22M1%201.5L5%205L9%201.5%22%2F%3E%3C%2Fsvg%3E')]",
    'bg-[length:9px_6px] bg-[right_0.5rem_center] bg-no-repeat',
);

export function RichEmailEditor({ initialHtml = '', onChange, invalid = false }: RichEmailEditorProps): JSX.Element {
    const editorRef = useRef<HTMLDivElement>(null);
    const savedRangeRef = useRef<Range | null>(null);
    const [empty, setEmpty] = useState(!initialHtml.trim());

    useEffect(() => {
        if (!editorRef.current) return;
        editorRef.current.innerHTML = sanitizeEmailEditorHtml(initialHtml);
        setEmpty(!editorRef.current.innerText.trim());
    }, [initialHtml]);

    function saveSelection(): void {
        const editor = editorRef.current;
        const selection = window.getSelection();
        if (!editor || !selection || selection.rangeCount === 0) return;
        const range = selection.getRangeAt(0);
        if (editor.contains(range.commonAncestorContainer)) {
            savedRangeRef.current = range.cloneRange();
        }
    }

    function restoreSelection(): void {
        const selection = window.getSelection();
        const range = savedRangeRef.current;
        if (!selection || !range) return;
        selection.removeAllRanges();
        selection.addRange(range);
    }

    /**
     * ─── Warum die Meldung an die Maske entprellt ist ──────────────────────
     *
     * `onChange` setzt in InboxView zwei Zustände (bodyHtml, bodyText). Jeder
     * Tastendruck liess damit die GANZE Postfachansicht neu rendern — samt
     * Nachrichtenliste, Vorschau und Werkzeugleiste. Beim schnellen Tippen
     * fühlt sich das zäh an: die Buchstaben kommen verzögert und in Schüben.
     *
     * Der Zustand für den Platzhalter (`empty`) bleibt SOFORT: er ist lokal
     * und kostet nichts. Nur die Meldung nach aussen wartet einen Moment.
     *
     * 200 ms ist der Bereich, in dem eine Pause beim Tippen anfängt, eine
     * Pause zu sein. Kürzer bringt nichts, länger macht das Absenden direkt
     * nach dem letzten Buchstaben unsicher — deshalb wird beim Verlassen des
     * Feldes und bei jedem Werkzeug sofort durchgereicht (`melden(true)`).
     */
    const meldeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    function melden(sofort = false): void {
        const editor = editorRef.current;
        if (!editor) return;
        const text = editor.innerText.replace(/\u00a0/g, ' ');
        setEmpty(!text.trim());
        saveSelection();

        if (meldeTimer.current) clearTimeout(meldeTimer.current);
        const senden = () => onChange({ html: editor.innerHTML, text });
        if (sofort) senden();
        else meldeTimer.current = setTimeout(senden, 200);
    }

    /* Ein laufender Zeitgeber darf den Baustein nicht ueberleben — sonst
       meldet er in ein Feld, das es nicht mehr gibt. */
    useEffect(() => () => {
        if (meldeTimer.current) clearTimeout(meldeTimer.current);
    }, []);

    function emitChange(): void {
        melden(true);
    }

    function command(name: string, value?: string): void {
        const editor = editorRef.current;
        if (!editor) return;
        editor.focus();
        restoreSelection();
        document.execCommand(name, false, value);
        emitChange();
    }

    function createLink(): void {
        saveSelection();
        const raw = window.prompt('Link oder E-Mail-Adresse eingeben');
        if (!raw?.trim()) return;
        const value = raw.trim();
        let href = value;
        if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) href = `mailto:${value}`;
        else if (/^\+?[0-9 ()/-]{6,}$/.test(value)) href = `tel:${value.replace(/\s+/g, '')}`;
        else if (!/^(https?:|mailto:|tel:)/i.test(value)) href = `https://${value}`;
        command('createLink', href);
    }

    function handlePaste(event: ReactClipboardEvent<HTMLDivElement>): void {
        event.preventDefault();
        const html = event.clipboardData.getData('text/html');
        if (html) {
            document.execCommand('insertHTML', false, sanitizeEmailEditorHtml(html));
        } else {
            document.execCommand('insertText', false, event.clipboardData.getData('text/plain'));
        }
        emitChange();
    }

    return (
        <div className={cn(
            'overflow-hidden rounded-lg border bg-canvas transition-colors focus-within:border-accent-500',
            invalid ? 'border-danger' : 'border-border-strong',
        )}>
            <div className="flex flex-wrap items-center gap-0.5 border-b border-border-subtle bg-surface px-2 py-1.5">
                <select
                    aria-label="Textstil"
                    defaultValue="p"
                    onMouseDown={saveSelection}
                    onChange={(event) => command('formatBlock', event.target.value)}
                    className={cn(AUSWAHL_FELD, 'w-[7.5rem]')}
                >
                    <option value="p">Normal</option>
                    <option value="h2">Überschrift</option>
                    <option value="h3">Zwischenüberschrift</option>
                </select>
                <select
                    aria-label="Schriftart"
                    defaultValue="Arial"
                    onMouseDown={saveSelection}
                    onChange={(event) => command('fontName', event.target.value)}
                    className={cn(AUSWAHL_FELD, 'w-[5.5rem]')}
                >
                    <option value="Arial">Arial</option>
                    <option value="Georgia">Georgia</option>
                    <option value="Courier New">Courier</option>
                </select>
                <select
                    aria-label="Schriftgröße"
                    defaultValue="3"
                    onMouseDown={saveSelection}
                    onChange={(event) => command('fontSize', event.target.value)}
                    className={cn(AUSWAHL_FELD, 'w-[5rem]')}
                >
                    <option value="2">Klein</option>
                    <option value="3">Normal</option>
                    <option value="5">Groß</option>
                </select>

                <span className="mx-1 h-5 w-px bg-border-subtle" />
                <ToolbarButton label="Fett" onPress={() => command('bold')}><Bold className="size-4" /></ToolbarButton>
                <ToolbarButton label="Kursiv" onPress={() => command('italic')}><Italic className="size-4" /></ToolbarButton>
                <ToolbarButton label="Unterstrichen" onPress={() => command('underline')}><Underline className="size-4" /></ToolbarButton>
                <ToolbarButton label="Durchgestrichen" onPress={() => command('strikeThrough')}><Strikethrough className="size-4" /></ToolbarButton>

                <span className="mx-1 h-5 w-px bg-border-subtle" />
                <ToolbarButton label="Aufzählung" onPress={() => command('insertUnorderedList')}><ListIcon className="size-4" /></ToolbarButton>
                <ToolbarButton label="Nummerierte Liste" onPress={() => command('insertOrderedList')}><ListOrdered className="size-4" /></ToolbarButton>
                <ToolbarButton label="Zitat" onPress={() => command('formatBlock', 'blockquote')}><Quote className="size-4" /></ToolbarButton>
                <ToolbarButton label="Link einfügen" onPress={createLink}><Link className="size-4" /></ToolbarButton>

                <span className="mx-1 h-5 w-px bg-border-subtle" />
                {['black', 'royalblue', 'seagreen', 'firebrick'].map((color) => (
                    <button
                        key={color}
                        type="button"
                        title={`Textfarbe ${color}`}
                        aria-label={`Textfarbe ${color}`}
                        onMouseDown={(event) => {
                            event.preventDefault();
                            command('foreColor', color);
                        }}
                        className="flex size-7 items-center justify-center rounded hover:bg-elevated"
                    >
                        <span className="size-3.5 rounded-full border border-overlay/20" style={{ backgroundColor: color }} />
                    </button>
                ))}

                <span className="mx-1 h-5 w-px bg-border-subtle" />
                <ToolbarButton label="Rückgängig" onPress={() => command('undo')}><Undo2 className="size-4" /></ToolbarButton>
                <ToolbarButton label="Wiederholen" onPress={() => command('redo')}><Redo2 className="size-4" /></ToolbarButton>
                <ToolbarButton label="Formatierung entfernen" onPress={() => command('removeFormat')}><RemoveFormatting className="size-4" /></ToolbarButton>
            </div>

            <div className="relative">
                {empty && (
                    /* Gleiche Schriftgroesse UND Zeilenhoehe wie das Feld.
                       Vorher `text-sm` (20 px Zeile) gegen `leading-6` (24 px)
                       im Feld — dadurch sass der Platzhalter auf einer anderen
                       Grundlinie als der Schreibzeiger. */
                    <span className="pointer-events-none absolute left-4 top-3 text-[14px] leading-6 text-text-muted">
                        Nachricht schreiben…
                    </span>
                )}
                <div
                    ref={editorRef}
                    contentEditable
                    suppressContentEditableWarning
                    role="textbox"
                    aria-multiline="true"
                    aria-label="E-Mail-Nachricht"
                    onInput={() => melden()}
                    /* Beim Verlassen sofort durchreichen: wer direkt nach dem
                       letzten Buchstaben auf Senden klickt, soll den letzten
                       Buchstaben auch mitschicken. */
                    onBlur={() => melden(true)}
                    onKeyUp={saveSelection}
                    onMouseUp={saveSelection}
                    onFocus={saveSelection}
                    onPaste={handlePaste}
                    /* `[&>*:first-child]:mt-0`: der Browser legt beim Tippen einen Absatz an,
                       und `[&_p]:my-2` gab dem 8 px Abstand nach oben. Der Zeiger sass
                       dadurch 8 px unter dem Platzhalter — genau der Versatz, der wie
                       ein Fehler aussah. Nebenbei faengt die Nachricht jetzt oben an
                       statt mit einer Leerzeile. */
                    className="min-h-72 max-h-[42dvh] overflow-y-auto px-4 py-3 text-[14px] leading-6 text-text-primary outline-none [&>*:first-child]:mt-0 [&_a]:text-accent-500 [&_a]:underline [&_blockquote]:my-3 [&_blockquote]:border-l-2 [&_blockquote]:border-accent-500 [&_blockquote]:pl-3 [&_h2]:my-3 [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:my-2 [&_h3]:text-lg [&_h3]:font-semibold [&_li]:ml-5 [&_ol]:my-2 [&_ol]:list-decimal [&_p]:my-2 [&_ul]:my-2 [&_ul]:list-disc"
                />
            </div>
        </div>
    );
}
