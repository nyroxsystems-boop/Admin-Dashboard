import DOMPurify from 'dompurify';

const ALLOWED_TAGS = [
    'p', 'div', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'strike',
    'ul', 'ol', 'li', 'blockquote', 'h1', 'h2', 'h3', 'a', 'font',
];

const ALLOWED_ATTR = ['href', 'target', 'rel', 'face', 'size', 'color'];

export function sanitizeEmailEditorHtml(value: string): string {
    return DOMPurify.sanitize(value, {
        ALLOWED_TAGS,
        ALLOWED_ATTR,
        ALLOW_DATA_ATTR: false,
    });
}

export function plainTextToEmailHtml(value: string): string {
    const wrapper = document.createElement('div');
    wrapper.textContent = value;
    return `<p>${wrapper.innerHTML.replace(/\n/g, '<br>')}</p>`;
}

/** Plain-text equivalent when the editor is hidden behind the mobile context tab. */
export function emailHtmlToPlainText(value: string): string {
    const content = document.createElement('div');
    content.innerHTML = sanitizeEmailEditorHtml(value);
    content.querySelectorAll('br').forEach(element => element.replaceWith('\n'));
    content.querySelectorAll('p,div,li,blockquote,h1,h2,h3').forEach(element => {
        // Chrome inserts <div> after a plain-text first line when Enter is pressed.
        // A trailing separator alone would concatenate that first and second line.
        const previous = element.previousSibling?.textContent;
        if (previous && !previous.endsWith('\n')) element.before('\n');
        element.append('\n');
    });
    return (content.textContent || '').replace(/\u00a0/g, ' ').replace(/\n{3,}/g, '\n\n').trimEnd();
}
