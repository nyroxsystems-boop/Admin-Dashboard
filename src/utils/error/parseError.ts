/**
 * parseError — Type-Guard wrapping `unknown` errors thrown by fetch/SDK code.
 *
 * Always returns an object with `message`. Optional `code` and `status` get
 * extracted from common shapes (Error, fetch Response error, Axios-like).
 */

export interface ParsedError {
    message: string;
    code?: string;
    status?: number;
    cause?: unknown;
}

interface MaybeAxiosError {
    isAxiosError?: boolean;
    response?: { status?: number; data?: { message?: string; code?: string } };
    message?: string;
}

interface MaybeApiError {
    code?: string;
    status?: number;
    message?: string;
    body?: { code?: string };
}

export function parseError(err: unknown): ParsedError {
    if (err === null || err === undefined) {
        return { message: 'Unknown error' };
    }
    if (typeof err === 'string') {
        return { message: err };
    }
    if (err instanceof Error) {
        const ax = err as unknown as MaybeAxiosError;
        if (ax.isAxiosError && ax.response) {
            return {
                message: ax.response.data?.message ?? err.message,
                code: ax.response.data?.code,
                status: ax.response.status,
                cause: err,
            };
        }
        const api = err as Error & MaybeApiError;
        return { message: err.message, cause: err, status: api.status, code: api.code ?? api.body?.code };
    }
    if (typeof err === 'object') {
        const o = err as MaybeApiError;
        return {
            message: o.message ?? 'Unknown error',
            code: o.code,
            status: o.status,
            cause: err,
        };
    }
    return { message: String(err) };
}

export function getErrorMessage(err: unknown): string {
    return parseError(err).message;
}
