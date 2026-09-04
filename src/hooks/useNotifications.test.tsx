import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { apiFetchMock } = vi.hoisted(() => ({
    apiFetchMock: vi.fn(),
}));

vi.mock('@/api/client', () => ({
    API_BASE_URL: 'https://api.example.test',
    apiFetch: apiFetchMock,
}));

import { useNotifications } from './useNotifications';

class MockEventSource {
    static instances: MockEventSource[] = [];

    readonly url: string;
    onopen: ((event: Event) => void) | null = null;
    onmessage: ((event: MessageEvent) => void) | null = null;
    onerror: ((event: Event) => void) | null = null;
    close = vi.fn();

    constructor(url: string | URL) {
        this.url = String(url);
        MockEventSource.instances.push(this);
    }
}

describe('useNotifications', () => {
    beforeEach(() => {
        apiFetchMock.mockReset();
        MockEventSource.instances = [];
        vi.stubGlobal('EventSource', MockEventSource);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('does not request an SSE ticket when notifications are disabled', () => {
        const { result } = renderHook(() => useNotifications({ enabled: false }));

        expect(result.current.isLoading).toBe(false);
        expect(apiFetchMock).not.toHaveBeenCalled();
        expect(MockEventSource.instances).toHaveLength(0);

        result.current.refetch();
        expect(apiFetchMock).not.toHaveBeenCalled();
    });

    it('opens one stream when enabled and closes it on cleanup', async () => {
        apiFetchMock.mockResolvedValue({ ticket: 'ticket-123' });
        const { result, unmount } = renderHook(() => useNotifications({ enabled: true }));

        await waitFor(() => expect(MockEventSource.instances).toHaveLength(1));
        expect(apiFetchMock).toHaveBeenCalledTimes(1);
        expect(MockEventSource.instances[0]?.url).toBe(
            'https://api.example.test/api/events/stream?ticket=ticket-123',
        );

        act(() => {
            MockEventSource.instances[0]?.onopen?.(new Event('open'));
        });
        expect(result.current.isLoading).toBe(false);

        unmount();
        expect(MockEventSource.instances[0]?.close).toHaveBeenCalledTimes(1);
    });

    it('does not open a stale stream when cleanup happens during ticket loading', async () => {
        let resolveTicket!: (value: { ticket: string }) => void;
        apiFetchMock.mockReturnValue(
            new Promise<{ ticket: string }>((resolve) => {
                resolveTicket = resolve;
            }),
        );

        const { unmount } = renderHook(() => useNotifications({ enabled: true }));
        await waitFor(() => expect(apiFetchMock).toHaveBeenCalledTimes(1));
        unmount();

        await act(async () => {
            resolveTicket({ ticket: 'late-ticket' });
            await Promise.resolve();
        });

        expect(MockEventSource.instances).toHaveLength(0);
    });
});
