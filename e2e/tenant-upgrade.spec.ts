import { test, expect, type Page } from '@playwright/test';

const operator = { id: 'operator-a', username: 'Fecat', email: 'operator@example.test', role: 'superadmin', must_change_password: false, app_access: { admin: true, crm: true } };
const tenant = { id: 'dealer-a', name: 'Autozubehör Nord GmbH', slug: 'autozubehoer-nord', user_count: 2, max_users: 5, device_count: 3, max_devices: 10, is_active: true, onboarding_status: 'In Einrichtung', payment_status: 'paid' };

async function mockMerchant(page: Page) {
    let provisioning = { ownerName: null as string | null, dueAt: null as string | null, stage: 'draft', checks: {}, notes: '', updatedAt: null as string | null, version: 0, readiness: { ready: false, blockers: ['WhatsApp-Verbindung fehlt.', 'Einweisung noch nicht abgeschlossen.'] } };
    const saves: Array<Record<string, unknown>> = [];
    await page.route('**/health/live', route => route.fulfill({ json: { alive: true } }));
    await page.addInitScript((user) => localStorage.setItem('pu.admin.session', JSON.stringify({ user, expiresAt: Date.now() + 3_600_000, tenantId: null })), operator);
    await page.route('**/api/**', async route => {
        const url = new URL(route.request().url());
        if (!url.pathname.startsWith('/api/')) return route.continue();
        if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204 });
        let json: unknown = {};
        if (url.pathname === '/api/admin-auth/me') json = operator;
        if (url.pathname === '/api/admin/tenants') json = [tenant];
        if (url.pathname === '/api/admin/tenants/dealer-a/detail') json = { tenant: { id: tenant.id, users: [], devices: [], settings: {}, stats: {}, orders: [], audit: [] } };
        if (url.pathname === '/api/admin/tenants/dealer-a/devices') json = [];
        if (url.pathname === '/api/admin/tenants/dealer-a/onboarding-health') json = { health: null };
        if (url.pathname === '/api/admin/tenants/dealer-a/provisioning') {
            if (route.request().method() === 'PATCH') {
                const patch = route.request().postDataJSON();
                saves.push(patch);
                provisioning = { ...provisioning, ...patch, version: provisioning.version + 1, updatedAt: '2026-09-04T12:00:00.000Z' };
            }
            json = provisioning;
        }
        if (url.pathname === '/api/admin/tenants/dealer-a/readiness-profile') json = { billing: null, tax: null, dpaAcceptedAt: null, dpaVersion: null };
        if (url.pathname === '/api/admin/tenants/dealer-a/operations') json = { generatedAt: '2026-09-04T12:00:00.000Z', orders: { total: 143, open: 12, completed: 131, lastOrderAt: '2026-09-04T10:30:00.000Z' }, finance: { issuedCount: 96, openCount: 4, overdueCount: 1, outstandingCents: 129900, overdueCents: 19000, currency: 'EUR' }, inventory: null, procurement: { openOrders: 3, overdueOrders: 0 }, unavailable: ['inventory'] };
        if (url.pathname === '/api/inbox/mailboxes') json = { transport: 'resend', mailboxes: [], sendingAddresses: [] };
        if (url.pathname === '/api/admin/onboarding-pipeline') json = { summary: { total: 1, setup: 1, configured: 0, live: 0, atRisk: 0 }, tenants: [{ tenantId: tenant.id, name: tenant.name, risk: 'setup', ageDays: 4, planId: 'pro', whatsappConfigured: false, dpaAcceptedAt: null, createdAt: '2026-09-01T12:00:00Z' }] };
        if (url.pathname === '/api/admin/stats') json = { total_tenants: 18, total_users: 74, total_devices: 61, tenants: [tenant] };
        if (url.pathname === '/api/admin/kpis') json = { sales: { ordersToday: 12, revenue: 4840 }, team: { tenantCount: 18, activeUsers: 74 } };
        if (url.pathname === '/api/admin/appointments') json = { appointments: [{ id: 'appointment-a', title: 'Einweisung Warenwirtschaft', status: 'confirmed', customer_name: tenant.name, assignee_name: 'Fecat Vogt', start_at: new Date(Date.now() + 86_400_000).toISOString() }] };
        if (url.pathname === '/api/admin/access-requests') json = { requests: [{ id: 'request-a', status: 'failed' }] };
        if (url.pathname === '/api/admin/audit-log') json = { logs: [{ id: 'audit-a', admin_username: 'Fecat', action_type: 'TENANT_UPDATE', entity_name: tenant.name, created_at: new Date(Date.now() - 1_800_000).toISOString() }], hasMore: false, cursor: null };
        await route.fulfill({ json });
    });
    return { saves };
}

test('merchant workspace persists the onboarding workflow and opens factual ERP data', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    const state = await mockMerchant(page);
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('/tenants/dealer-a?tab=onboarding');
    await expect(page.getByRole('heading', { name: 'Einrichtung steuern' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('WhatsApp-Verbindung fehlt.')).toBeVisible();
    await page.getByLabel('Verantwortlich', { exact: true }).fill('Fecat Vogt');
    await page.getByLabel('Geplante Übergabe').fill('2026-09-10');
    await page.getByLabel('Bearbeitungsphase').selectOption('provisioning');
    await page.getByLabel(/Vertrag und Tarif geprüft/).check();
    await page.getByRole('button', { name: 'Stand speichern' }).click();
    await expect(page.getByText('Bearbeitungsstand gespeichert.')).toBeVisible();
    expect(state.saves).toEqual([expect.objectContaining({ ownerName: 'Fecat Vogt', dueAt: '2026-09-10T12:00:00.000Z', stage: 'provisioning', version: 0, checks: { contract: true } })]);
    await page.evaluate(() => document.querySelectorAll('*').forEach(element => { if (element.scrollHeight > element.clientHeight) element.scrollTop = 0; }));
    await page.screenshot({ path: 'test-results/upgrade-onboarding-desktop.png', fullPage: true });
    await page.getByRole('button', { name: 'Bestellungen & ERP' }).click();
    await expect(page.getByRole('heading', { name: 'Betriebsübersicht' })).toBeVisible();
    await expect(page.getByText('143', { exact: true })).toBeVisible();
    await expect(page.getByText('Datenquelle nicht verfügbar.', { exact: true })).toBeVisible();
    expect(errors).toEqual([]);
});

test('merchant onboarding stays within the phone viewport', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mockMerchant(page);
    await page.goto('/tenants/dealer-a?tab=onboarding');
    await expect(page.getByRole('heading', { name: 'Einrichtung steuern' })).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Händlerbereich', exact: true })).toHaveValue('onboarding');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: 'test-results/upgrade-onboarding-mobile.png', fullPage: true });
});

test('operating overview is actionable at desktop and phone sizes without decorative dashboard filler', async ({ page }) => {
    await mockMerchant(page);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Arbeitsübersicht', exact: true })).toBeVisible();
    const queue = page.getByRole('region', { name: 'Händler in Bearbeitung' });
    const action = queue.getByRole('link', { name: /Autozubehör Nord GmbH/ });
    await expect(action).toBeVisible();
    await expect(page.getByText('Einweisung Warenwirtschaft', { exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Guten|Gute Nacht|Guten Abend/ })).toHaveCount(0);
    await page.screenshot({ path: 'test-results/workspace-overview-desktop.png', fullPage: true });
    await action.focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/tenants\/dealer-a\?tab=onboarding/);
    await page.goto('/');
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(queue.getByRole('link', { name: /Autozubehör Nord GmbH/ })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: 'test-results/workspace-overview-mobile.png', fullPage: true });
});
