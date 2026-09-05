/** WCAG contrast checks against the actual flat surfaces of the internal UI. */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

type Rgb = readonly [number, number, number];
const css = readFileSync(join(process.cwd(), 'src/design-system/tokens.css'), 'utf8');
const lightIndex = /^\[data-theme="light"\]/m.exec(css)?.index ?? -1;
const themes = { dark: css.slice(0, lightIndex), light: css.slice(lightIndex) };
function token(name: string, theme: keyof typeof themes): Rgb {
    const match = new RegExp(`--${name}:\\s*([\\d.]+)\\s+([\\d.]+)%\\s+([\\d.]+)%`).exec(themes[theme]);
    if (!match) throw new Error(`Missing ${theme} color ${name}`);
    const h = Number(match[1]) / 60; const s = Number(match[2]) / 100; const l = Number(match[3]) / 100;
    const c = (1 - Math.abs(2 * l - 1)) * s; const x = c * (1 - Math.abs(h % 2 - 1)); const m = l - c / 2;
    const rgb = h < 1 ? [c, x, 0] : h < 2 ? [x, c, 0] : h < 3 ? [0, c, x] : h < 4 ? [0, x, c] : h < 5 ? [x, 0, c] : [c, 0, x];
    return rgb.map(v => v + m) as unknown as Rgb;
}
function luminance(rgb: Rgb): number {
    const [r, g, b] = rgb.map(v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a: Rgb, b: Rgb): number {
    const x = luminance(a); const y = luminance(b);
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

describe.each(['dark', 'light'] as const)('%s internal UI contrast', theme => {
    it.each(['text-primary', 'text-secondary', 'text-tertiary', 'text-muted'])('%s is readable on every content surface', name => {
        for (const surface of ['bg-canvas', 'bg-surface', 'bg-elevated']) expect(contrast(token(name, theme), token(surface, theme)), `${name} on ${surface}`).toBeGreaterThanOrEqual(4.5);
    });
    it('muted icons meet 3:1 on their navigation surface', () => expect(contrast(token('text-faint', theme), token('bg-surface', theme))).toBeGreaterThanOrEqual(3));
    it.each(['accent-500', 'success', 'warning', 'danger', 'info'])('%s text meets 4.5:1 on panels', name => expect(contrast(token(name, theme), token('bg-surface', theme))).toBeGreaterThanOrEqual(4.5));
    it.each(['accent-600', 'accent-700'])('primary button %s carries white text', name => expect(contrast(token(name, theme), [1, 1, 1])).toBeGreaterThanOrEqual(4.5));
    it.each(['accent-500', 'success', 'warning', 'danger', 'info'])('filled status %s has accessible text', name => expect(contrast(token(name, theme), token('auf-ton', theme))).toBeGreaterThanOrEqual(4.5));
    it('content panels remain distinguishable from canvas', () => expect(luminance(token('bg-surface', theme))).toBeGreaterThan(luminance(token('bg-canvas', theme))));
});

describe('calm theme defaults', () => {
    it('starts in light mode while retaining dark as a user preference', () => {
        const entry = readFileSync(join(process.cwd(), 'src/main.tsx'), 'utf8');
        expect(entry).toContain('defaultTheme="light"');
        expect(css).toContain('[data-theme="dark"]');
    });
});
