import { describe, expect, it } from 'vitest';
import { createMailDocument } from './mailDocument';

const parse = (html: string) => new DOMParser().parseFromString(html, 'text/html');

describe('isolated mail document', () => {
    it('blocks remote images and CSS requests while retaining table layout', () => {
        const result = createMailDocument('<table width="600"><tr><td style="padding:12px;background:url(https://tracker.example/pixel)"><img src="https://sender.example/logo.png" srcset="https://tracker.example/2x 2x">Hello</td></tr></table>');
        const document = parse(result.html);
        expect(result.hasRemoteContent).toBe(true);
        expect(document.querySelector('img')?.hasAttribute('src')).toBe(false);
        expect(document.querySelector('img')?.hasAttribute('srcset')).toBe(false);
        expect(document.querySelector('td')?.style.padding).toBe('12px');
        expect(document.querySelector('td')?.style.background).not.toContain('url');
        const policy = document.querySelector('meta[http-equiv]')?.getAttribute('content');
        expect(policy).toContain("default-src 'none'");
        expect(policy).toContain('img-src data:;');
        expect(policy).toContain("form-action 'none'");
    });

    it('only opts into HTTPS images, never relative API paths, srcset or SVG data', () => {
        const html = createMailDocument('<img src="https://sender.example/photo.png"><img src="/api/admin/action"><img src="data:image/svg+xml;base64,PHN2Zz4="><img src="http://unsafe.example/image.png">', { loadImages: true }).html;
        const images = Array.from(parse(html).querySelectorAll('img'));
        expect(images[0].src).toBe('https://sender.example/photo.png');
        for (const image of images.slice(1)) expect(image.hasAttribute('src')).toBe(false);
        expect(html).toContain('img-src data: https:;');
    });

    it('keeps raster data images and removes scripts, forms, trackers and active media', () => {
        const html = createMailDocument('<script>alert(1)</script><form><input type="password"></form><video src="https://tracker.example/video"></video><img src="https://tracker.example/p" width="1" height="1"><img src="data:image/png;base64,aGVsbG8=">', { loadImages: true }).html;
        const document = parse(html);
        expect(document.querySelector('script,form,input,video')).toBeNull();
        expect(document.body.innerHTML).not.toContain('tracker.example');
        expect(document.querySelector('img')?.getAttribute('src')).toContain('data:image/png');
    });
});
