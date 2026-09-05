import { describe, expect, it, vi } from 'vitest';
import { registerStepUpHandler, requestStepUp } from './stepUp';

describe('step-up assurance', () => {
    it('rejects safely when no confirmation surface is mounted', async () => {
        await expect(requestStepUp()).rejects.toThrow('erneut an');
    });
    it('coalesces simultaneous gated requests into one user confirmation', async () => {
        let resolve: () => void = () => {};
        const handler = vi.fn(() => new Promise<void>(done => { resolve = done; }));
        const unregister = registerStepUpHandler(handler);
        const first = requestStepUp(); const second = requestStepUp();
        expect(handler).toHaveBeenCalledTimes(1);
        resolve(); await Promise.all([first, second]); unregister();
    });
    it('propagates cancellation without authorizing a waiting operation', async () => {
        const unregister = registerStepUpHandler(() => Promise.reject(new Error('Abgebrochen')));
        await expect(requestStepUp()).rejects.toThrow('Abgebrochen'); unregister();
    });
});
