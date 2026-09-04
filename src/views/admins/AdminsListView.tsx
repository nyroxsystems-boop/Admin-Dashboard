/**
 * AdminsListView — read-only Admin-User overview.
 *
 * The backend has no create / delete / role-change endpoint for admin
 * users, so this view is intentionally read-only. New admins are
 * provisioned server-side directly in the admin_users table. The list
 * response only carries { id, username, email, created_at } — there is no
 * role or last-login field, so those columns are not shown.
 */
import { Info } from 'lucide-react';

import { useAdmins } from '@/hooks/useAdmins';
import { LoadingState } from '@/components/feedback/LoadingState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { EmptyState } from '@/components/feedback/EmptyState';
import { formatDate } from '@/utils/format/date';
import { SEITEN_RAND } from '@/components/ui/seite';
import { cn } from '@/lib/utils';

export default function AdminsListView(): JSX.Element {
    const { admins, isLoading, error, refetch } = useAdmins();

    if (isLoading) return <LoadingState label="Lade Admins…" />;
    if (error) return <ErrorState message="Admins konnten nicht geladen werden." onRetry={refetch} />;

    return (
        <div className={cn(SEITEN_RAND)}>
            <header className="mb-6">
                <h1 className="text-2xl font-display font-semibold tracking-tight">Admins</h1>
                <p className="text-sm text-text-secondary">{admins.length} Admin-Accounts.</p>
            </header>

            <div className="mb-5 flex items-start gap-2 rounded-md border border-border bg-surface/40 px-3 py-2 text-xs text-text-secondary">
                <Info className="size-4 shrink-0 mt-0.5" />
                <span>
                    Admin-Accounts werden serverseitig bereitgestellt. Neue Admins
                    bzw. das Entfernen von Zugängen erfolgt direkt am Server, nicht
                    über das Dashboard.
                </span>
            </div>

            {admins.length === 0 ? (
                <EmptyState
                    title="Keine Admins"
                    description="Es sind keine Admin-Accounts vorhanden."
                />
            ) : (
                <div className="overflow-x-auto rounded-md border border-border">
                    <table className="w-full text-sm">
                        <thead className="bg-surface/60 text-left">
                            <tr>
                                <th className="px-3 py-2">Username</th>
                                <th className="px-3 py-2">Email</th>
                                <th className="px-3 py-2">Erstellt</th>
                            </tr>
                        </thead>
                        <tbody>
                            {admins.map((a) => (
                                <tr key={a.id} className="border-t border-border hover:bg-elevated/40">
                                    <td className="px-3 py-2 font-medium">{a.username}</td>
                                    <td className="px-3 py-2 font-mono text-xs">{a.email}</td>
                                    <td className="px-3 py-2 text-xs text-text-secondary">
                                        {a.created_at ? formatDate(a.created_at) : '—'}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
