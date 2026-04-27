/// <reference types="vite/client" />
/**
 * Generic Error Tracker for the Admin Dashboard.
 *
 * Wraps `@sentry/react` with a minimal API so callers don't have to know
 * whether Sentry is actually configured. Falls back to `console.error`
 * in dev when `VITE_SENTRY_DSN` is absent, and stays silent in prod.
 *
 * Use throughout the codebase:
 *   import { errorTracker } from '@/services/errorTracker';
 *   try { ... } catch (err) { errorTracker.captureException(err, { area: 'tenants' }); }
 */

import * as Sentry from '@sentry/react';
import { isSentryReady } from './sentry';

type Level = 'info' | 'warning' | 'error';

interface CaptureContext {
    [key: string]: unknown;
}

function hasSentry(): boolean {
    return isSentryReady();
}

/**
 * Scrub light PII from messages before they leave the device.
 * The full implementation lives in /utils/error/parseError; this is the
 * minimal version so we can drop it into errorTracker without a circular
 * dep.
 */
function scrubPII(input: string): string {
    return input
        .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL]')
        .replace(/eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[JWT]')
        .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '[UUID]');
}

function toError(err: unknown): Error {
    if (err instanceof Error) return err;
    if (typeof err === 'string') return new Error(err);
    try {
        return new Error(JSON.stringify(err));
    } catch {
        return new Error('Unknown error');
    }
}

export const errorTracker = {
    captureException(err: unknown, context?: CaptureContext): void {
        const error = toError(err);
        if (error.message) error.message = scrubPII(error.message);

        if (import.meta.env.PROD && hasSentry()) {
            Sentry.captureException(error, { extra: context });
            return;
        }
        // Dev / no-Sentry fallback — explicit, opt-in noise so devs see issues
        if (import.meta.env.DEV) {
            console.error('[errorTracker]', error, context);
        }
    },

    captureMessage(msg: string, level: Level = 'info', context?: CaptureContext): void {
        const scrubbed = scrubPII(msg);
        if (import.meta.env.PROD && hasSentry()) {
            Sentry.captureMessage(scrubbed, { level, extra: context });
            return;
        }
        if (import.meta.env.DEV) {
            const fn = level === 'error' ? console.error : console.warn;
            fn('[errorTracker]', scrubbed, context);
        }
    },

    setUser(user: { id: string; email?: string; role?: string } | null): void {
        if (!hasSentry()) return;
        if (!user) {
            Sentry.setUser(null);
            return;
        }
        Sentry.setUser({
            id: user.id,
            email: user.email,
            role: user.role,
        } as Sentry.User);
    },

    setTag(key: string, value: string): void {
        if (!hasSentry()) return;
        Sentry.setTag(key, value);
    },

    addBreadcrumb(message: string, data?: CaptureContext): void {
        if (!hasSentry()) return;
        Sentry.addBreadcrumb({
            message: scrubPII(message),
            data,
            timestamp: Date.now() / 1000,
        });
    },
};
