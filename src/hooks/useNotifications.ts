/**
 * useNotifications — placeholder for an upcoming notifications feed.
 *
 * The backend does not yet expose a notifications endpoint. This hook
 * returns an empty feed so views can wire UI without crashing. Once
 * the API is available, replace this body with a real useQuery against
 * `/api/admin/notifications` (or similar).
 */

// TODO: Wire to real notifications API when available.

export interface NotificationItem {
    id: string;
    title: string;
    body?: string;
    severity: 'info' | 'success' | 'warning' | 'error';
    createdAt: string;
    isRead: boolean;
    href?: string;
}

export function useNotifications(): {
    notifications: NotificationItem[];
    unread: number;
    isLoading: boolean;
    error: unknown;
    refetch: () => void;
    markAllRead: () => void;
} {
    return {
        notifications: [],
        unread: 0,
        isLoading: false,
        error: null,
        refetch: () => {
            /* no-op until API is available */
        },
        markAllRead: () => {
            /* no-op until API is available */
        },
    };
}
