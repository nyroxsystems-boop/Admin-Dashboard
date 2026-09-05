import { test, expect, type Page } from '@playwright/test';

const operator = { id: 'operator-a', username: 'operator', full_name: 'Alex Beispiel', email: 'operator@example.test', role: 'superadmin', must_change_password: false, app_access: { admin: true, crm: true } };
const original = {
    id: 'mail-original', direction: 'inbound', from: 'kunde@example.test', from_name: 'Anna Müller',
    to: ['info@partsunion.de', 'kunde@example.test', 'partner@example.test'], cc: ['einkauf@example.test', 'partner@example.test'], bcc: ['private@example.test'],
    subject: 'Rückfrage zum Händlerstart', body: 'Bitte prüfen Sie die offenen Angaben für unseren Händlerstart.\nKönnen wir die nächsten Schritte gemeinsam abstimmen?',
    html: '<p>Bitte prüfen Sie die offenen Angaben für unseren <strong>Händlerstart</strong>.</p><p>Können wir die nächsten Schritte gemeinsam abstimmen?</p>',
    received_at: '2026-09-04T10:00:00Z', is_read: true, mailbox: 'info@partsunion.de', mailboxes: ['info@partsunion.de'], folder: 'inbox',
    attachments: [{ id: 'original-file', filename: 'Stammdaten.pdf', content_type: 'application/pdf', size: 14 }], assignment_status: 'open', assigned_to: null, assignment_notes: 'INTERN: Nicht an Kunden weitergeben.',
};
const longBody = 'Vollständige, vertrauliche Entwurfsnotiz. '.repeat(25) + 'LETZTER SATZ BLEIBT ERHALTEN.';

async function fixture(page: Page, sendable = true) {
    let resumeSave: (() => void) | undefined;
    const state = { sends: [] as Record<string, unknown>[], saves: [] as Record<string, unknown>[], assignments: [] as Record<string, unknown>[], uploads: 0, downloads: 0, failSend: false, failFinish: false, failDraftLoad: false, holdSave: false, saveStarted: false, releaseSave: () => resumeSave?.() };
    const drafts: Record<string, Record<string, unknown>> = {
        'draft-1': { ...original, id: 'draft-1', folder: 'drafts', direction: 'outbound', from: 'info@partsunion.de', to: ['kunde@example.test'], cc: ['copy@example.test'], bcc: ['hidden@example.test'], body: longBody, html: `<p><strong>Wichtig:</strong> ${longBody}</p>`, in_reply_to: original.id, attachments: [] },
    };
    await page.addInitScript(user => localStorage.setItem('pu.admin.session', JSON.stringify({ user, expiresAt: Date.now() + 3_600_000, tenantId: null })), operator);
    await page.route('**/api/**', async route => {
        const req = route.request(); const url = new URL(req.url());
        if (!url.pathname.startsWith('/api/')) return route.continue();
        if (req.method() === 'OPTIONS') return route.fulfill({ status: 204 });
        let json: unknown = {};
        if (url.pathname === '/api/admin-auth/me') json = operator;
        if (url.pathname.includes('/profile')) json = { ...operator, signature: 'Alex Beispiel\nPartsunion\ninfo@partsunion.de' };
        if (url.pathname === '/api/inbox/mailboxes') json = { transport: 'resend', mailboxes: [{ id: 'info@partsunion.de', name: 'Team', address: 'info@partsunion.de', kind: 'shared', unread: 0, total: 2, canSend: sendable }], sendingAddresses: sendable ? ['info@partsunion.de'] : [] };
        if (url.pathname === '/api/inbox/emails') json = { emails: (url.searchParams.get('folder') === 'drafts' ? Object.values(drafts) : [original]).map(item => ({ ...item, body: String(item.body).slice(0, 200), html: null })), hasMore: false, cursor: null };
        if (url.pathname === '/api/inbox/contacts') json = { contacts: [{ address: 'einkauf@example.test', displayName: 'Einkauf Beispiel', lastSeen: '2026-09-04T10:00:00Z' }] };
        if (url.pathname === '/api/inbox/email/mail-original') json = original;
        if (url.pathname.endsWith('/thread')) json = { emails: [original], hasMore: false };
        if (url.pathname.startsWith('/api/inbox/email/draft-')) {
            if (state.failDraftLoad) return route.fulfill({ status: 503, json: { error: 'Entwurf momentan nicht verfügbar.' } });
            json = drafts[url.pathname.split('/').pop()!];
        }
        if (url.pathname === '/api/inbox/drafts' && req.method() === 'POST') {
            if (state.holdSave) await new Promise<void>(resolve => { resumeSave = resolve; state.saveStarted = true; });
            const body = req.postDataJSON(); state.saves.push(body); drafts['draft-new'] = { ...original, ...body, id: 'draft-new', folder: 'drafts', html: body.htmlContent, cc: body.cc || [], bcc: body.bcc || [], in_reply_to: body.replyToMessageId, attachments: [] }; json = { success: true, id: 'draft-new' };
        }
        if (/\/drafts\/[^/]+$/.test(url.pathname) && req.method() === 'PUT') { const body = req.postDataJSON(); state.saves.push(body); Object.assign(drafts[url.pathname.split('/').pop()!], body, { html: body.htmlContent }); json = { success: true }; }
        if (url.pathname.endsWith('/attachments') && req.method() === 'POST') { state.uploads++; json = { id: 'uploaded-' + state.uploads, filename: req.postDataJSON().filename, content_type: 'application/pdf', byte_size: 14 }; }
        if (url.pathname.endsWith('/attachments/original-file')) { state.downloads++; return route.fulfill({ contentType: 'application/pdf', body: '%PDF-1.4\nTEST' }); }
        if (url.pathname === '/api/inbox/email/send') { state.sends.push(req.postDataJSON()); if (state.failSend) return route.fulfill({ status: 503, json: { error: 'Keine eindeutige Versandbestätigung.' } }); json = { success: true, messageId: 'sent-1' }; }
        if (url.pathname.endsWith('/assign')) { state.assignments.push(req.postDataJSON()); if (state.failFinish) return route.fulfill({ status: 503, json: { error: 'Status momentan nicht verfügbar.' } }); json = { success: true }; }
        await route.fulfill({ json });
    });
    return state;
}

async function openOriginal(page: Page) {
    await page.goto('/mail');
    await page.getByText(original.subject, { exact: true }).first().click();
    await expect(page.locator('iframe')).toBeVisible();
}

test('reply-all provides original context and sends de-duplicated visible recipients without private data', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    const state = await fixture(page); await openOriginal(page);
    await page.getByRole('button', { name: 'Allen antworten', exact: true }).click();
    const composer = page.getByRole('dialog');
    await expect(composer.getByLabel('An', { exact: true })).toHaveValue('kunde@example.test; partner@example.test');
    await expect(composer.getByLabel('Cc', { exact: true })).toHaveValue('einkauf@example.test');
    await expect(composer.getByLabel('Bcc', { exact: true })).toHaveValue('');
    await expect(composer.getByRole('complementary', { name: 'Originalnachricht' })).toBeVisible();
    await expect(composer).not.toContainText('INTERN: Nicht an Kunden weitergeben.');
    await composer.getByRole('textbox', { name: 'E-Mail-Nachricht' }).fill('Vielen Dank. Wir klären die offenen Angaben gemeinsam.');
    await page.screenshot({ path: 'docs/mail-workbench/reply-all-desktop.png', fullPage: true });
    // Shortcut immediately after input must include the last character, not the debounced state.
    await page.keyboard.press('Control+Enter');
    await expect(composer.getByText('E-Mail erfolgreich gesendet.', { exact: true })).toBeVisible();
    expect(state.sends).toHaveLength(1);
    expect(state.sends[0]).toMatchObject({ to: ['kunde@example.test', 'partner@example.test'], cc: ['einkauf@example.test'], bcc: [], replyToMessageId: original.id, body: 'Vielen Dank. Wir klären die offenen Angaben gemeinsam.' });
});

test('full draft loading retains long content, rich formatting, Cc/Bcc and reply context through save', async ({ page }) => {
    const state = await fixture(page); await page.goto('/mail');
    await page.getByRole('button', { name: 'Entwürfe', exact: true }).click();
    await page.getByText(original.subject, { exact: true }).first().click();
    const composer = page.getByRole('dialog');
    await expect(composer.getByRole('textbox', { name: 'E-Mail-Nachricht' })).toContainText('LETZTER SATZ BLEIBT ERHALTEN.');
    await expect(composer.locator('[contenteditable] strong')).toHaveText('Wichtig:');
    await expect(composer.getByLabel('Cc', { exact: true })).toHaveValue('copy@example.test');
    await expect(composer.getByLabel('Bcc', { exact: true })).toHaveValue('hidden@example.test');
    await composer.getByLabel('Betreff', { exact: true }).fill('Überarbeiteter Betreff');
    await page.keyboard.press('Control+s');
    await expect.poll(() => state.saves.length).toBe(1);
    expect(state.saves[0]).toMatchObject({ cc: ['copy@example.test'], bcc: ['hidden@example.test'], replyToMessageId: original.id });
    expect(String(state.saves[0].body)).toContain('LETZTER SATZ BLEIBT ERHALTEN.');
    expect(String(state.saves[0].htmlContent)).toContain('<strong>Wichtig:</strong>');
    await expect(composer).toBeVisible();
    await expect(composer.getByRole('status')).toContainText('Gespeichert');
});

test('unconfirmed delivery freezes editing and rechecks precisely the same request', async ({ page }) => {
    const state = await fixture(page); state.failSend = true; await openOriginal(page);
    await page.getByRole('button', { name: 'Antworten', exact: true }).click();
    const composer = page.getByRole('dialog');
    await composer.getByRole('textbox', { name: 'E-Mail-Nachricht' }).fill('Bitte den Eingang bestätigen.');
    await composer.getByRole('button', { name: 'Senden', exact: true }).click();
    await expect(composer.getByRole('alert')).toContainText('Versand nicht bestätigt');
    await expect(composer.getByRole('textbox', { name: 'E-Mail-Nachricht' })).toHaveAttribute('contenteditable', 'false');
    await page.screenshot({ path: 'docs/mail-workbench/send-unconfirmed.png', fullPage: true });
    state.failSend = false;
    await composer.getByRole('button', { name: 'Versand erneut prüfen' }).click();
    await expect(composer.getByText('E-Mail erfolgreich gesendet.', { exact: true })).toBeVisible();
    expect(state.sends).toHaveLength(2); expect(state.sends[1]).toEqual(state.sends[0]);
});

test('send-and-complete retries the failed internal status without sending a second email', async ({ page }) => {
    const state = await fixture(page); state.failFinish = true; await openOriginal(page);
    await page.getByRole('button', { name: 'Antworten', exact: true }).click();
    const composer = page.getByRole('dialog');
    await composer.getByRole('textbox', { name: 'E-Mail-Nachricht' }).fill('Die Angaben sind geprüft. Vielen Dank.');
    await composer.getByRole('button', { name: 'Weitere Versandoptionen' }).click();
    await page.getByRole('menuitem', { name: 'Senden & erledigen' }).click();
    await expect(composer.getByRole('alert')).toContainText('E-Mail gesendet. Bearbeitungsstatus noch offen.');
    state.failFinish = false;
    await composer.getByRole('button', { name: 'Nur Bearbeitung abschließen' }).click();
    await expect(composer.getByText('E-Mail erfolgreich gesendet.', { exact: true })).toBeVisible();
    expect(state.sends).toHaveLength(1); expect(state.assignments).toHaveLength(2);
});

test('forwarding transfers only explicitly selected original attachments to the private draft', async ({ page }) => {
    const state = await fixture(page); await openOriginal(page);
    await page.getByRole('button', { name: 'Weitere Nachrichtenaktionen' }).click();
    await page.getByRole('menuitem', { name: 'Weiterleiten', exact: true }).click();
    const composer = page.getByRole('dialog');
    expect(state.downloads).toBe(0);
    await composer.getByRole('complementary').getByRole('button', { name: 'Übernehmen', exact: true }).click();
    await expect(composer.getByRole('list', { name: 'Anhänge dieser E-Mail' })).toContainText('Stammdaten.pdf');
    await composer.getByLabel('An', { exact: true }).fill('partner@example.test');
    await composer.getByRole('button', { name: 'Senden', exact: true }).click();
    await expect(composer.getByText('E-Mail erfolgreich gesendet.', { exact: true })).toBeVisible();
    expect(state.downloads).toBe(1); expect(state.uploads).toBe(1);
    expect(state.sends[0].draftId).toBe('draft-new'); expect(state.sends[0].replyToMessageId).toBeUndefined();
    expect(JSON.stringify(state.sends[0])).not.toContain('private@example.test');
});

test('mobile composition preserves input when switching context and keeps send controls visible', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const state = await fixture(page); await openOriginal(page);
    await page.getByRole('button', { name: 'Antworten', exact: true }).click();
    const composer = page.getByRole('dialog');
    await composer.getByRole('textbox', { name: 'E-Mail-Nachricht' }).fill('Meine Antwort bleibt beim Nachlesen erhalten.');
    await composer.getByRole('button', { name: 'Originalnachricht', exact: true }).click();
    await expect(composer.getByRole('complementary')).toBeVisible();
    await composer.getByRole('button', { name: 'Nachricht verfassen', exact: true }).click();
    await expect(composer.getByRole('textbox', { name: 'E-Mail-Nachricht' })).toHaveText('Meine Antwort bleibt beim Nachlesen erhalten.');
    await expect(composer.getByRole('button', { name: 'Senden', exact: true })).toBeInViewport();
    expect(await composer.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    await page.screenshot({ path: 'docs/mail-workbench/reply-mobile.png', fullPage: true });
    await composer.getByRole('textbox', { name: 'E-Mail-Nachricht' }).fill('Anbei unsere Unterlagen.');
    await composer.getByRole('button', { name: 'Senden', exact: true }).click();
    await expect(composer.getByRole('alert')).toContainText('keine Datei angehängt');
    expect(state.sends).toHaveLength(0);
    await composer.getByRole('button', { name: 'Weiter bearbeiten', exact: true }).click();
});

test('Cc autocomplete is keyboard-operable', async ({ page }) => {
    await fixture(page); await page.goto('/mail');
    await page.getByRole('button', { name: 'Neue E-Mail', exact: true }).click();
    const composer = page.getByRole('dialog');
    await composer.getByRole('button', { name: 'Cc / Bcc hinzufügen' }).click();
    await composer.getByLabel('Cc', { exact: true }).fill('eink');
    await expect(composer.getByRole('option', { name: /Einkauf Beispiel/ })).toBeVisible();
    await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter');
    await expect(composer.getByLabel('Cc', { exact: true })).toHaveValue('einkauf@example.test; ');
});

test('read-only accounts cannot open a writable fallback', async ({ page }) => {
    await fixture(page, false); await openOriginal(page);
    await expect(page.getByRole('button', { name: 'Neue E-Mail', exact: true })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Antworten', exact: true })).toBeDisabled();
});

test('failed full draft loading never replaces the saved body with the list preview', async ({ page }) => {
    const state = await fixture(page); state.failDraftLoad = true;
    await page.goto('/mail');
    await page.getByRole('button', { name: 'Entwürfe', exact: true }).click();
    await page.getByText(original.subject, { exact: true }).first().click();
    await expect(page.getByText(/Entwurf momentan nicht verfügbar|Server error 503/).first()).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(state.saves).toHaveLength(0);
    state.failDraftLoad = false;
    await page.getByText(original.subject, { exact: true }).first().click();
    await expect(page.getByRole('dialog').getByRole('textbox', { name: 'E-Mail-Nachricht' })).toContainText('LETZTER SATZ BLEIBT ERHALTEN.');
});

test('oversized attachments are rejected before a draft or upload is created', async ({ page }) => {
    const state = await fixture(page); await page.goto('/mail');
    await page.getByRole('button', { name: 'Neue E-Mail', exact: true }).click();
    await page.getByLabel('Dateien anhängen', { exact: true }).setInputFiles({ name: 'zu-gross.pdf', mimeType: 'application/pdf', buffer: Buffer.alloc(11 * 1024 * 1024) });
    await expect(page.getByRole('dialog').getByRole('alert')).toContainText('zu-gross.pdf: Die Datei überschreitet 10 MB.');
    expect(state.uploads).toBe(0); expect(state.saves).toHaveLength(0);
});

test('a selected text snippet inserts at the cursor without replacing the written answer', async ({ page }) => {
    await fixture(page); await openOriginal(page);
    await page.getByRole('button', { name: 'Antworten', exact: true }).click();
    const composer = page.getByRole('dialog'); const editor = composer.getByRole('textbox', { name: 'E-Mail-Nachricht' });
    await editor.fill('Meine individuelle Ergänzung. '); await page.keyboard.press('End');
    await composer.getByRole('button', { name: 'Textbaustein' }).click();
    await page.getByRole('menuitem', { name: 'Weitere Angaben anfragen' }).click();
    await expect(editor).toContainText('Meine individuelle Ergänzung.');
    await expect(editor).toContainText('benötigen wir noch folgende Angaben');
    await editor.focus(); await page.keyboard.press('Control+a');
    await composer.getByRole('button', { name: 'Fett', exact: true }).focus(); await page.keyboard.press('Enter');
    await expect(editor.locator('b,strong')).not.toHaveCount(0);
});

test('save and send shortcuts cannot race, including while the original tab hides the editor', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const state = await fixture(page); state.holdSave = true; await openOriginal(page);
    await page.getByRole('button', { name: 'Antworten', exact: true }).click();
    const composer = page.getByRole('dialog');
    await composer.getByRole('textbox', { name: 'E-Mail-Nachricht' }).fill('Erster Absatz\nZweiter Absatz');
    await composer.getByRole('button', { name: 'Originalnachricht', exact: true }).click();
    await page.evaluate(() => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true })); window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true })); });
    await expect.poll(() => state.saveStarted).toBe(true);
    expect(state.sends).toHaveLength(0);
    await expect(composer.getByRole('button', { name: 'Senden', exact: true })).toBeDisabled();
    state.releaseSave();
    await expect(composer.getByRole('button', { name: 'Senden', exact: true })).toBeEnabled();
    await composer.getByRole('button', { name: 'Senden', exact: true }).click();
    await expect(composer.getByText('E-Mail erfolgreich gesendet.', { exact: true })).toBeVisible();
    expect(state.sends).toHaveLength(1); expect(state.sends[0].body).toBe('Erster Absatz\nZweiter Absatz');
});
