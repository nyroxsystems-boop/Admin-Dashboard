/** Embedded mail documents cannot inherit application CSS variables. */
export const MAIL_READER_COLORS = {
    light: { surface: '#ffffff', text: '#17212f', link: '#2458d3' },
    dark: { surface: '#171c25', text: '#e5e7eb', link: '#90b4ff' },
    placeholderText: '#6b7280', placeholderSurface: '#f3f4f6',
    placeholderBorder: '#cbd5e1', quoteBorder: '#dfe3e8',
} as const;
