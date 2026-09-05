import { test, expect as baseExpect, type Page } from '@playwright/test';
// Local cold module transforms share CPU with the other workspace checks.
const expect = baseExpect.configure({ timeout: 20_000 });
const crmBase = process.env.CRM_SMOKE_URL || 'http://127.0.0.1:5204';
const operator = { id: 'operator', username: 'Alex Meyer', email: 'alex@example.test', role: 'superadmin', app_access: { admin: true, crm: true }, must_change_password: false };
const dealer = { id: 'nord', name: 'Autozubehör Nord GmbH', slug: 'autozubehoer-nord', is_active: true, user_count: 4, max_users: 10, device_count: 3, max_devices: 5, payment_status: 'paid', onboarding_status: 'pending', whatsapp_number: '+49405550123', created_at: '2026-08-10T12:00:00Z' };
async function fixtures(page: Page, options: { readonly?: boolean; profileError?: boolean; empty?: boolean } = {}) {
    const user = options.readonly ? { ...operator, role: 'viewer' } : operator;
    let profileFails = Boolean(options.profileError);
    const requests: string[] = [];
    const writes: { path: string; body: unknown }[] = [];
    const tenants = options.empty ? [] : [dealer, { ...dealer, id: 'demo', slug: 'demo-teilehaus', name: 'Demo Teilehaus', is_demo: true, payment_status: ' Suspended ' }, ...Array.from({ length: 28 }, (_, i) => ({ ...dealer, id: `kunde-${i}`, name: `Teilehandel ${String(i + 1).padStart(2, '0')}`, slug: `teilehandel-${i}`, onboarding_status: 'completed' }))];
    let profile = { billing: { company_name: 'Autozubehör Nord Handelsgesellschaft mbH', company_address: 'Hafenstraße 24', company_zip: '20457', company_city: 'Hamburg', iban: 'DE89370400440532013000' }, tax: { business_type: 'company', tax_method: 'SOLL', small_business: false, period_type: 'monthly', vat_id: 'DE123456789', tax_number: '123/456/789' }, dpaAcceptedAt: '2026-08-10T12:00:00Z', dpaVersion: 'avv-2026-06' };
    await page.addInitScript(user => { localStorage.setItem('theme', 'light'); localStorage.setItem('crm_theme', 'light'); localStorage.setItem('pu.admin.session', JSON.stringify({ user, expiresAt: Date.now() + 3_600_000, tenantId: null })); }, user);
    await page.route('**/health/live', route => route.fulfill({ json: { alive: true } }));
    await page.route('**/api/**', async route => {
        const request = route.request(); const path = new URL(request.url()).pathname;
        if (!path.startsWith('/api/')) return route.continue();
        if (request.method() === 'OPTIONS') return route.fulfill({ status: 204 });
        requests.push(path);
        if (!['GET', 'HEAD'].includes(request.method())) writes.push({ path, body: request.postDataJSON() });
        let json: unknown = {};
        if (path === '/api/admin-auth/me') json = request.headers()['x-partsunion-app'] === 'crm' ? { user } : user;
        if (path === '/api/admin/tenants') json = tenants;
        if (/\/tenants\/[^/]+\/detail$/.test(path)) json = { tenant: { id: path.split('/')[4], users: [{ id: 'owner-nord', name: 'Anna Nord', username: 'anna.nord', email: 'anna@nord.example.test', role: 'merchant', is_active: true, created_at: '2026-08-10' }], devices: [], settings: { max_users: 10, max_devices: 5 }, stats: {} } };
        if (path.endsWith('/devices')) json = [];
        if (path.endsWith('/onboarding-health')) json = { health: null };
        if (path.endsWith('/readiness-profile')) {
            if (profileFails) return route.fulfill({ status: 503, json: { error: 'Test-only source unavailable' } });
            if (request.method() === 'PATCH') { const patch = request.postDataJSON(); profile = { ...profile, billing: { ...profile.billing, ...patch.billing } }; }
            json = profile;
        }
        if (path.endsWith('/provisioning')) json = { ownerName: 'Miriam Weber', dueAt: '2026-09-14T12:00:00Z', stage: 'integration', checks: {}, notes: '', updatedAt: '2026-09-04T14:00:00Z', version: 3, readiness: { ready: false, blockers: ['WhatsApp-Verbindung prüfen', 'Einweisung mit dem Händler abschließen'] } };
        if (path.endsWith('/provisioning/history')) json = { events: [], hasMore: false, nextCursor: null };
        if (path === '/api/admin/onboarding-pipeline') json = { summary: { total: 30, setup: 2, configured: 0, live: 28, atRisk: 0 }, tenants: [] };
        if (path === '/api/inbox/mailboxes') json = { mailboxes: [], sendingAddresses: [], transport: 'resend' };
        if (path === '/api/admin/access-requests') json = { requests: [] };
        if (path.endsWith('/appointments')) json = { appointments: [] };
        if (path.endsWith('/appointments/admins')) json = { admins: [] };
        if (path.endsWith('/crm/leads')) json = [{ id: 'lead-a', company: 'Teilehandel West', contactPerson: 'Eva Sommer', email: 'eva@example.test', phone: '+49221555012', city: 'Köln', country: 'DE', status: 'Neu', dealerType: 'neuteile', source: 'Empfehlung', tags: [], createdAt: '2026-09-01', updatedAt: '2026-09-04' }];
        if (path.endsWith('/crm/settings')) json = { settings: { pipelineStages: [{ id: 'new', name: 'Neu', category: 'open', isActive: true, order: 1 }], statuses: ['Neu'], sources: ['Empfehlung'], tags: [], industries: [] } };
        if (path.endsWith('/crm/teams')) json = { teams: [] };
        if (path.endsWith('/crm/users')) json = { users: [user] };
        if (path.endsWith('/lead-lists') || path.endsWith('/activities')) json = [];
        await route.fulfill({ json });
    });
    return { requests, writes, recoverProfile: () => { profileFails = false; } };
}

test('directory combines URL filters, paginates, exports the filtered set and restores list context', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    const state = await fixtures(page);
    await page.goto('/tenants');
    await expect(page.locator('tbody tr')).toHaveCount(25);
    await page.getByRole('button', { name: 'Weiter', exact: true }).click();
    await expect(page.locator('tbody tr')).toHaveCount(5);
    await page.getByLabel('Einrichtung filtern').selectOption('open');
    await page.getByLabel('Kontotyp filtern').selectOption('customer');
    await expect(page.locator('tbody tr')).toHaveCount(1);
    await expect(page).toHaveURL(/setup=open/);
    await page.reload();
    await expect(page.getByLabel('Kontotyp filtern')).toHaveValue('customer');
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'CSV exportieren' }).click();
    const stream = await (await download).createReadStream(); let csv = '';
    for await (const chunk of stream!) csv += chunk.toString();
    expect(csv).toContain(dealer.name); expect(csv).not.toContain('Demo Teilehaus');
    await page.getByRole('link', { name: dealer.name, exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Firma & Kontakt' })).toBeVisible();
    await expect(page.locator('[aria-label="Kundenakte"]').getByText('Anna Nord', { exact: true })).toBeVisible();
    await expect(page.getByText('Miriam Weber', { exact: true })).toBeVisible();
    await page.screenshot({ path: 'docs/customer-workspace/customer-record-desktop.png' });
    await page.getByRole('link', { name: '← Händlerübersicht' }).click();
    await expect(page.getByLabel('Einrichtung filtern')).toHaveValue('open');
    await expect(page.locator('tbody tr')).toHaveCount(1);
    await page.getByRole('button', { name: 'Filter zurücksetzen' }).click();
    await expect(page.locator('tbody tr')).toHaveCount(25);
    await page.screenshot({ path: 'docs/customer-workspace/customer-directory-desktop.png' });
    expect(state.writes).toEqual([]);
});

test('customer record preserves source errors, retries and saves only changed company fields', async ({ page }) => {
    const state = await fixtures(page, { profileError: true });
    await page.goto('/tenants/nord');
    await expect(page.getByText('Firmendaten konnten nicht geladen werden.')).toBeVisible();
    await expect(page.getByText('Nicht dokumentiert', { exact: true })).toHaveCount(0);
    state.recoverProfile();
    await page.getByRole('button', { name: 'Firmendaten erneut laden' }).click();
    await expect(page.getByText('Autozubehör Nord Handelsgesellschaft mbH', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Firmendaten bearbeiten' }).click();
    await page.getByLabel('Ort', { exact: true }).fill('Bremen');
    await page.getByRole('button', { name: 'Angaben speichern' }).click();
    await expect(page.getByRole('button', { name: 'Angaben speichern' })).toBeDisabled();
    expect(state.writes).toEqual([{ path: '/api/admin/tenants/nord/readiness-profile', body: { billing: { company_city: 'Bremen' } } }]);
    await page.getByRole('button', { name: 'Übersicht', exact: true }).click();
    await expect(page.getByText(/20457 Bremen/)).toBeVisible();
});

test('read-only operators see company information without lifecycle or editing actions', async ({ page }) => {
    const state = await fixtures(page, { readonly: true });
    await page.goto('/tenants');
    await page.getByRole('button', { name: `Aktionen für ${dealer.name}` }).click();
    await expect(page.getByRole('menuitem', { name: 'Deaktivieren', exact: true })).toHaveCount(0);
    await expect(page.getByRole('menuitem', { name: 'Sperren', exact: true })).toHaveCount(0);
    await page.getByRole('menuitem', { name: 'Kundenakte öffnen' }).click();
    await expect(page.getByRole('button', { name: 'Firmendaten bearbeiten' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Firmendaten', exact: true }).click();
    await expect(page.getByLabel('Vollständiger Firmenname')).toBeDisabled();
    await expect(page.getByLabel('Firmen-/Anzeigename')).toBeDisabled();
    expect(state.writes).toEqual([]);
});

test('mobile directory controls and customer record stay within the viewport', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await fixtures(page);
    await page.goto('/tenants?q=Nord');
    await expect(page.locator('tbody tr')).toHaveCount(1);
    await expect(page.getByRole('button', { name: 'CSV exportieren' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByRole('link', { name: dealer.name, exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Firma & Kontakt' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: 'docs/customer-workspace/customer-record-mobile.png' });
    await page.getByRole('combobox', { name: 'Händlerbereich', exact: true }).selectOption('profile');
    await expect(page.getByLabel('Vollständiger Firmenname')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

async function geometry(page: Page) {
    await page.evaluate(() => document.fonts.ready);
    return page.evaluate(() => {
        const box = (selector: string) => { const element = document.querySelector<HTMLElement>(selector)!; const rect = element.getBoundingClientRect(); return { width: Math.round(rect.width), height: Math.round(rect.height), font: getComputedStyle(element).fontFamily }; };
        return { sidebar: box('aside[aria-label="Hauptnavigation"]'), header: box('header[role="banner"]'), search: box('[aria-label="Befehlspalette öffnen"]'), avatar: box('[aria-label="Benutzermenü"]'), interLoaded: Array.from(document.fonts).some(font => font.family.includes('Inter Variable') && font.status === 'loaded') };
    });
}

test('discarding customer edits resets the draft and preserves it when leaving is declined', async ({ page }) => {
    const state = await fixtures(page);
    await page.goto('/tenants/nord?tab=profile');
    await page.getByLabel('Firmen-/Anzeigename').fill('Nicht gespeicherte Umbenennung');
    await page.getByRole('button', { name: 'Übersicht', exact: true }).click();
    const prompt = page.getByRole('dialog', { name: 'Ungespeicherte Änderungen' });
    await expect(prompt).toBeVisible();
    await prompt.getByRole('button', { name: 'Weiter bearbeiten' }).click();
    await expect(page.getByLabel('Firmen-/Anzeigename')).toHaveValue('Nicht gespeicherte Umbenennung');
    await page.getByRole('button', { name: 'Übersicht', exact: true }).click();
    await prompt.getByRole('button', { name: 'Verwerfen und wechseln' }).click();
    await expect(page.getByRole('heading', { name: 'Firma & Kontakt' })).toBeVisible();
    await page.getByRole('button', { name: 'Firmendaten', exact: true }).click();
    await expect(page.getByLabel('Firmen-/Anzeigename')).toHaveValue(dealer.name);
    expect(state.writes).toEqual([]);
});

test('empty search results offer filter recovery without implying an empty customer database', async ({ page }) => {
    await fixtures(page);
    await page.goto('/tenants?q=KeinTreffer&kind=demo');
    await expect(page.getByRole('heading', { name: 'Keine Kunden gefunden' })).toBeVisible();
    await page.getByRole('button', { name: 'Alle Händler anzeigen' }).click();
    await expect(page.locator('tbody tr')).toHaveCount(25);
    await expect(page.getByLabel('Kunden durchsuchen')).toHaveValue('');
    await expect(page.getByLabel('Kontotyp filtern')).toHaveValue('all');
});

test('Admin and CRM share actual shell dimensions and locally loaded typography', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await fixtures(page);
    await page.goto('/tenants?q=Nord');
    await expect(page.getByRole('heading', { name: 'Händlerübersicht' })).toBeVisible();
    const admin = await geometry(page);
    await page.goto(`${crmBase}/leads`);
    await expect(page.getByRole('heading', { name: 'Leads', exact: true })).toBeVisible();
    const crm = await geometry(page);
    expect(crm).toEqual(admin);
    expect(crm.header.height).toBe(64); expect(crm.sidebar.width).toBe(256); expect(crm.interLoaded).toBe(true);
    expect(await page.getByRole('button', { name: 'Befehlspalette öffnen' }).evaluate(element => getComputedStyle(element).borderTopColor)).toBe('rgb(223, 227, 232)');
    await page.screenshot({ path: '../CRM-System/docs/customer-workspace/crm-shell-desktop.png' });
    await page.getByRole('button', { name: 'Sidebar einklappen' }).click();
    await page.mouse.move(1100, 60);
    await expect(page.getByRole('button', { name: 'Leads', exact: true }).first()).toBeVisible();
    await page.getByRole('button', { name: 'Leads', exact: true }).first().focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { name: 'Leads', exact: true })).toBeVisible();
});

test('CRM mobile navigation traps focus, closes with Escape and restores the trigger', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await fixtures(page);
    await page.goto(`${crmBase}/leads`);
    await expect(page.getByRole('heading', { name: 'Leads', exact: true })).toBeVisible();
    const trigger = page.getByRole('button', { name: 'Navigation öffnen' });
    await trigger.click();
    const dialog = page.getByRole('dialog', { name: 'CRM-Navigation' });
    await expect(dialog).toBeVisible();
    for (let index = 0; index < 16; index++) {
        await page.keyboard.press('Tab');
        expect(await dialog.evaluate(element => element.contains(document.activeElement))).toBe(true);
    }
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: '../CRM-System/docs/customer-workspace/crm-shell-mobile.png' });
});
