/**
 * MailLayout — eigenständige Hülle für das Mailsystem.
 *
 * Das Mailprogramm läuft NICHT im normalen Dashboard-Rahmen: keine Seitenleiste,
 * keine Topbar. Es ist die einzige Anwendung hier, die den ganzen Bildschirm
 * braucht — drei Spalten nebeneinander, und beim Lesen einer langen Mail will
 * man nicht 240 Pixel an eine Navigation verlieren, die man ohnehin nicht
 * benutzt, während man Post bearbeitet.
 *
 * Es ist ab dem Cutover das einzige Mailprogramm der Firma. Wer es öffnet,
 * arbeitet darin, statt es zu besuchen.
 *
 * Der Rückweg ist eine schmale Kopfzeile: Logo, Bereichswechsel, Profil.
 *
 * Gestaltung nach dem Redesign vom 2026-07-30: dieselbe durchscheinende
 * Kopfzeile mit Weichzeichner wie im Dashboard, dasselbe Verlaufsquadrat mit
 * dem P. Der Entwurf hatte Mail als Seite IM Dashboard vorgesehen — die
 * Struktur bleibt bewusst unsere (eigene Hülle, ganzer Bildschirm), nur das
 * Aussehen kommt von dort. Wer aus dem Dashboard herüberwechselt, soll nicht
 * das Gefühl haben, in einem anderen Programm zu landen.
 */
import { useEffect } from 'react';
import { Link, Outlet } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';

import { useMailboxes } from '@/hooks/useInbox';
import { getAdminStats } from '@/api/tenants';
import { getAuditLog } from '@/api/audit';
import { getSystemHealth } from '@/api/health';
import { getOnboardingPipeline } from '@/api/onboarding';
import { listAppointments } from '@/api/appointments';
import { terminfenster } from '@/views/dashboard/terminfenster';
import { PushToggle } from './PushToggle';

export function MailLayout(): JSX.Element {
    // Der Empfangsweg kommt aus der API, nicht aus dem Quelltext. Ein festes
    // "RESEND AKTIV" wuerde auch dann noch gruen leuchten, wenn der Empfang
    // steht — und dann glaubt man ihm.
    const { transport } = useMailboxes();
    const qc = useQueryClient();

    /**
     * Den Rueckweg vorwaermen, solange hier noch gearbeitet wird.
     *
     * ─── Warum der Wechsel spuerbar dauert ────────────────────────────────
     *
     * Das Mailprogramm liegt AUSSERHALB der Dashboard-Huelle. Beim Klick auf
     * "Dashboard" wird die komplette Mailanwendung abgebaut — samt dem Rahmen,
     * in dem der Nachrichtentext steckt — und die Dashboard-Huelle mit
     * Seitenleiste, Kopfzeile und Uebersicht neu aufgebaut. Dazu kommt das
     * Nachladen des Uebersichts-Stuecks und ihr erster Datenabruf.
     *
     * Einzeln ist nichts davon langsam (Datenbank unter 3 ms, Netz rund
     * 100 ms, das Stueck 24 KB). In Summe und hintereinander ist es trotzdem
     * eine spuerbare Pause, und sie faellt genau in den Moment, in dem man
     * schon woanders sein will.
     *
     * Deshalb passiert beides VORHER:
     *
     *   1. Das Stueck wird beim Betreten des Postfachs geholt. Einmalig,
     *      danach liegt es im Browser.
     *   2. Die Zahlen werden geholt, sobald der Zeiger den Rueckweg beruehrt.
     *      Das sind ein paar hundert Millisekunden VOR dem Klick — genug fuer
     *      einen Abruf, der 100 ms braucht.
     *
     * `prefetchQuery` ist dabei absichtlich sanft: laeuft schon ein Abruf oder
     * sind die Daten frisch, tut es nichts.
     */
    useEffect(() => {
        void import('@/views/dashboard/OverviewView');
    }, []);

    /**
     * Es waren VIER Abfragen, vorgewaermt wurde eine.
     *
     * Die Uebersicht holt beim Aufbau Kennzahlen, Systemzustand,
     * Onboarding-Stufen und Termine. Hier stand nur die erste — die anderen
     * drei starteten erst NACH dem Klick, jede mit einem eigenen Weg zum
     * Server. Gemessen ist jede davon schnell (Datenbank 1-4 ms, Abweisung
     * ohne Anmeldung 50 ms), aber sie beginnen eben alle bei null, waehrend
     * die Ansicht schon steht.
     *
     * Jetzt sind alle vier dabei. Die Schluessel stimmen ABSICHTLICH bis aufs
     * Zeichen mit denen in OverviewView/useSystemHealth ueberein — ein
     * abweichender Schluessel waermt eine Ablage vor, die niemand liest, und
     * das faellt nie auf, weil nichts kaputtgeht. Nur langsam bleibt es.
     *
     * `prefetchQuery` bleibt sanft: laeuft schon ein Abruf oder sind die
     * Daten frisch, tut es nichts. Mehrfaches Zeigen kostet also nichts.
     */
    const uebersichtVorwaermen = (): void => {
        void qc.prefetchQuery({
            queryKey: ['admin', 'dashboard', 'metrics'] as const,
            queryFn: getAdminStats,
            staleTime: 30_000,
        });
        void qc.prefetchQuery({
            queryKey: ['admin', 'system', 'health'] as const,
            queryFn: getSystemHealth,
            staleTime: 10_000,
        });
        void qc.prefetchQuery({
            queryKey: ['admin', 'onboarding', 'pipeline'] as const,
            queryFn: () => getOnboardingPipeline(),
            staleTime: 60_000,
        });
        void qc.prefetchQuery({
            queryKey: ['admin', 'appointments', 'uebersicht'] as const,
            queryFn: () => listAppointments(terminfenster()),
            staleTime: 60_000,
        });
        /**
         * Die fuenfte Abfrage der Uebersicht — der Audit zum Dashboard-Knopf
         * hat sie gefunden: "Letzte Aenderungen" wurde nicht vorgewaermt und
         * zeigte beim Rueckweg erst den gestrichelten Leerzustand ("Noch
         * keine Eintraege"), der dann nachpoppte. Ein falscher Leerzustand
         * ist schlimmer als ein Skelett: er behauptet etwas.
         *
         * `query` heisst hier so und ist ein leeres Objekt, damit der
         * Schluessel BUCHSTABENGLEICH mit useAuditLogs.ts ist — der
         * Vollstaendigkeits-Test vergleicht die Schluessel als Text.
         */
        const query = {};
        void qc.prefetchInfiniteQuery({
            queryKey: ['admin', 'audit', query] as const,
            // limit 25 = PAGE_SIZE in useAuditLogs — sonst waermt das eine
            // andere erste Seite vor als die, die der Haken abruft.
            queryFn: () => getAuditLog({ limit: 25 }),
            initialPageParam: null as string | null,
            staleTime: 30_000,
        });
    };

    return (
        <div className="flex h-screen h-dvh w-full flex-col overflow-hidden bg-canvas text-text-primary">
            <a
                href="#mail-main"
                className="sr-only rounded-md bg-accent-500 px-3 py-2 text-sm font-medium text-white focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100]"
            >
                Zum Hauptinhalt springen
            </a>

            <header className="flex h-12 shrink-0 items-center gap-2.5 border-b border-border-subtle bg-canvas/95 px-3 supports-[backdrop-filter]:bg-canvas/[0.82] supports-[backdrop-filter]:backdrop-blur-[18px] md:px-5">
                <Link
                    to="/"
                    onMouseEnter={uebersichtVorwaermen}
                    onFocus={uebersichtVorwaermen}
                    onTouchStart={uebersichtVorwaermen}
                    /**
                     * Startpunkt der Rueckweg-Messung — Auswertung in
                     * OverviewView.
                     *
                     * ZWEI Marken, und der Unterschied ist der ganze Punkt:
                     * `e.timeStamp` ist die HARDWARE-Zeit des Klicks, gesetzt
                     * vom Browser im Moment des Fingerdrucks. `performance.now()`
                     * ist der Moment, in dem dieser Handler LAEUFT. Ist der
                     * Hauptthread beschaeftigt, liegen dazwischen Sekunden —
                     * und genau die hat die erste Fassung der Messung nicht
                     * gesehen: der Nutzer erlebte einen langen Wechsel, die
                     * Konsole meldete 39 ms. Beides stimmte. Die Stoppuhr
                     * startete nur zu spaet.
                     */
                    onClick={(e) => {
                        const klick = e.timeStamp > 0 && e.timeStamp <= performance.now()
                            ? e.timeStamp
                            : performance.now();
                        performance.mark('dashboard-klick', { startTime: klick });
                        performance.mark('dashboard-klick-handler');
                    }}
                    className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[12px] font-semibold text-text-muted transition-colors hover:bg-overlay/[0.05] hover:text-text-primary"
                >
                    <ArrowLeft className="size-3.5" />
                    <span className="hidden sm:inline">Dashboard</span>
                </Link>

                <span className="h-4 w-px bg-border-subtle" aria-hidden />

                <span className="flex items-center gap-2.5">
                    <span className="flex size-[26px] shrink-0 items-center justify-center rounded-[8px] bg-gradient-to-br from-accent-500 to-accent-700">
                        <img
                            src="/partsunion-symbol-weiss.png"
                            alt="Partsunion"
                            width={16}
                            height={16}
                            className="size-4"
                        />
                    </span>
                    <span className="font-display text-[12.5px] font-bold tracking-[0.02em]">
                        Partsunion Mail
                    </span>
                </span>

                {/* Empfangsweg als Zustandsmerkmal, wie im Entwurf. Er sitzt
                    hier oben statt unten in der Spalte: dort war er unter dem
                    Bildlauf und damit meist unsichtbar. Solange die Antwort
                    nicht da ist, steht hier NICHTS — kein Merkmal ist besser
                    als ein falsches. */}
                {transport && (
                    <span
                        className="ml-1 hidden items-center gap-1.5 rounded-[7px] border border-success/[0.24] bg-success/10 px-2.5 py-1.5 font-mono text-[10px] font-bold uppercase text-success sm:inline-flex"
                        role="status"
                    >
                        <span
                            aria-hidden
                            className="size-[5px] shrink-0 rounded-full bg-success motion-safe:animate-pulse"
                        />
                        {transport} aktiv
                    </span>
                )}

                <div className="ml-auto flex items-center gap-1.5">
                    <PushToggle />
                    <Link
                        to="/einstellungen/postfaecher"
                        className="rounded-lg px-2.5 py-1.5 text-[12px] font-semibold text-text-muted transition-colors hover:bg-overlay/[0.05] hover:text-text-primary"
                    >
                        Postfach-Rechte
                    </Link>
                </div>
            </header>

            <main id="mail-main" className="min-h-0 flex-1" role="main" tabIndex={-1}>
                <Outlet />
            </main>
        </div>
    );
}

export default MailLayout;
