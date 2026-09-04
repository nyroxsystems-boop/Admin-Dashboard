import { describe, expect, it } from 'vitest';

import { presentTenantPaymentStatus } from './tenantStatus';

describe('presentTenantPaymentStatus', () => {
    it.each([
        ['active', 'Aktiv', 'success'],
        ['paid', 'Bezahlt', 'success'],
        ['trial', 'Testphase', 'info'],
        ['overdue', 'Überfällig', 'warning'],
        ['suspended', 'Gesperrt', 'danger'],
        [null, 'Nicht gesetzt', 'neutral'],
    ] as const)('maps %s without collapsing its meaning', (status, label, tone) => {
        expect(presentTenantPaymentStatus(status)).toEqual({ label, tone });
    });

    it('keeps an unknown production value visible', () => {
        expect(presentTenantPaymentStatus('manual_review')).toEqual({
            label: 'manual_review',
            tone: 'neutral',
        });
    });
});
