/**
 * ChunkErrorBoundary — auto-recovers from stale lazy chunks after a redeploy.
 *
 * After a fresh production deploy the cached `index.html` may reference
 * asset filenames (e.g. `OverviewView-EWWeTzyZ.js`) whose hashes are no
 * longer on the CDN, producing 404 → ChunkLoadError. We catch it once,
 * stamp a sessionStorage flag to prevent reload-loops, and force-reload
 * so the browser fetches the new HTML + asset graph.
 */
import { Component, type ErrorInfo, type ReactNode } from 'react';

const RELOAD_FLAG = 'pu.admin.chunk-reloaded';

function isChunkLoadError(err: unknown): boolean {
    if (!err) return false;
    const e = err as { name?: string; message?: string };
    if (e.name === 'ChunkLoadError') return true;
    const msg = String(e.message ?? '');
    return (
        /Loading chunk \d+ failed/i.test(msg) ||
        /Failed to fetch dynamically imported module/i.test(msg) ||
        /Importing a module script failed/i.test(msg) ||
        /error loading dynamically imported module/i.test(msg)
    );
}

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}
interface State {
    hasError: boolean;
}

export class ChunkErrorBoundary extends Component<Props, State> {
    state: State = { hasError: false };

    static getDerivedStateFromError(error: unknown): State {
        // ONLY chunk-load errors are this boundary's concern. Anything else
        // (TypeError in a render, an API exception, …) MUST propagate to
        // the outer ErrorBoundary in main.tsx — that one shows the proper
        // diagnostic UI. If we caught everything we'd misleadingly tell
        // the user "Neue Version verfügbar" for unrelated crashes.
        if (!isChunkLoadError(error)) {
            // Re-throw so React unmounts and the next boundary up catches it.
            throw error;
        }
        // Reload exactly once per browser session — if the new HTML still
        // 404s, fall through to render the fallback so we don't loop.
        if (!sessionStorage.getItem(RELOAD_FLAG)) {
            try { sessionStorage.setItem(RELOAD_FLAG, '1'); } catch { /* ignore */ }
            window.location.reload();
        }
        return { hasError: true };
    }

    componentDidCatch(error: unknown, _info: ErrorInfo): void {
        // Same guard: only swallow chunk errors. Anything else re-surfaces.
        if (!isChunkLoadError(error)) throw error;
    }

    render(): ReactNode {
        if (this.state.hasError) {
            return (
                this.props.fallback ?? (
                    <div className="min-h-screen flex flex-col items-center justify-center bg-canvas px-6 text-center">
                        <h1 className="text-xl font-display font-semibold mb-2 text-text-primary">
                            Neue Version verfügbar
                        </h1>
                        <p className="text-sm text-text-secondary mb-4">
                            Bitte Seite neu laden.
                        </p>
                        <button
                            type="button"
                            onClick={() => {
                                try { sessionStorage.removeItem(RELOAD_FLAG); } catch { /* ignore */ }
                                window.location.reload();
                            }}
                            className="px-4 h-10 rounded-md bg-accent-500 text-white text-sm font-medium hover:bg-accent-600 transition-colors"
                        >
                            Neu laden
                        </button>
                    </div>
                )
            );
        }
        return this.props.children;
    }
}

export default ChunkErrorBoundary;
