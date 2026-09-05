import { test, expect, type Page } from '@playwright/test';

const operator = { id: 'operator-a', username: 'Alex Beispiel', email: 'operator@example.test', role: 'superadmin', must_change_password: false, app_access: { admin: true, crm: true } };
const tenant = { id: 'dealer-a', name: 'Autozubehör Nord GmbH', slug: 'autozubehoer-nord', user_count: 2, max_users: 5, device_count: 3, max_devices: 10, is_active: true, onboarding_status: 'In Einrichtung', payment_status: 'paid' };
async function mockOperations(page: Page, failDetails = false) {
    const requests: string[] = [];
    await page.addInitScript(user => localStorage.setItem('pu.admin.session', JSON.stringify({ user, expiresAt: Date.now() + 3_600_000, tenantId: null })), operator);
    await page.route('**/api/**', async route => {
        const url = new URL(route.request().url());
        if (!url.pathname.startsWith('/api/')) return route.continue();
        if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204 });
        requests.push(url.pathname + url.search);
        let json: unknown = {};
        if (url.pathname === '/api/admin-auth/me') json = operator;
        if (url.pathname === '/api/admin/tenants') json = [tenant];
        if (url.pathname === '/api/admin/tenants/dealer-a/detail') json = { tenant: { id: tenant.id, users: [], devices: [], settings: {}, stats: {}, orders: [], audit: [] } };
        if (url.pathname === '/api/admin/tenants/dealer-a/devices') json = [];
        if (url.pathname === '/api/admin/tenants/dealer-a/onboarding-health') json = { health: null };
        if (url.pathname === '/api/admin/tenants/dealer-a/operations') json = { generatedAt: '2026-09-04T12:00:00Z', orders: { total: 143, open: 12, completed: 131, lastOrderAt: '2026-09-04T10:30:00Z' }, finance: { issuedCount: 96, openCount: 4, overdueCount: 1, outstandingCents: 129900, overdueCents: 19000, currency: 'EUR' }, inventory: null, procurement: { openOrders: 3, overdueOrders: 0 }, unavailable: ['inventory'] };
        if (url.pathname.endsWith('/operations/invoices')) {
            if (failDetails) return route.fulfill({ status: 503, json: { error: 'Source unavailable' } });
            json = { section: 'invoices', filter: url.searchParams.get('filter'), generatedAt: '2026-09-04T12:00:00Z', items: url.searchParams.get('filter') === 'overdue' ? [] : [{ id: url.searchParams.has('cursor') ? 'inv-b' : 'inv-a', label: url.searchParams.has('cursor') ? 'RE-2026-0102' : 'RE-2026-0101', detail: 'Werkstatt Nord', status: 'issued', occurredAt: '2026-08-20T12:00:00Z', dueAt: '2026-09-10T12:00:00Z', amountCents: 19900, currency: 'EUR', stock: null, minimumStock: null }], nextCursor: url.searchParams.has('cursor') || url.searchParams.get('filter') === 'overdue' ? null : 'opaque-page-2' };
        }
        if (url.pathname === '/api/inbox/mailboxes') json = { transport: 'resend', mailboxes: [], sendingAddresses: [] };
        await route.fulfill({ json });
    });
    return requests;
}

test('ERP drilldown paginates and filters actual records without treating unavailable sources as zero', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    const requests = await mockOperations(page);
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('/tenants/dealer-a?tab=operations');
    await page.getByRole('button', { name: /Vorgänge ansehen\s*:\s*Rechnungen & Forderungen/ }).click();
    await expect(page.getByRole('cell', { name: 'RE-2026-0101 Werkstatt Nord' })).toBeVisible();
    await page.getByRole('button', { name: 'Weitere Vorgänge laden' }).click();
    await expect(page.getByRole('cell', { name: 'RE-2026-0102 Werkstatt Nord' })).toBeVisible();
    expect(requests).toContain('/api/admin/tenants/dealer-a/operations/invoices?filter=open&limit=50&cursor=opaque-page-2');
    await page.screenshot({ path: 'docs/upgrade-v2/erp-desktop.png', fullPage: true });
    await page.getByLabel('Vorgänge filtern').selectOption('overdue');
    await expect(page.getByText('Keine Vorgänge für diesen Filter vorhanden.')).toBeVisible();
    await expect(page.getByText('RE-2026-0101')).toHaveCount(0);
    expect(errors).toEqual([]);
});

test('ERP details show a retryable error and stay usable on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mockOperations(page, true);
    await page.goto('/tenants/dealer-a?tab=operations');
    await page.getByRole('button', { name: /Vorgänge ansehen\s*:\s*Rechnungen & Forderungen/ }).click();
    await expect(page.getByText('Vorgänge nicht verfügbar')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Keine Vorgänge für diesen Filter vorhanden.')).toHaveCount(0);
    await page.getByText('Vorgänge nicht verfügbar').scrollIntoViewIfNeeded();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: 'docs/upgrade-v2/erp-mobile-error.png', fullPage: true });
});

test('ERP records remain readable in the mobile table without expanding the page width', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mockOperations(page);
    await page.goto('/tenants/dealer-a?tab=operations');
    await page.getByRole('button', { name: /Vorgänge ansehen\s*:\s*Rechnungen & Forderungen/ }).click();
    await page.getByRole('cell', { name: 'RE-2026-0101 Werkstatt Nord' }).scrollIntoViewIfNeeded();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(page.getByRole('cell', { name: '199,00 €' })).toBeVisible();
    await page.screenshot({ path: 'docs/upgrade-v2/erp-mobile.png', fullPage: true });
});
