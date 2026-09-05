import { sanitizeMailHtml } from './sanitizeMailHtml';
import { aufDunkelUmstellen } from '@/components/mail/mailDunkel';
import { MAIL_READER_COLORS } from '@/design-system/mail-reader-tokens';

export interface MailDocumentOptions {
    loadImages?: boolean;
    dark?: boolean;
}

/** Only use this document inside the script-disabled MailHtmlFrame sandbox. */
export function createMailDocument(raw: string | null | undefined, options: MailDocumentOptions = {}) {
    const clean = sanitizeMailHtml(raw);
    const parsed = new DOMParser().parseFromString(clean, 'text/html');
    let hasRemoteContent = false;

    for (const element of Array.from(parsed.body.querySelectorAll('*'))) {
        // srcset and media elements need a separate resource policy; mail readers
        // use static images only. Relative URLs must never address our own API.
        element.removeAttribute('srcset');
        element.removeAttribute('poster');
        element.removeAttribute('background');
        if (element instanceof HTMLImageElement) {
            const source = element.getAttribute('src') || '';
            const embedded = /^data:image\/(?:png|jpe?g|gif|webp|avif);base64,/i.test(source);
            const remote = /^https:\/\//i.test(source);
            if (remote) hasRemoteContent = true;
            if ((!options.loadImages && remote) || (!remote && !embedded)) {
                element.removeAttribute('src');
                element.setAttribute('data-image-blocked', 'true');
                if (!element.getAttribute('alt')) element.setAttribute('alt', 'Externes Bild');
            }
            element.setAttribute('referrerpolicy', 'no-referrer');
        }
        const style = element.getAttribute('style');
        if (style && /url\s*\(|@import|\\/i.test(style)) {
            hasRemoteContent = true;
            // Keep useful inline layout. Drop resource-bearing declarations,
            // including escaped CSS; CSP is the independent network boundary.
            const declaration = (element as HTMLElement).style;
            for (const name of Array.from(declaration)) {
                const value = declaration.getPropertyValue(name);
                if (/url\s*\(|@import|\\/i.test(value)) declaration.removeProperty(name);
            }
        }
    }

    const content = options.dark ? aufDunkelUmstellen(parsed.body.innerHTML) : parsed.body.innerHTML;
    const colors = options.dark ? MAIL_READER_COLORS.dark : MAIL_READER_COLORS.light;
    const csp = [
        "default-src 'none'",
        "script-src 'none'",
        "style-src 'unsafe-inline'",
        `img-src data:${options.loadImages ? ' https:' : ''}`,
        "connect-src 'none'",
        "font-src 'none'",
        "media-src 'none'",
        "object-src 'none'",
        "frame-src 'none'",
        "base-uri 'none'",
        "form-action 'none'",
    ].join('; ');
    return {
        hasRemoteContent,
        html: `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${csp}"><meta name="referrer" content="no-referrer"><meta name="viewport" content="width=device-width, initial-scale=1"><style>
html,body{margin:0;min-height:0;box-sizing:border-box;background:${colors.surface};color:${colors.text};font:15px/1.6 Arial,sans-serif;color-scheme:${options.dark ? 'dark' : 'light'}}
body{padding:24px;overflow-wrap:anywhere}img{max-width:100%;height:auto}table{max-width:100%}pre{white-space:pre-wrap}a{color:${colors.link}}img[data-image-blocked]{display:inline-block;max-height:160px;color:${MAIL_READER_COLORS.placeholderText};background:${MAIL_READER_COLORS.placeholderSurface};border:1px dashed ${MAIL_READER_COLORS.placeholderBorder}}blockquote{margin-left:0;padding-left:16px;border-left:3px solid ${MAIL_READER_COLORS.quoteBorder}}
</style></head><body>${content}</body></html>`,
    };
}
