import { describe, expect, it } from 'vitest';
import { TenantSchema } from '@/api/types';
import { filterDirectory, setupLabel, csvField } from './tenantDirectory';

const tenants = [
    TenantSchema.parse({ id: 'a', name: 'Müller Nord', slug: 'NORD', whatsapp_number: '+493012345', payment_status: ' PAID ', onboarding_status: 'completed' }),
    TenantSchema.parse({ id: 'b', name: 'Berlin Teile', payment_status: ' Suspended ', onboarding_status: 'pending', is_demo: true }),
    TenantSchema.parse({ id: 'c', name: 'Archiv', deleted: true, onboarding_status: null }),
];
const base = { search: '', status: 'all' as const, setup: 'all' as const, kind: 'all' as const, sort: 'name' };
describe('Händlerverzeichnis', () => {
    it('combines search terms across known fields and ignores letter case', () => {
        expect(filterDirectory(tenants, { ...base, search: 'MÜLLER nord +4930' }).map(t => t.id)).toEqual(['a']);
    });
    it('keeps demo, setup and status filters independently combinable', () => {
        expect(filterDirectory(tenants, { ...base, kind: 'demo', setup: 'open', status: 'overdue' }).map(t => t.id)).toEqual(['b']);
        expect(filterDirectory(tenants, { ...base, kind: 'customer', setup: 'completed' }).map(t => t.id)).toEqual(['a']);
    });
    it('isolates archived accounts and includes suspended accounts in payment clarification', () => {
        expect(filterDirectory(tenants, { ...base, status: 'deleted' }).map(t => t.id)).toEqual(['c']);
        expect(filterDirectory(tenants, { ...base, status: 'overdue' }).map(t => t.id)).toEqual(['b']);
    });
    it('sorts normalized payment problems first without mutating the source', () => {
        expect(filterDirectory(tenants, { ...base, sort: 'attention' }).map(t => t.id)).toEqual(['b', 'a']);
        expect(tenants.map(t => t.id)).toEqual(['a', 'b', 'c']);
    });
    it('does not turn missing or unknown onboarding states into completion', () => {
        expect(setupLabel(null)).toBe('Nicht erfasst');
        expect(setupLabel('pending')).toBe('In Einrichtung');
        expect(setupLabel('individuelle Prüfung')).toBe('individuelle Prüfung');
    });
    it('escapes formula-like values, quotes and line breaks in the export', () => {
        expect(csvField('=HYPERLINK("example")')).toBe('"\'=HYPERLINK(""example"")"');
        expect(csvField('  +123')).toBe('"\'  +123"');
        expect(csvField('Firma;\nNord')).toBe('"Firma;\nNord"');
    });
});
