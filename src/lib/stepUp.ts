/** One shared reauthentication prompt; a rejected action is retried only after assurance succeeds. */
let handler: (() => Promise<void>) | null = null;
let pending: Promise<void> | null = null;

export function registerStepUpHandler(next: () => Promise<void>): () => void {
    handler = next;
    return () => { if (handler === next) handler = null; };
}

export function requestStepUp(): Promise<void> {
    if (pending) return pending;
    if (!handler) return Promise.reject(new Error('Bitte melde dich erneut an, um diese Aktion zu bestätigen.'));
    pending = handler().finally(() => { pending = null; });
    return pending;
}
