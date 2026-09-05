import { test, expect, type Page } from '@playwright/test';

const operator = { id: 'operator-a', username: 'operator', email: 'operator@example.test', role: 'superadmin', must_change_password: false, app_access: { admin: true, crm: true } };
const longHtml = `<table style="width:100%;background:#ffffff;color:#17212f"><tr><td><h2>Lieferung bestätigt</h2>
    <p>Ihre Bestellung wurde vorbereitet.</p>${'<p>Artikel · Liefertermin · Menge 12</p>'.repeat(32)}
    <img src="https://mail-image.example.test/pixel.png" alt="Produktbild" width="40" height="40">
    <div style="background-image:url(https://mail-image.example.test/css.png)">Keine externen CSS-Ressourcen</div>
    <script>parent.mailScriptExecuted=true</script><form action="https://mail-image.example.test/submit"><input name="secret"></form>
    </td></tr></table>`;
const messages = [
    { id: 'mail-a', from: 'supplier@example.test', from_name: 'Lieferant Beispiel', to: ['info@partsunion.de'], cc: [], subject: 'Lieferung bestätigt', body: 'Ihre Bestellung wurde vorbereitet.', html: longHtml,
        received_at: '2026-09-04T10:00:00Z', is_read: true, mailbox: 'info@partsunion.de', mailboxes: ['info@partsunion.de'], folder: 'inbox', attachments: [], direction: 'inbound', assignment_status: 'open', assigned_to: null },
    { id: 'mail-b', from: 'supplier@example.test', from_name: 'Lieferant Beispiel', to: ['info@partsunion.de'], cc: [], subject: 'Kurze Rückfrage', body: 'Bitte bestätigen: Menge < 15 & Termin Freitag.', html: null,
        received_at: '2026-09-04T11:00:00Z', is_read: true, mailbox: 'info@partsunion.de', mailboxes: ['info@partsunion.de'], folder: 'inbox', attachments: [], direction: 'inbound', assignment_status: 'open', assigned_to: null },
];

async function mockMailbox(page: Page, noteConflict = false) {
    const data = structuredClone(messages);
    const mutations: Array<Record<string, unknown>> = [];
    const remoteRequests: string[] = [];
    await page.addInitScript((user) => localStorage.setItem('pu.admin.session', JSON.stringify({ user, expiresAt: Date.now() + 3_600_000, tenantId: null })), operator);
    await page.route('https://mail-image.example.test/**', async route => {
        remoteRequests.push(route.request().url());
        await route.fulfill({ status: 200, contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jOzQAAAAASUVORK5CYII=', 'base64') });
    });
    await page.route('**/api/**', async route => {
        const url = new URL(route.request().url());
        if (!url.pathname.startsWith('/api/')) return route.continue();
        let json: unknown = {};
        if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204 });
        if (url.pathname === '/api/admin-auth/me') json = operator;
        if (url.pathname === '/api/inbox/mailboxes') json = { transport: 'resend', mailboxes: [{ id: 'info@partsunion.de', name: 'Team', address: 'info@partsunion.de', kind: 'shared', unread: 0, total: 2, canSend: true }], sendingAddresses: ['info@partsunion.de'] };
        if (url.pathname === '/api/inbox/emails') json = { emails: data.map(message => ({ ...message, html: null })), hasMore: false, cursor: null };
        const match = url.pathname.match(/^\/api\/inbox\/email\/(mail-[ab])(?:\/(.*))?$/);
        if (match) {
            const message = data.find(item => item.id === match[1])!;
            if (!match[2]) json = message;
            else if (match[2] === 'thread') json = { emails: data.map(item => ({ ...item, html: null })), hasMore: false };
            else if (match[2] === 'assign') {
                const body = route.request().postDataJSON();
                mutations.push(body);
                if ('notes' in body && noteConflict) return route.fulfill({ status: 409, json: { error: 'Die Notiz wurde inzwischen geändert.', code: 'MAIL_NOTE_CONFLICT' } });
                if ('notes' in body) Object.assign(message, { assignment_notes: body.notes });
                if ('assignedTo' in body) Object.assign(message, { assigned_to: body.assignedTo || null });
                if ('status' in body) Object.assign(message, { assignment_status: body.status });
                json = { success: true };
            } else json = { success: true };
        }
        await route.fulfill({ json });
    });
    return { mutations, remoteRequests };
}

test('mail preserves layout, blocks tracking/scripts and resets the reader between messages', async ({ page }) => {
    const state = await mockMailbox(page);
    const pageErrors: string[] = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    await page.goto('/mail');
    await page.getByText('Lieferung bestätigt', { exact: true }).first().click();
    const reader = page.frameLocator('iframe[title="E-Mail-Inhalt: Lieferung bestätigt"]');
    await expect(reader.getByRole('heading', { name: 'Lieferung bestätigt' })).toBeVisible();
    expect(state.remoteRequests).toEqual([]);
    await expect(reader.locator('script,form,input')).toHaveCount(0);
    expect(await page.evaluate(() => (window as unknown as Record<string, unknown>).mailScriptExecuted)).toBeUndefined();
    await expect(reader.locator('table')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
    const frame = page.locator('iframe[title="E-Mail-Inhalt: Lieferung bestätigt"]');
    await expect(frame).not.toHaveAttribute('sandbox', /allow-scripts|allow-forms|allow-top-navigation/);
    await expect.poll(async () => (await frame.boundingBox())?.height || 0).toBeGreaterThan(700);
    await page.screenshot({ path: 'test-results/upgrade-mail-desktop.png', fullPage: true });
    await page.getByRole('button', { name: 'Bilder laden', exact: true }).click();
    await expect.poll(() => state.remoteRequests.length).toBe(1);
    expect(state.remoteRequests[0]).toContain('/pixel.png');
    await page.getByRole('button', { name: 'Übernehmen', exact: true }).click();
    await expect(page.getByText('Von dir übernommen')).toBeVisible();
    expect(state.mutations[0]).toMatchObject({ messageId: 'mail-a', assignedTo: operator.id, status: 'in_progress' });
    await page.getByLabel('Bearbeitungsstatus', { exact: true }).selectOption('done');
    await expect(page.getByLabel('Bearbeitungsstatus', { exact: true })).toHaveValue('done');
    await page.getByText('Unterhaltung · 2 Nachrichten', { exact: true }).click();
    await page.getByRole('button').filter({ hasText: 'Kurze Rückfrage' }).last().click();
    const shortFrame = page.locator('iframe[title="E-Mail-Inhalt: Kurze Rückfrage"]');
    await expect(page.frameLocator('iframe[title="E-Mail-Inhalt: Kurze Rückfrage"]').getByText('Bitte bestätigen: Menge < 15 & Termin Freitag.')).toBeVisible();
    await expect.poll(async () => (await shortFrame.boundingBox())?.height || 1000).toBeLessThan(400);
    await expect(page.getByText('Externe Inhalte sind zum Schutz deiner Privatsphäre blockiert.')).toBeVisible();
    expect(pageErrors).toEqual([]);
});

test('mail remains usable on a phone without horizontal page overflow', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mockMailbox(page);
    await page.goto('/mail');
    await page.getByRole('combobox', { name: 'Mail-Ordner', exact: true }).selectOption('archive');
    await expect(page.getByRole('combobox', { name: 'Mail-Ordner', exact: true })).toHaveValue('archive');
    await page.getByRole('combobox', { name: 'Mail-Ordner', exact: true }).selectOption('inbox');
    await page.getByText('Kurze Rückfrage', { exact: true }).first().click();
    await expect(page.locator('iframe[title="E-Mail-Inhalt: Kurze Rückfrage"]')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.getByRole('button', { name: 'Weitere Nachrichtenaktionen' }).click();
    await expect(page.getByRole('menuitem', { name: 'Weiterleiten' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('menu')).toHaveCount(0);
    await expect(page.locator('iframe[title="E-Mail-Inhalt: Kurze Rückfrage"]')).toBeVisible();
    await page.screenshot({ path: 'docs/upgrade-v2/mail-mobile.png', fullPage: true });
});

test('internal notes persist separately and never enter the email composer', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    const state = await mockMailbox(page);
    await page.goto('/mail');
    await page.getByText('Kurze Rückfrage', { exact: true }).first().click();
    await expect(page.locator('iframe[title="E-Mail-Inhalt: Kurze Rückfrage"]')).toBeVisible();
    await page.getByText('Interne Notiz', { exact: true }).click();
    await page.getByRole('button', { name: 'Notiz bearbeiten' }).click();
    await page.getByLabel('Interne Notiz bearbeiten').fill('Intern: Rückmeldung zuerst mit Einkauf abstimmen.');
    // Clicking the active folder also closes the reader, so it must protect the note.
    page.once('dialog', dialog => dialog.dismiss());
    await page.getByRole('button', { name: /^Posteingang/ }).click();
    await expect(page.getByLabel('Interne Notiz bearbeiten')).toHaveValue('Intern: Rückmeldung zuerst mit Einkauf abstimmen.');
    await page.getByRole('button', { name: 'Notiz speichern' }).click();
    await expect(page.getByText('Interne Notiz gespeichert.', { exact: true })).toBeVisible();
    await expect(page.getByText('Intern: Rückmeldung zuerst mit Einkauf abstimmen.', { exact: true })).toBeVisible();
    expect(state.mutations).toContainEqual({ messageId: 'mail-b', notes: 'Intern: Rückmeldung zuerst mit Einkauf abstimmen.', expectedNotes: '' });
    await page.screenshot({ path: 'docs/upgrade-v2/mail-desktop.png', fullPage: true });
    await page.getByRole('button', { name: 'Antworten', exact: true }).first().click();
    const composer = page.getByRole('dialog');
    await expect(composer).toBeVisible();
    await expect(composer).not.toContainText('Rückmeldung zuerst mit Einkauf abstimmen');
});

test('a concurrent note edit keeps the user draft with a clear recovery action', async ({ page }) => {
    await mockMailbox(page, true);
    await page.goto('/mail');
    await page.getByText('Kurze Rückfrage', { exact: true }).first().click();
    await expect(page.locator('iframe[title="E-Mail-Inhalt: Kurze Rückfrage"]')).toBeVisible();
    await page.getByText('Interne Notiz', { exact: true }).click();
    await page.getByRole('button', { name: 'Notiz bearbeiten' }).click();
    await page.getByLabel('Interne Notiz bearbeiten').fill('My draft');
    await page.getByRole('button', { name: 'Notiz speichern' }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'Die Notiz wurde inzwischen geändert.' })).toBeVisible();
    await expect(page.getByLabel('Interne Notiz bearbeiten')).toHaveValue('My draft');
    await expect(page.getByRole('button', { name: 'Eingabe verwerfen und neu laden' })).toBeEnabled();
});

test('password reset uses fragment token without leaking it in the request URL', async ({ page }) => {
    const token = 'a'.repeat(64);
    const requests: string[] = [];
    let submitted: Record<string, string> | undefined;
    page.on('request', request => requests.push(request.url()));
    await page.route('**/api/admin-auth/reset-password', async route => {
        submitted = route.request().postDataJSON();
        await route.fulfill({ json: { success: true } });
    });
    await page.goto(`/reset-password#token=${token}`);
    await page.getByLabel('Neues Passwort', { exact: true }).fill('Test-Only#LongPassword9382');
    await page.getByLabel('Passwort wiederholen').fill('Test-Only#LongPassword9382');
    await page.getByRole('button', { name: 'Passwort speichern' }).click();
    await expect(page.getByRole('status')).toContainText('Dein Passwort wurde geändert');
    expect(submitted).toEqual({ token, newPassword: 'Test-Only#LongPassword9382' });
    expect(requests.some(url => url.includes(token))).toBe(false);
});
