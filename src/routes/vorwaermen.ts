/**
 * Die Teilbündel der Ansichten vorab holen.
 *
 * ─── Warum ────────────────────────────────────────────────────────────────
 *
 * Jede Ansicht liegt in einem eigenen Bündel — richtig so, beim Anmelden lädt
 * nur die Übersicht. Der Preis: der ERSTE Klick auf einen Punkt in der
 * Seitenleiste wartet auf einen Download, bevor überhaupt etwas passiert.
 * Genau das fühlt sich an wie ein Knopf, der hängt.
 *
 * Die Daten waren im Admin schon vorgewärmt (`uebersichtVorwaermen` in
 * MailLayout.tsx, über react-query). Der CODE nicht — das hier schliesst die
 * Lücke. Beides zusammen heisst: beim Klick ist weder das Bündel noch die
 * Antwort des Servers noch offen.
 *
 * Gleiches Vorgehen wie CRM-System/src/app/vorwaermen.ts. Die beiden
 * Anwendungen sollen sich beim Wechseln gleich anfühlen; unterschiedliche
 * Wartezeiten fallen genau dort auf.
 *
 * ─── Was NICHT vorgewärmt wird ────────────────────────────────────────────
 *
 * Der Kundenassistent und die selten gebrauchten Ansichten, die nicht mehr in
 * der Navigation stehen. Wer sie über eine gespeicherte Adresse aufruft,
 * wartet einmal — das ist der seltene Fall und darf etwas kosten.
 */

/** Die Ansichten hinter der Seitenleiste, nach Häufigkeit sortiert. */
const HAUPTANSICHTEN = [
    () => import('@/views/dashboard/OverviewView'),
    () => import('@/views/dashboard/NotesView'),
    () => import('@/views/dashboard/FeedbackView'),
    () => import('@/views/operations/InboxView'),
    () => import('@/views/tenants/TenantsListView'),
    () => import('@/views/calendar/CalendarView'),
    () => import('@/views/onboarding/OnboardingPipelineView'),
    () => import('@/views/access/AccessRequestsView'),
    () => import('@/views/operations/OemFinderView'),
    () => import('@/views/operations/OutreachView'),
    () => import('@/views/marketing/MarketingView'),
    () => import('@/views/settings/SettingsLayout'),
    () => import('@/views/admins/AdminsListView'),
];

/**
 * Die Befehlspalette — nicht in HAUPTANSICHTEN, weil sie keine Ansicht ist,
 * aber aus demselben Grund vorzuwaermen: sie oeffnet ueber ⌘K, und eine
 * Tastenkombination bietet kein Ueberfahren, auf das man das Holen legen
 * koennte.
 */
const ZUSATZ = [() => import('@/components/layout/CommandPalette')];

/**
 * Nach dem ersten Bild alles Übrige holen.
 *
 * `requestIdleCallback`, damit das Nachladen nicht mit dem konkurriert, was
 * gerade auf dem Bildschirm entsteht. Safari kennt es bis heute nicht — daher
 * der Rückfall auf einen Zeitgeber.
 *
 * Fehler werden verschluckt: schlägt ein Vorabruf fehl, versucht es der echte
 * Klick später erneut. Ein unbehandelter Fehlschlag im Hintergrund würde nur
 * die Konsole vollschreiben, ohne dass jemand etwas davon hat.
 */
export function ansichtenVorwaermen(): void {
    const holen = () => {
        for (const laden of [...HAUPTANSICHTEN, ...ZUSATZ]) void laden().catch(() => {});
    };
    const ric = (window as Window & { requestIdleCallback?: (cb: () => void) => number }).requestIdleCallback;
    if (typeof ric === 'function') ric(holen);
    else window.setTimeout(holen, 1200);
}
