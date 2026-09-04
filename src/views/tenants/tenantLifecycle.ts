export interface TenantLifecycleFailure {
    id: string;
    reason: unknown;
}

export interface TenantLifecycleBatchResult {
    successfulIds: string[];
    failures: TenantLifecycleFailure[];
}

/** Removes only confirmed successes; failures and unrelated selections stay. */
export function removeSuccessfulTenantSelections(
    selected: ReadonlySet<string>,
    successfulIds: readonly string[],
): Set<string> {
    const next = new Set(selected);
    successfulIds.forEach((id) => next.delete(id));
    return next;
}

/** Runs every requested lifecycle change and retains per-tenant outcomes. */
export async function settleTenantLifecycleBatch(
    ids: readonly string[],
    action: (id: string) => Promise<unknown>,
): Promise<TenantLifecycleBatchResult> {
    const outcomes = await Promise.allSettled(
        ids.map(async (id) => {
            await action(id);
            return id;
        }),
    );

    const successfulIds: string[] = [];
    const failures: TenantLifecycleFailure[] = [];
    outcomes.forEach((outcome, index) => {
        const id = ids[index];
        if (id === undefined) return;
        if (outcome.status === 'fulfilled') successfulIds.push(id);
        else failures.push({ id, reason: outcome.reason });
    });

    return { successfulIds, failures };
}
