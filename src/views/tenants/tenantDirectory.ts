import type { Tenant } from '@/api/types';

export type DirectoryStatus = 'all' | 'active' | 'inactive' | 'trial' | 'overdue' | 'deleted';
export type DirectorySetup = 'all' | 'open' | 'completed';
export type DirectoryKind = 'all' | 'customer' | 'demo';
export const normalizeStatus = (value?: string | null): string => value?.trim().toLowerCase() ?? '';

export function setupComplete(tenant: Tenant): boolean {
    return ['completed', 'complete', 'live', 'abgeschlossen'].includes(normalizeStatus(tenant.onboarding_status));
}

export function setupLabel(value?: string | null): string {
    const status = normalizeStatus(value);
    if (!status) return 'Nicht erfasst';
    if (['completed', 'complete', 'live', 'abgeschlossen'].includes(status)) return 'Abgeschlossen';
    if (['pending', 'setup', 'draft', 'in einrichtung'].includes(status)) return 'In Einrichtung';
    if (status === 'configured') return 'Konfiguriert';
    return value!.trim();
}

/** Work queues use the same status rules as the directory, excluding tombstones. */
export function directorySummary(tenants: Tenant[]) {
    return tenants.reduce((result, tenant) => {
        if (tenant.deleted) return result;
        result.total++;
        if (!setupComplete(tenant)) result.setup++;
        if (!tenant.is_active) result.inactive++;
        if (['overdue', 'suspended'].includes(normalizeStatus(tenant.payment_status))) result.payment++;
        result.users += tenant.user_count ?? 0;
        result.devices += tenant.device_count ?? 0;
        return result;
    }, { total: 0, setup: 0, payment: 0, inactive: 0, users: 0, devices: 0 });
}

export function filterDirectory(tenants: Tenant[], options: { search: string; status: DirectoryStatus; setup: DirectorySetup; kind: DirectoryKind; sort: string }): Tenant[] {
    const terms = options.search.trim().toLocaleLowerCase('de').split(/\s+/).filter(Boolean);
    return tenants.filter(tenant => {
        if (Boolean(tenant.deleted) !== (options.status === 'deleted')) return false;
        if (options.status === 'active' && !tenant.is_active) return false;
        if (options.status === 'inactive' && tenant.is_active) return false;
        if (options.status === 'trial' && normalizeStatus(tenant.payment_status) !== 'trial') return false;
        if (options.status === 'overdue' && !['overdue', 'suspended'].includes(normalizeStatus(tenant.payment_status))) return false;
        if (options.setup === 'open' && setupComplete(tenant)) return false;
        if (options.setup === 'completed' && !setupComplete(tenant)) return false;
        if (options.kind === 'demo' && !tenant.is_demo) return false;
        if (options.kind === 'customer' && tenant.is_demo) return false;
        const haystack = [tenant.name, tenant.slug, tenant.id, tenant.whatsapp_number].filter(Boolean).join(' ').toLocaleLowerCase('de');
        return terms.every(term => haystack.includes(term));
    }).sort((a, b) => {
        const byName = a.name.localeCompare(b.name, 'de') || a.id.localeCompare(b.id);
        if (options.sort === 'attention') return Number(['overdue', 'suspended'].includes(normalizeStatus(b.payment_status))) - Number(['overdue', 'suspended'].includes(normalizeStatus(a.payment_status))) || byName;
        if (options.sort === 'newest') return (Date.parse(b.created_at ?? '') || 0) - (Date.parse(a.created_at ?? '') || 0) || byName;
        return byName;
    });
}

/** Quoted CSV fields are not sufficient protection against spreadsheet formulas. */
export function csvField(value: unknown): string {
    let text = String(value ?? '');
    if (/^[\s]*[=+@-]|^[\t\r\n]/.test(text)) text = "'" + text;
    return '"' + text.replace(/"/g, '""') + '"';
}
