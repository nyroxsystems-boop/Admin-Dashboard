/**
 * Lesbare Bezeichnungen für Audit-Einträge.
 *
 * Der wichtigste Test ist der letzte: Ein UNBEKANNTER Schlüssel darf nicht roh
 * durchgereicht werden. Neue Aktionen entstehen im Backend; ohne Rückfallregel
 * stünde beim nächsten `TENANT_SUSPEND_BILLING` wieder eine Konstante in der
 * Oberfläche — und niemandem fiele auf, dass eine Übersetzung fehlt.
 */
import { describe, expect, it } from 'vitest';

import { auditAktion, auditObjekt, auditZeile } from './auditLabels';

describe('bekannte Aktionen', () => {
    it.each([
        ['ADMIN_LOGIN', 'Angemeldet'],
        ['ADMIN_LOGOUT', 'Abgemeldet'],
        ['TENANT_UPDATE', 'Kunde geändert'],
        ['ACCESS_REQUEST_APPROVE', 'Zugang gewährt'],
        ['MAILBOX_ACCESS_REVOKE', 'Postfach-Recht entzogen'],
    ])('%s -> %s', (schluessel, erwartet) => {
        expect(auditAktion(schluessel)).toBe(erwartet);
    });

    it('ist unabhaengig von Gross- und Kleinschreibung', () => {
        expect(auditAktion('admin_login')).toBe('Angemeldet');
    });
});

describe('unbekannte Aktionen', () => {
    it('werden lesbar gemacht statt roh gezeigt', () => {
        // Kein 'TENANT_SUSPEND_BILLING' in der Oberflaeche.
        expect(auditAktion('TENANT_SUSPEND_BILLING')).toBe('Tenant suspend billing');
    });

    it('kommen auch mit Punkten und Bindestrichen zurecht', () => {
        expect(auditAktion('order.refund.partial')).toBe('Order refund partial');
        expect(auditAktion('some-new-thing')).toBe('Some new thing');
    });

    it('liefern bei leerem Wert etwas Verstaendliches', () => {
        expect(auditAktion(null)).toBe('Änderung');
        expect(auditAktion('')).toBe('Änderung');
        expect(auditAktion('   ')).toBe('Änderung');
    });
});

describe('Gegenstaende', () => {
    it('werden uebersetzt', () => {
        expect(auditObjekt('TENANT')).toBe('Kunde');
        expect(auditObjekt('MAILBOX')).toBe('Postfach');
    });

    it('sind null, wenn nichts angegeben ist', () => {
        expect(auditObjekt(null)).toBeNull();
    });
});

describe('ganze Zeile', () => {
    it('nennt den Namen, wenn es einen gibt', () => {
        expect(auditZeile({ action_type: 'TENANT_UPDATE', entity_name: 'Müller GmbH' }))
            .toBe('Kunde geändert · Müller GmbH');
    });

    it('nennt sonst den Gegenstand', () => {
        expect(auditZeile({ action_type: 'DOCUMENT_UPLOAD', entity_type: 'DOCUMENT' }))
            .toBe('Dokument hochgeladen');
    });

    it('wiederholt den Gegenstand NICHT, wenn er schon in der Aktion steht', () => {
        // 'Kunde geändert · Kunde' waere nur Laerm.
        expect(auditZeile({ action_type: 'TENANT_UPDATE', entity_type: 'TENANT' }))
            .toBe('Kunde geändert');
    });

    it('kommt mit einem Eintrag ganz ohne Angaben zurecht', () => {
        expect(auditZeile({})).toBe('Änderung');
    });

    it('nimmt `action`, wenn `action_type` fehlt', () => {
        expect(auditZeile({ action: 'ADMIN_LOGIN' })).toBe('Angemeldet');
    });
});
