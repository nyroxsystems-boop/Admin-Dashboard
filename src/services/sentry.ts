/// <reference types="vite/client" />
/**
 * Sentry initialisation for the Admin Dashboard.
 *
 * Imported once from main.tsx via `initSentry()`. If `VITE_SENTRY_DSN`
 * is not set, the function logs a warning in dev and otherwise becomes
 * a no-op — `errorTracker` then falls back to `console.error`.
 */

import * as Sentry from '@sentry/react';

let _initialized = false;

export function initSentry(): void {
    if (_initialized) return;

    const dsn = import.meta.env.VITE_SENTRY_DSN;
    if (!dsn) {
        if (import.meta.env.DEV) {
            console.warn('[sentry] VITE_SENTRY_DSN not configured — error tracking disabled');
        }
        return;
    }

    try {
        Sentry.init({
            dsn,
            environment: import.meta.env.MODE,
            release: import.meta.env.VITE_APP_VERSION ?? '2.0.0',
            integrations: [
                Sentry.browserTracingIntegration(),
                Sentry.replayIntegration({
                    maskAllText: true,
                    blockAllMedia: true,
                }),
            ],
            tracesSampleRate: 0.1,
            replaysSessionSampleRate: 0.1,
            replaysOnErrorSampleRate: 1.0,
            // Scrub PII at the SDK boundary
            beforeSend(event) {
                // Strip user IPs from logs
                if (event.user?.ip_address) delete event.user.ip_address;
                return event;
            },
        });
        _initialized = true;
    } catch {
        // Never let Sentry init crash the app
    }
}

export function isSentryReady(): boolean {
    return _initialized;
}

export { Sentry };
