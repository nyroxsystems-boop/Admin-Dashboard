/**
 * Farben der Onboarding-Stufen — EINE Quelle für beide Ansichten.
 *
 * Der Entwurf legt sie im Dashboard-Trichter fest:
 *
 *   Angelegt        #5b8cff   accent
 *   In Einrichtung  #5b8cff   accent
 *   Konfiguriert    #f5b544   warning
 *   Live            #3ddc97   success
 *   Gefährdet       #ff6b6b   danger
 *
 * Warum hier und nicht je Ansicht: ich hatte sie zuerst zweimal gesetzt, und
 * prompt war "Konfiguriert" in der Übersicht bernsteinfarben und in der
 * Onboarding-Ansicht blau. Zwei Listen mit je eigenen Farben laufen immer
 * auseinander — man merkt es erst, wenn beide Bildschirme nebeneinander liegen.
 *
 * "In Einrichtung" trägt bewusst DIESELBE Farbe wie "Angelegt", so wie im
 * Entwurf: die beiden sind derselbe Abschnitt der Reise, nur unterschiedlich
 * weit. Ein eigener Ton würde einen Bruch behaupten, den es nicht gibt.
 */
import type { OnboardingRisk } from '@/api/onboarding';

export interface StufenTon {
    /** Beschriftung in der Oberfläche. */
    label: string;
    /** Klassen für ein Statusfeld (Rand, Fläche, Schrift). */
    feld: string;
    /** Klasse für einen Balken oder Streifen. */
    balken: string;
    /** Klasse für eine grosse Zahl. */
    zahl: string;
}

/**
 * ─── Warum die Felder vollflächig sind ─────────────────────────────────────
 *
 * Hier stand `border-success/30 bg-success/10 text-success` — eine 10-%-Tönung
 * der eigenen Farbe, mit derselben Farbe als Schrift. So steht es auch im
 * Entwurf (`rgba(245,181,68,.1)`), ich hatte ihn getreu übernommen. Im Betrieb
 * wirkt eine Reihe solcher Felder aber leblos, und das war die Rückmeldung.
 *
 * Beim Nachrechnen kam ein zweiter, ernsterer Grund dazu: im HELLMODUS war die
 * Schrift damit unlesbar — 4,1 statt der geforderten 4,5. Eine Tönung derselben
 * Farbe zieht den Untergrund genau in Richtung der Schrift; je kräftiger die
 * Fläche, desto schlechter der Kontrast. Es gibt in diesem Entwurf keinen
 * Tönungswert, der im Hellen funktioniert — auch 8 % reichen nicht.
 *
 * Volle Farbe löst beides: sie ist kräftig, und der Kontrast hängt nicht mehr
 * an der Tönung, sondern nur noch an der Schriftfarbe. Die kippt über
 * `--auf-ton` mit dem Modus und liegt damit zwischen 5,2 und 12,1.
 */
export const STUFEN_TON: Record<OnboardingRisk, StufenTon> = {
    live: {
        label: 'Live',
        feld: 'border-transparent bg-success text-auf-ton',
        balken: 'bg-success',
        zahl: 'text-success',
    },
    configured: {
        label: 'Konfiguriert',
        feld: 'border-transparent bg-warning text-auf-ton',
        balken: 'bg-warning',
        zahl: 'text-warning',
    },
    setup: {
        label: 'In Einrichtung',
        feld: 'border-transparent bg-accent-500 text-auf-ton',
        balken: 'bg-accent-500',
        zahl: 'text-accent-500',
    },
    'at-risk': {
        label: 'Gefährdet',
        feld: 'border-transparent bg-danger text-auf-ton',
        balken: 'bg-danger',
        zahl: 'text-danger',
    },
};

/** "Angelegt" ist keine Risikostufe, sondern die Summe — eigener, neutraler Ton. */
export const STUFE_GESAMT: StufenTon = {
    label: 'Angelegt',
    feld: 'border-overlay/[0.08] bg-overlay/[0.04] text-text-secondary',
    balken: 'bg-accent-500',
    zahl: 'text-text-primary',
};
