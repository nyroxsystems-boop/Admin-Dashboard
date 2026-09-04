import '@testing-library/jest-dom';

/**
 * jsdom bringt hier KEIN localStorage mit — nachgemessen:
 * `typeof sessionStorage === 'object'`, `typeof localStorage === 'undefined'`.
 *
 * Ohne Ersatz scheitern alle Tests, die eine Entscheidung über das Neuladen
 * hinweg prüfen, mit "Cannot read properties of undefined" — also wie ein
 * Fehler im Code statt wie eine fehlende Umgebung. Genau diese Verwechslung
 * kostet die meiste Zeit; sie hat mich hier schon einmal erwischt.
 *
 * Gleicht nur den Prüftisch an, ändert nichts am Verhalten der Anwendung. Der
 * Fall „Browser gibt keinen Speicher her" bleibt geprüft: bilderVertrauen.ts
 * fängt jeden Zugriff ab, und die Tests dazu ersetzen ihn durch einen, der
 * wirft.
 *
 * Wortgleich mit CRM-System/src/test/setup.ts — beide Anwendungen laufen im
 * selben jsdom und stolpern über dasselbe.
 */

class SpeicherErsatz implements Storage {
    private daten = new Map<string, string>();

    get length(): number {
        return this.daten.size;
    }

    clear(): void {
        this.daten.clear();
    }

    getItem(key: string): string | null {
        return this.daten.has(key) ? (this.daten.get(key) as string) : null;
    }

    key(index: number): string | null {
        return Array.from(this.daten.keys())[index] ?? null;
    }

    removeItem(key: string): void {
        this.daten.delete(key);
    }

    setItem(key: string, value: string): void {
        this.daten.set(key, String(value));
    }
}

for (const name of ['localStorage', 'sessionStorage'] as const) {
    let vorhanden = false;
    try {
        vorhanden = typeof (globalThis as Record<string, unknown>)[name] === 'object'
            && (globalThis as Record<string, unknown>)[name] !== null;
    } catch {
        vorhanden = false;
    }
    if (!vorhanden) {
        Object.defineProperty(globalThis, name, {
            configurable: true,
            writable: true,
            value: new SpeicherErsatz(),
        });
    }
}
