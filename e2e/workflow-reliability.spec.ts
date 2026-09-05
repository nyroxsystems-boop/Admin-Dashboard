import { test, expect, type Page } from '@playwright/test';

const admin = { id: 'operator-a', username: 'Alex Beispiel', email: 'operator@example.test', role: 'superadmin', must_change_password: false, app_access: { admin: true, crm: true } };
const tenant = { id: 'dealer-a', name: 'Autozubehör Nord GmbH', slug: 'nord', user_count: 2, device_count: 1, is_active: true, onboarding_status: 'In Einrichtung', payment_status: 'paid' };

async function adminFixtures(page: Page) {
  let provisioning = { ownerName: null, dueAt: null, stage: 'draft', checks: {}, notes: '', updatedAt: null, version: 0, readiness: { ready: false, blockers: ['Einweisung fehlt.'] } };
  let resumeSave: (() => void) | undefined;
  const state = { holdSave: false, saveStarted: false, releaseSave: () => resumeSave?.() };
  await page.addInitScript(user => localStorage.setItem('pu.admin.session', JSON.stringify({ user, expiresAt: Date.now() + 3600000, tenantId: null })), admin);
  await page.route('**/api/**', async route => {
    const req = route.request(); const url = new URL(req.url());
    if (!url.pathname.startsWith('/api/')) return route.continue();
    let json: unknown = {};
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204 });
    if (url.pathname === '/api/admin-auth/me') json = admin;
    if (url.pathname === '/api/admin/tenants') json = [tenant];
    if (url.pathname.endsWith('/dealer-a/detail')) json = { tenant: { id: tenant.id, users: [], devices: [], settings: {}, stats: {}, orders: [], audit: [] } };
    if (url.pathname.endsWith('/dealer-a/devices')) json = [];
    if (url.pathname.endsWith('/dealer-a/onboarding-health')) json = { health: null };
    if (url.pathname.endsWith('/dealer-a/readiness-profile')) json = { billing: null, tax: null, dpaAcceptedAt: null, dpaVersion: null };
    if (url.pathname.endsWith('/dealer-a/provisioning')) {
      if (req.method() === 'PATCH') {
        if (state.holdSave) await new Promise<void>(resolve => { resumeSave = resolve; state.saveStarted = true; });
        provisioning = { ...provisioning, ...req.postDataJSON(), version: provisioning.version + 1 };
      }
      json = provisioning;
    }
    if (url.pathname.endsWith('/dealer-a/operations')) json = { generatedAt: '2026-09-04T12:00:00Z', orders: { total: 5, open: 1, completed: 4, lastOrderAt: null }, finance: null, inventory: null, procurement: null, unavailable: ['finance', 'inventory', 'procurement'] };
    if (url.pathname.endsWith('/operations/orders')) json = { section: 'orders', filter: 'open', generatedAt: '2026-09-04T12:00:00Z', items: [], nextCursor: null };
    if (url.pathname === '/api/inbox/mailboxes') json = { transport: 'resend', mailboxes: [{ id: 'info@partsunion.de', name: 'Team', address: 'info@partsunion.de', kind: 'shared', unread: 0, total: 0, canSend: true }], sendingAddresses: ['info@partsunion.de'] };
    if (url.pathname === '/api/inbox/emails') json = { emails: [], hasMore: false, cursor: null };
    await route.fulfill({ json });
  });
  return state;
}

test('Admin protects dirty setup on mobile tab changes and makes ERP drilldown keyboard-addressable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await adminFixtures(page);
  await page.goto('/tenants/dealer-a?tab=onboarding');
  await page.getByLabel('Verantwortlich', { exact: true }).fill('Nicht gespeicherter Name');
  await page.getByRole('combobox', { name: 'Händlerbereich' }).selectOption('operations');
  const prompt = page.getByRole('dialog', { name: 'Ungespeicherte Änderungen' });
  await expect(prompt).toBeVisible();
  await expect(page).toHaveURL(/tab=onboarding/);
  await expect.poll(async () => prompt.evaluate(element => {
    const bounds = element.getBoundingClientRect();
    return bounds.left >= 15 && bounds.right <= window.innerWidth - 15;
  })).toBe(true);
  await page.screenshot({ path: 'docs/upgrade-v3/admin-unsaved-mobile.png', fullPage: true });
  await prompt.getByRole('button', { name: 'Weiter bearbeiten' }).click();
  await expect(page.getByLabel('Verantwortlich', { exact: true })).toHaveValue('Nicht gespeicherter Name');
  await page.getByRole('combobox', { name: 'Händlerbereich' }).selectOption('operations');
  await page.getByRole('button', { name: 'Verwerfen und wechseln' }).click();
  await expect(page).toHaveURL(/tab=operations/);
  const trigger = page.getByRole('button', { name: /Vorgänge ansehen\s*:\s*Bestellungen/ });
  await trigger.click();
  await expect(page.getByRole('heading', { name: 'Bestellungen · Vorgänge' })).toBeFocused();
  await page.getByRole('button', { name: 'Vorgangsdetails schließen' }).click();
  await expect(trigger).toBeFocused();
});

test('Admin cannot discard an in-flight setup save; successful completion releases navigation', async ({ page }) => {
  const state = await adminFixtures(page); state.holdSave = true;
  await page.goto('/tenants/dealer-a?tab=onboarding');
  await page.getByLabel('Verantwortlich', { exact: true }).fill('Alex Beispiel');
  await page.getByRole('button', { name: 'Stand speichern' }).click();
  await page.getByRole('button', { name: 'Bestellungen & ERP' }).click();
  await expect(page.getByRole('dialog', { name: 'Speicherung läuft' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Verwerfen und wechseln' })).toBeDisabled();
  await expect.poll(() => state.saveStarted).toBe(true);
  state.releaseSave();
  await expect(page.getByRole('heading', { name: 'Betriebsübersicht' })).toBeVisible();
});

test('Admin mail asks before discarding an unsaved composer', async ({ page }) => {
  await adminFixtures(page);
  await page.goto('/mail');
  await page.getByRole('button', { name: 'Neue E-Mail', exact: true }).click();
  const composer = page.getByRole('dialog');
  await composer.getByLabel('Betreff', { exact: true }).fill('Noch nicht gesendete Rückfrage');
  page.once('dialog', dialog => dialog.dismiss());
  await composer.getByRole('button', { name: 'Abbrechen', exact: true }).click();
  await expect(composer.getByLabel('Betreff', { exact: true })).toHaveValue('Noch nicht gesendete Rückfrage');
  page.once('dialog', dialog => dialog.accept());
  await composer.getByRole('button', { name: 'Abbrechen', exact: true }).click();
  await expect(composer).toHaveCount(0);
});

const crmBase = process.env.CRM_SMOKE_URL || 'http://127.0.0.1:5202';
async function crmFixtures(page: Page) {
  const user = { id: 'sales-a', username: 'Vertrieb', email: 'sales@example.test', role: 'sales', crm_role: 'sales', app_access: { admin: false, crm: true } };
  let leads = ['A', 'B', 'C'].map((suffix, index) => ({ id: `lead-${suffix}`, company: `Teilehandel ${suffix}`, contactPerson: index === 1 ? '' : 'Alex Beispiel', email: index === 1 ? '' : 'kontakt@example.test', phone: '+49301234567', city: 'Berlin', country: 'DE', dealerType: 'neuteile', status: 'Neu', source: 'Empfehlung', tags: [], assignedTo: 'Vertrieb', createdAt: '2026-09-01', updatedAt: '2026-09-01', nextFollowUpDate: '2026-09-04' }));
  const mutations: string[] = [];
  let secondAllowed = false;
  await page.route('**/api/**', async route => {
    const req = route.request(); const path = new URL(req.url()).pathname;
    if (!path.startsWith('/api/')) return route.continue();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204 });
    let json: unknown = {};
    if (path.endsWith('/admin-auth/me')) json = { user };
    if (path.endsWith('/crm/leads')) json = leads;
    if (path.endsWith('/crm/settings')) json = { settings: { pipelineStages: [{ id: 'stage-1', name: 'Neu', category: 'open', isActive: true, order: 1 }], statuses: ['Neu'], sources: ['Empfehlung'], industries: [], tags: [] } };
    if (path.endsWith('/appointments/admins')) json = { admins: [{ id: user.id, username: user.username, name: user.username, email: user.email }] };
    if (path.endsWith('/appointments')) json = { appointments: [] };
    if (path.endsWith('/teams')) json = { teams: [] };
    if (path.endsWith('/lead-lists') || path.endsWith('/activities')) json = [];
    const match = path.match(/\/crm\/leads\/(lead-[ABC])$/);
    if (match && req.method() === 'DELETE') {
      mutations.push(match[1]);
      if (match[1] === 'lead-B' && !secondAllowed) return route.fulfill({ status: 503, json: { error: 'Änderung nicht bestätigt. Test-Verbindungsfehler.' } });
      leads = leads.filter(lead => lead.id !== match[1]);
      json = { success: true };
    }
    await route.fulfill({ json });
  });
  return { mutations, allowRetry: () => { secondAllowed = true; } };
}

test('CRM batch results retain failed leads and retry only the unconfirmed request', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const state = await crmFixtures(page);
  await page.goto(`${crmBase}/leads`);
  await page.getByRole('checkbox', { name: 'Alle auswählen', exact: true }).click();
  await page.getByRole('button', { name: 'Löschen', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Leads löschen' });
  await expect(dialog.getByRole('button', { name: '3 Leads löschen' })).toBeDisabled();
  await dialog.getByRole('checkbox').check();
  await dialog.getByRole('button', { name: '3 Leads löschen' }).click();
  await expect(dialog).toContainText('2 von 3 Änderungen bestätigt');
  expect(state.mutations).toEqual(['lead-A', 'lead-B', 'lead-C']);
  await page.screenshot({ path: '../CRM-System/docs/upgrade-v3/batch-partial-desktop.png', fullPage: true });
  state.allowRetry();
  await dialog.getByRole('button', { name: 'Nur fehlgeschlagene erneut versuchen' }).click();
  await expect(dialog).toContainText('3 von 3 Änderungen bestätigt');
  expect(state.mutations).toEqual(['lead-A', 'lead-B', 'lead-C', 'lead-B']);
  await dialog.getByRole('button', { name: 'Ergebnis schließen' }).click();
  await expect(page.getByText('0 von 0 Leads')).toBeVisible();
});

test('CRM browser Back keeps a dirty lead form when declined and navigates only after confirmation', async ({ page }) => {
  await crmFixtures(page);
  await page.goto(crmBase);
  await page.getByRole('button', { name: 'Leads', exact: true }).first().click();
  await page.getByRole('button', { name: 'Neuer Lead', exact: true }).click();
  await page.getByLabel('Firma / Händler').fill('Ungespeicherter Händler');
  page.once('dialog', dialog => dialog.dismiss());
  await page.goBack();
  await expect(page).toHaveURL(/\/leads$/);
  await expect(page.getByLabel('Firma / Händler')).toHaveValue('Ungespeicherter Händler');
  page.once('dialog', dialog => dialog.accept());
  await page.goBack();
  await expect(page.getByRole('heading', { name: 'Arbeitsübersicht', exact: true })).toBeVisible();
});

test('CRM mobile leads expose contact, ownership, next action and data completeness', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await crmFixtures(page);
  await page.goto(`${crmBase}/leads`);
  await expect(page.getByRole('button', { name: 'Lead Teilehandel A öffnen' })).toBeVisible();
  await expect(page.getByText('Basisdaten vollständig · nicht extern verifiziert').first()).toBeVisible();
  await expect(page.getByRole('link', { name: '+49301234567' }).first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: '../CRM-System/docs/upgrade-v3/leads-mobile.png', fullPage: true });
});
