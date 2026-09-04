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
