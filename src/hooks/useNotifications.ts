/**
 * useNotifications — Real-time notification feed via SSE.
 *
 * Connects to the backend SSE stream using the ticket-based auth flow:
 *  1. POST /api/events/ticket (Bearer auth) → single-use ticket
 *  2. GET /api/events/stream?ticket=<ticket> → EventSource
 *
 * SSE events with type 'notification' or 'order_*' are accumulated
 * and surfaced via this hook. Auto-reconnects on disconnect.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { apiFetch, API_BASE_URL } from '@/api/client';

export interface NotificationItem {
    id: string;
    title: string;
    body?: string;
    severity: 'info' | 'success' | 'warning' | 'error';
    createdAt: string;
    isRead: boolean;
    href?: string;
}

export interface UseNotificationsOptions {
    /**
     * Opens the tenant-scoped SSE stream only when the current application
     * context can actually obtain a ticket. Platform admins currently have no
     * tenant context, so callers must keep this disabled for them.
     */
    enabled?: boolean;
}

// Map SSE event types to notification severity
function severityFromType(type: string): NotificationItem['severity'] {
    if (type.includes('error') || type.includes('fail')) return 'error';
    if (type.includes('warn')) return 'warning';
    if (type.includes('success') || type.includes('confirm') || type.includes('ready')) return 'success';
    return 'info';
}

function optionalString(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim() ? value : undefined;
}

function eventToNotification(event: unknown): NotificationItem | null {
    if (typeof event !== 'object' || event === null) return null;

    const raw = event as Record<string, unknown>;
    const type = optionalString(raw.type) ?? '';
    if (type === 'connected' || type === 'heartbeat') return null;

    const payload =
        typeof raw.payload === 'object' && raw.payload !== null
            ? raw.payload as Record<string, unknown>
            : {};
    const timestamp = optionalString(raw.timestamp);
    const title =
        optionalString(payload.title) ??
        optionalString(payload.message) ??
        (type.replace(/_/g, ' ') || 'Notification');

    return {
        id: `sse_${timestamp ?? Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        title,
        body: optionalString(payload.body) ?? optionalString(payload.detail),
        severity: severityFromType(type),
        createdAt: timestamp ?? new Date().toISOString(),
        isRead: false,
        href: optionalString(payload.href),
    };
}

export function useNotifications({ enabled = true }: UseNotificationsOptions = {}): {
    notifications: NotificationItem[];
    unread: number;
    isLoading: boolean;
    error: unknown;
    refetch: () => void;
    markAllRead: () => void;
} {
    const [notifications, setNotifications] = useState<NotificationItem[]>([]);
    const [isLoading, setIsLoading] = useState(enabled);
    const [error, setError] = useState<unknown>(null);
    const esRef = useRef<EventSource | null>(null);
    const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const connectionGenerationRef = useRef(0);
    const connectRef = useRef<() => void>(() => undefined);

    const connect = useCallback(async () => {
        if (!enabled) return;

        const generation = ++connectionGenerationRef.current;
        if (reconnectTimerRef.current) {
            clearTimeout(reconnectTimerRef.current);
            reconnectTimerRef.current = null;
        }

        // Close existing connection
        if (esRef.current) {
            esRef.current.close();
            esRef.current = null;
        }

        try {
            // Step 1: Get a single-use ticket
            const { ticket } = await apiFetch<{ ticket: string }>('/api/events/ticket', {
                method: 'POST',
                silentAuth: true,
            });

            // The effect may have been cleaned up while the ticket request was
            // in flight (StrictMode, logout or route unmount). Never open a
            // stale second EventSource in that case.
            if (generation !== connectionGenerationRef.current) return;

            if (!ticket) {
                setIsLoading(false);
                return;
            }

            // Step 2: Open SSE stream with ticket
            const url = `${API_BASE_URL}/api/events/stream?ticket=${encodeURIComponent(ticket)}`;
            const es = new EventSource(url);
            esRef.current = es;

            es.onopen = () => {
                if (generation !== connectionGenerationRef.current || esRef.current !== es) return;
                setIsLoading(false);
                setError(null);
            };

            es.onmessage = (event) => {
                if (generation !== connectionGenerationRef.current || esRef.current !== es) return;
                try {
                    const data = JSON.parse(event.data);
                    const notif = eventToNotification(data);
                    if (notif) {
                        setNotifications(prev => [notif, ...prev].slice(0, 50)); // Keep last 50
                    }
                } catch {
                    // Non-JSON message (heartbeat comment), ignore
                }
            };

            es.onerror = () => {
                if (generation !== connectionGenerationRef.current || esRef.current !== es) return;
                es.close();
                esRef.current = null;
                setError('SSE connection lost');

                // Auto-reconnect after 10 seconds
                if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
                reconnectTimerRef.current = setTimeout(() => {
                    connectRef.current();
                }, 10_000);
            };
        } catch (err) {
            if (generation !== connectionGenerationRef.current) return;
            setIsLoading(false);
            setError(err);
            // Silently retry in 30s
            if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
            reconnectTimerRef.current = setTimeout(() => connectRef.current(), 30_000);
        }
    }, [enabled]);

    useEffect(() => {
        connectRef.current = () => void connect();
        return () => {
            connectRef.current = () => undefined;
        };
    }, [connect]);

    useEffect(() => {
        if (!enabled) return;

        // Start after the effect has subscribed. This also makes StrictMode's
        // first setup/cleanup cycle cancellable before it mints a ticket.
        const startTimer = setTimeout(() => void connect(), 0);
        return () => {
            clearTimeout(startTimer);
            connectionGenerationRef.current += 1;
            esRef.current?.close();
            esRef.current = null;
            if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
            reconnectTimerRef.current = null;
        };
    }, [connect, enabled]);

    const markAllRead = useCallback(() => {
        setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    }, []);

    const unread = notifications.filter(n => !n.isRead).length;

    return {
        notifications,
        unread,
        isLoading,
        error,
        refetch: () => {
            if (enabled) void connect();
        },
        markAllRead,
    };
}
