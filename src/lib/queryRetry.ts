/**
 * React Query retry policy for the admin application.
 *
 * API-client errors expose a numeric `status` and have already exhausted the
 * retry policy in apiFetch. Unknown errors (for example a transient error in a
 * query function before it reaches apiFetch) get one defensive retry.
 */
export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
    if (
        typeof error === 'object' &&
        error !== null &&
        'status' in error &&
        typeof error.status === 'number'
    ) {
        return false;
    }

    return failureCount < 1;
}
