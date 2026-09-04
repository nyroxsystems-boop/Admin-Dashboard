/**
 * Der Zustands-Haken fragt `/health/live` — die einzige Adresse, die es gibt.
 *
 * ─── Zwei Sackgassen, beide von mir ────────────────────────────────────────
 *
 * 1. `/health` — von Caddy mit einem Ops-Token geschuetzt. Antwortet auf den
 *    CORS-Vorabruf mit 401 ohne CORS-Kopfzeilen, der Browser sendet die
 *    Anfrage also gar nicht erst. Diagnose war richtig.
 *
 * 2. `/api/admin/health` — meine "Korrektur". Diese Route hat NIE existiert.
 *    Gemessen hatte ich nur den Vorabruf:
 *
 *        /health             Vorabruf 401
 *        /api/admin/health   Vorabruf 200
 *
 *    Daraus habe ich geschlossen, die Adresse existiere. Der Vorabruf sagt
 *    aber nur, dass CORS fuer `/api/*` eingerichtet ist. Dasselbe gilt fuer
 *    eine 401-Antwort: die kommt aus der Auth-Schicht, BEVOR geroutet wird.
 *    Beides beweist nichts ueber die Existenz einer Route — das sieht man
 *    erst mit gueltiger Anmeldung oder im gebauten Code.
 *
 *    Folge: alle 15 Sekunden ein 404, die Anzeige dauerhaft auf "Status wird
 *    geprueft", ueber Wochen.
 *
 * Deshalb prueft dieser Test den PFAD und schliesst beide Sackgassen
 * ausdruecklich aus. Der Vorwurf gegen mich selbst steht hier, damit die
 * naechste "Korrektur" nicht wieder auf eine 200 im Vorabruf hereinfaellt.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { apiFetch } = vi.hoisted(() => ({ apiFetch: vi.fn() }));
vi.mock('./client', () => ({ apiFetch }));

import { getSystemHealth } from './health';

describe('Systemzustand', () => {
    beforeEach(() => {
        apiFetch.mockReset();
        apiFetch.mockResolvedValue({ alive: true });
    });

    it('fragt /health/live ab', async () => {
        await getSystemHealth();
        expect(apiFetch).toHaveBeenCalledWith('/health/live');
    });

    it('fragt KEINE der beiden Sackgassen ab', async () => {
        await getSystemHealth();
        expect(
            apiFetch,
            '/api/admin/health existiert nicht — die Route wurde nie gebaut, '
            + 'der 200er im CORS-Vorabruf sagt nur, dass CORS fuer /api/* steht',
        ).not.toHaveBeenCalledWith('/api/admin/health');
        expect(
            apiFetch,
            '/health ist von Caddy mit einem Ops-Token geschuetzt und '
            + 'antwortet ohne CORS-Kopfzeilen',
        ).not.toHaveBeenCalledWith('/health');
    });

    it('meldet erreichbar, wenn alive true ist', async () => {
        await expect(getSystemHealth()).resolves.toEqual({ erreichbar: true });
    });

    it('meldet NICHT erreichbar bei jeder anderen Antwort', async () => {
        // Auch bei einer Antwort ohne `alive` wird nichts behauptet.
        for (const antwort of [{ alive: false }, {}, null]) {
            apiFetch.mockResolvedValueOnce(antwort);
            await expect(getSystemHealth()).resolves.toEqual({ erreichbar: false });
        }
    });
});
