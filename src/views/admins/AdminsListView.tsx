/**
 * AdminsListView — Admin-User overview.
 */
import { useState } from 'react';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';

import { useAdmins, useDeleteAdmin } from '@/hooks/useAdmins';
import { LoadingState } from '@/components/feedback/LoadingState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ConfirmDialog } from '@/components/feedback/ConfirmDialog';
import { Button } from '@/components/ui/button';
import AdminCreateDialog from './AdminCreateDialog';
import { formatRelative } from '@/utils/format/date';
import type { Admin } from '@/api/types';

export default function AdminsListView(): JSX.Element {
    const { admins, isLoading, error, refetch } = useAdmins();
    const deleteMut = useDeleteAdmin();
    const [createOpen, setCreateOpen] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState<Admin | null>(null);

    if (isLoading) return <LoadingState label="Lade Admins…" />;
    if (error) return <ErrorState message="Admins konnten nicht geladen werden." onRetry={refetch} />;

    return (
        <div className="p-6 md:p-8 max-w-7xl mx-auto">
            <header className="flex items-end justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-display font-semibold tracking-tight">Admins</h1>
                    <p className="text-sm text-text-secondary">{admins.length} Admin-Accounts.</p>
                </div>
                <Button size="sm" onClick={() => setCreateOpen(true)}>
                    <Plus className="size-4" /> Neuer Admin
                </Button>
            </header>

            {admins.length === 0 ? (
                <EmptyState
                    title="Keine Admins"
                    description="Erstelle den ersten Admin-Account."
                    actionLabel="Neuer Admin"
                    onAction={() => setCreateOpen(true)}
                />
            ) : (
                <div className="overflow-x-auto rounded-md border border-border">
                    <table className="w-full text-sm">
                        <thead className="bg-surface/60 text-left">
                            <tr>
                                <th className="px-3 py-2">Username</th>
                                <th className="px-3 py-2">Email</th>
                                <th className="px-3 py-2">Rolle</th>
                                <th className="px-3 py-2">Letzter Login</th>
                                <th className="px-3 py-2 w-1" />
                            </tr>
                        </thead>
                        <tbody>
                            {admins.map((a) => (
                                <tr key={a.id} className="border-t border-border hover:bg-elevated/40">
                                    <td className="px-3 py-2 font-medium">{a.username}</td>
                                    <td className="px-3 py-2 font-mono text-xs">{a.email}</td>
                                    <td className="px-3 py-2 text-xs uppercase tracking-wider">
                                        {a.role ?? '—'}
                                    </td>
                                    <td className="px-3 py-2 text-xs text-text-secondary">
                                        {a.last_login_at ? formatRelative(a.last_login_at) : '—'}
                                    </td>
                                    <td className="px-3 py-2 text-right">
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => setConfirmDelete(a)}
                                        >
                                            Löschen
                                        </Button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <AdminCreateDialog open={createOpen} onOpenChange={setCreateOpen} />

            <ConfirmDialog
                open={!!confirmDelete}
                onOpenChange={(open) => !open && setConfirmDelete(null)}
                title={confirmDelete ? `${confirmDelete.username} löschen?` : 'Löschen?'}
                description="Der Admin verliert sofort allen Zugriff."
                tone="danger"
                confirmLabel="Löschen"
                onConfirm={async () => {
                    if (confirmDelete) {
                        try {
                            await deleteMut.mutateAsync(confirmDelete.id);
                            toast.success(`${confirmDelete.username} gelöscht.`);
                        } catch (err) {
                            toast.error(err instanceof Error ? err.message : 'Löschen fehlgeschlagen.');
                        }
                    }
                    setConfirmDelete(null);
                }}
            />
        </div>
    );
}
