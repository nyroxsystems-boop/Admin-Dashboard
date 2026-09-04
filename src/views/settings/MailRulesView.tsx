/**
 * Regeln und Abwesenheitsnotiz.
 *
 * Regeln greifen beim Eingang, nach der Postfach-Zuordnung und nach der
 * Spam-Einstufung. Bewusst einfach: eine Bedingung, eine Aktion, eine
 * Reihenfolge — die erste zutreffende Regel gewinnt. Wer verschachtelte
 * Und-Oder-Bäume baut, sucht Monate später, wo eine Mail geblieben ist.
 *
 * Die Abwesenheitsnotiz darf nur setzen, wer aus dem Postfach auch senden
 * darf: sie verschickt Mail in seinem Namen.
 */
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import {
    createMailRule,
    deleteMailRule,
    listMailRules,
    putAutoReply,
    type MailRule,
} from '@/api/inbox';
import { ErrorState } from '@/components/feedback/ErrorState';
import { LoadingState } from '@/components/feedback/LoadingState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

const FIELD_LABELS: Record<MailRule['field'], string> = {
    from: 'Absender',
    subject: 'Betreff',
    body: 'Nachrichtentext',
};

const OPERATOR_LABELS: Record<MailRule['operator'], string> = {
    contains: 'enthält',
    equals: 'ist genau',
    domain: 'hat die Domain',
};

const ACTION_LABELS: Record<MailRule['action'], string> = {
    move_archive: 'ins Archiv',
    move_trash: 'in den Papierkorb',
    move_spam: 'in den Spam',
    mark_read: 'als gelesen markieren',
};

export default function MailRulesView(): JSX.Element {
    const queryClient = useQueryClient();
    const query = useQuery({ queryKey: ['admin', 'inbox', 'rules'], queryFn: listMailRules });

    const [neu, setNeu] = useState<Omit<MailRule, 'id'> | null>(null);
    const [notiz, setNotiz] = useState<string | null>(null);

    function refresh(): void {
        void queryClient.invalidateQueries({ queryKey: ['admin', 'inbox', 'rules'] });
    }

    const anlegen = useMutation({
        mutationFn: createMailRule,
        onSuccess: () => { toast.success('Regel angelegt.'); setNeu(null); refresh(); },
        onError: (e: Error) => toast.error(e.message || 'Regel konnte nicht angelegt werden.'),
    });

    const entfernen = useMutation({
        mutationFn: deleteMailRule,
        onSuccess: () => { toast.success('Regel entfernt.'); refresh(); },
        onError: (e: Error) => toast.error(e.message || 'Regel konnte nicht entfernt werden.'),
    });

    const speichern = useMutation({
        mutationFn: putAutoReply,
        onSuccess: () => { toast.success('Abwesenheitsnotiz gespeichert.'); setNotiz(null); refresh(); },
        onError: (e: Error) => toast.error(e.message || 'Speichern fehlgeschlagen.'),
    });

    if (query.isLoading) return <LoadingState label="Lade Regeln…" />;
    if (query.error) {
        return (
            <ErrorState
                title="Regeln nicht erreichbar"
                message="Die Regeln konnten nicht geladen werden."
                onRetry={() => void query.refetch()}
            />
        );
    }

    const rules = query.data?.rules ?? [];
    const autoReplies = query.data?.autoReplies ?? [];
    const sendable = query.data?.sendable ?? [];

    return (
        <div className="space-y-8">
            {/* ── Regeln ── */}
            <section>
                <header className="mb-1 flex items-baseline justify-between gap-3">
                    <h2 className="text-lg font-semibold tracking-tight">Regeln</h2>
                    {sendable.length > 0 && !neu && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setNeu({
                                mailboxAddress: sendable[0],
                                position: 100,
                                isActive: true,
                                name: '',
                                field: 'subject',
                                operator: 'contains',
                                value: '',
                                action: 'move_archive',
                            })}
                        >
                            <Plus className="size-4" /> Regel
                        </Button>
                    )}
                </header>
                <p className="mb-4 text-sm text-text-muted">
                    Greifen bei eingehender Post. Die <strong>erste zutreffende</strong> Regel
                    gewinnt — danach wird nicht weiter geprüft. Von Hand verschobene Mail
                    bleibt unberührt.
                </p>

                {neu && (
                    <div className="mb-4 space-y-3 rounded-lg border border-border-strong bg-elevated/40 p-4">
                        <div className="grid gap-2 sm:grid-cols-2">
                            <Input
                                value={neu.name}
                                onChange={(e) => setNeu({ ...neu, name: e.target.value })}
                                placeholder="Name der Regel"
                                className="h-9"
                            />
                            <Select
                                value={neu.mailboxAddress}
                                onValueChange={(v) => setNeu({ ...neu, mailboxAddress: v })}
                            >
                                <SelectTrigger size="sm"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {sendable.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="grid gap-2 sm:grid-cols-[140px_150px_minmax(0,1fr)]">
                            <Select
                                value={neu.field}
                                onValueChange={(v) => setNeu({ ...neu, field: v as MailRule['field'] })}
                            >
                                <SelectTrigger size="sm"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {Object.entries(FIELD_LABELS).map(([k, l]) => (
                                        <SelectItem key={k} value={k}>{l}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Select
                                value={neu.operator}
                                onValueChange={(v) => setNeu({ ...neu, operator: v as MailRule['operator'] })}
                            >
                                <SelectTrigger size="sm"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {Object.entries(OPERATOR_LABELS).map(([k, l]) => (
                                        <SelectItem key={k} value={k}>{l}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Input
                                value={neu.value}
                                onChange={(e) => setNeu({ ...neu, value: e.target.value })}
                                placeholder={neu.operator === 'domain' ? 'beispiel.de' : 'Suchbegriff'}
                                className="h-9"
                            />
                        </div>

                        {neu.operator === 'domain' && neu.field !== 'from' && (
                            <p className="text-xs text-warning">
                                „Hat die Domain" lässt sich nur auf den Absender anwenden.
                            </p>
                        )}

                        <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm text-text-muted">dann</span>
                            <Select
                                value={neu.action}
                                onValueChange={(v) => setNeu({ ...neu, action: v as MailRule['action'] })}
                            >
                                <SelectTrigger size="sm" className="w-[220px]"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {Object.entries(ACTION_LABELS).map(([k, l]) => (
                                        <SelectItem key={k} value={k}>{l}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <div className="ml-auto flex gap-2">
                                <Button variant="ghost" size="sm" onClick={() => setNeu(null)}>Abbrechen</Button>
                                <Button
                                    size="sm"
                                    disabled={
                                        !neu.value.trim()
                                        || anlegen.isPending
                                        || (neu.operator === 'domain' && neu.field !== 'from')
                                    }
                                    onClick={() => anlegen.mutate(neu)}
                                >
                                    {anlegen.isPending && <Loader2 className="size-3.5 animate-spin" />}
                                    Anlegen
                                </Button>
                            </div>
                        </div>
                    </div>
                )}

                {rules.length === 0 ? (
                    <p className="karte-klein px-4 py-6 text-center text-sm text-text-muted">
                        Keine Regeln. Eingehende Post landet unverändert im Posteingang.
                    </p>
                ) : (
                    <ul className="divide-y divide-border-subtle overflow-hidden karte-klein">
                        {rules.map((rule) => (
                            <li key={rule.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 px-4 py-3 text-sm">
                                <span className="font-mono text-[11px] text-text-muted">{rule.position}</span>
                                <span className="text-text-primary">{rule.name || 'Ohne Namen'}</span>
                                <span className="text-text-muted">
                                    · {rule.mailboxAddress} · {FIELD_LABELS[rule.field]}{' '}
                                    {OPERATOR_LABELS[rule.operator]} „{rule.value}" →{' '}
                                    {ACTION_LABELS[rule.action]}
                                </span>
                                <button
                                    type="button"
                                    aria-label={`Regel ${rule.name || rule.id} entfernen`}
                                    disabled={entfernen.isPending}
                                    onClick={() => entfernen.mutate(rule.id)}
                                    className="ml-auto text-text-muted transition-colors hover:text-danger disabled:opacity-50"
                                >
                                    <Trash2 className="size-3.5" />
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            {/* ── Abwesenheitsnotiz ── */}
            <section>
                <h2 className="mb-1 text-lg font-semibold tracking-tight">Abwesenheitsnotiz</h2>
                <p className="mb-4 text-sm text-text-muted">
                    Antwortet automatisch auf eingehende Post. Nie auf Automaten, Verteiler
                    oder Kollegen aus der eigenen Domain, und jedem Absender höchstens einmal
                    pro Zeitraum — sonst schaukeln sich zwei Notizen gegenseitig hoch.
                </p>

                {sendable.length === 0 ? (
                    <p className="karte-klein px-4 py-6 text-center text-sm text-text-muted">
                        Du darfst aus keinem Postfach senden.
                    </p>
                ) : (
                    <div className="space-y-3">
                        {sendable.map((address) => {
                            const vorhanden = autoReplies.find((a) => a.mailboxAddress === address);
                            const offen = notiz === address;
                            return (
                                <div key={address} className="karte-klein p-4">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="font-medium text-text-primary">{address}</span>
                                        <span className={
                                            vorhanden?.isActive
                                                ? 'rounded-full border border-success/25 bg-success/10 px-2 py-0.5 text-[10px] text-success'
                                                : 'rounded-full border border-border-subtle px-2 py-0.5 text-[10px] text-text-muted'
                                        }>
                                            {vorhanden?.isActive ? 'aktiv' : 'aus'}
                                        </span>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="ml-auto"
                                            onClick={() => setNotiz(offen ? null : address)}
                                        >
                                            {offen ? 'Schließen' : 'Bearbeiten'}
                                        </Button>
                                    </div>

                                    {offen && (
                                        <AutoReplyForm
                                            address={address}
                                            vorhanden={vorhanden}
                                            pending={speichern.isPending}
                                            onSave={(v) => speichern.mutate(v)}
                                        />
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </section>
        </div>
    );
}

function AutoReplyForm({
    address,
    vorhanden,
    pending,
    onSave,
}: {
    address: string;
    vorhanden?: { isActive: boolean; subject: string; body: string; startsAt: string | null; endsAt: string | null; cooldownHours: number };
    pending: boolean;
    onSave: (v: {
        mailbox: string; isActive: boolean; subject: string; body: string;
        startsAt: string | null; endsAt: string | null; cooldownHours: number;
    }) => void;
}): JSX.Element {
    const [aktiv, setAktiv] = useState(vorhanden?.isActive ?? false);
    const [betreff, setBetreff] = useState(vorhanden?.subject ?? 'Abwesenheitsnotiz');
    const [text, setText] = useState(vorhanden?.body ?? '');
    const [von, setVon] = useState(vorhanden?.startsAt?.slice(0, 10) ?? '');
    const [bis, setBis] = useState(vorhanden?.endsAt?.slice(0, 10) ?? '');

    return (
        <div className="mt-4 space-y-3">
            <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={aktiv} onChange={(e) => setAktiv(e.target.checked)} />
                Eingeschaltet
            </label>
            <Input value={betreff} onChange={(e) => setBetreff(e.target.value)} placeholder="Betreff" className="h-9" />
            <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={4}
                placeholder="Ich bin bis … nicht erreichbar. In dringenden Fällen wenden Sie sich an …"
            />
            <div className="grid gap-2 sm:grid-cols-2">
                <label className="text-xs text-text-muted">
                    Von
                    <Input type="date" value={von} onChange={(e) => setVon(e.target.value)} className="mt-1 h-9" />
                </label>
                <label className="text-xs text-text-muted">
                    Bis
                    <Input type="date" value={bis} onChange={(e) => setBis(e.target.value)} className="mt-1 h-9" />
                </label>
            </div>
            <p className="text-xs text-text-muted">
                Ohne Zeitraum gilt sie ab dem Einschalten. Mit Enddatum schaltet sie sich
                selbst ab — ein vergessener Schalter antwortet sonst noch Monate später.
            </p>
            <div className="flex justify-end">
                <Button
                    size="sm"
                    disabled={pending || !text.trim()}
                    onClick={() => onSave({
                        mailbox: address,
                        isActive: aktiv,
                        subject: betreff,
                        body: text,
                        startsAt: von ? new Date(`${von}T00:00:00`).toISOString() : null,
                        endsAt: bis ? new Date(`${bis}T23:59:59`).toISOString() : null,
                        cooldownHours: vorhanden?.cooldownHours ?? 24,
                    })}
                >
                    {pending && <Loader2 className="size-3.5 animate-spin" />}
                    Speichern
                </Button>
            </div>
        </div>
    );
}
