import { describe, expect, it } from 'vitest';

import { emailHtmlToPlainText, plainTextToEmailHtml, sanitizeEmailEditorHtml } from '../../utils/emailHtml';

describe('RichEmailEditor HTML safety', () => {
    it('preserves paragraphs and line breaks for a hidden mobile editor', () => {
        expect(emailHtmlToPlainText('<p>Erster Absatz</p><p>Zweiter<br>Nachtrag</p><script>bad()</script>')).toBe('Erster Absatz\nZweiter\nNachtrag');
        expect(emailHtmlToPlainText('Erster Absatz<div>Zweiter Absatz</div>')).toBe('Erster Absatz\nZweiter Absatz');
    });
    it('keeps supported professional formatting and removes executable markup', () => {
        const clean = sanitizeEmailEditorHtml(`
            <h2>Angebot</h2>
            <ul><li><strong>Bremsscheiben</strong></li></ul>
            <a href="https://partsunion.de" onclick="alert(1)">Details</a>
            <a href="javascript:alert(1)">Unsicher</a>
            <script>alert(1)</script>
        `);

        expect(clean).toContain('<h2>Angebot</h2>');
        expect(clean).toContain('<ul><li><strong>Bremsscheiben</strong></li></ul>');
        expect(clean).toContain('href="https://partsunion.de"');
        expect(clean).not.toContain('onclick');
        expect(clean).not.toContain('javascript:');
        expect(clean).not.toContain('<script');
    });

    it('escapes plain text before turning line breaks into email HTML', () => {
        expect(plainTextToEmailHtml('Hallo <Kunde>\nZeile 2')).toBe(
            '<p>Hallo &lt;Kunde&gt;<br>Zeile 2</p>',
        );
    });
});
