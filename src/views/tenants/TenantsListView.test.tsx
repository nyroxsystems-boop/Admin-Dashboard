import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Tenant } from '@/api/types';

const mocks = vi.hoisted(() => ({
    deactivate: vi.fn(),
    activate: vi.fn(),
    toastSuccess: vi.fn(),
    toastError: vi.fn(),
}));

const tenant: Tenant = {
    id: 'tenant-1',
    name: 'Musterteile GmbH',
    slug: 'musterteile',
    user_count: 2,
    max_users: 10,
    device_count: 1,
    max_devices: 5,
    is_active: true,
    onboarding_status: 'completed',
    payment_status: 'paid',
    whatsapp_number: null,
    logo_url: null,
};

function idleMutation(overrides: Record<string, unknown> = {}) {
    return {
        isPending: false,
        mutate: vi.fn(),
        mutateAsync: vi.fn().mockResolvedValue({ success: true }),
        ...overrides,
    };
}

vi.mock('@/hooks/useTenants', () => ({
    useTenants: () => ({
        tenants: [tenant],
        isLoading: false,
        error: null,
        refetch: vi.fn(),
    }),
    useDeactivateTenant: () => idleMutation({ mutateAsync: mocks.deactivate }),
    useActivateTenant: () => idleMutation({ mutateAsync: mocks.activate }),
    useSuspendTenant: () => idleMutation(),
    useUnsuspendTenant: () => idleMutation(),
    useDeleteTenant: () => idleMutation(),
    useRestoreTenant: () => idleMutation(),
    usePurgeTenant: () => idleMutation(),
}));

vi.mock('@/hooks/useImpersonate', () => ({
    useImpersonate: () => idleMutation(),
}));

vi.mock('@/hooks/useDebounce', () => ({
    useDebounce: (value: unknown) => value,
}));
vi.mock('@/auth/usePermissions', () => ({ usePermissions: () => ({ can: () => true }) }));

// The production dialog primitive is covered independently; keep this view
// test focused on the lifecycle state machine rather than portal animations.
vi.mock('@/components/feedback/ConfirmDialog', () => ({
    ConfirmDialog: ({
        open,
        title,
        confirmLabel,
        onConfirm,
    }: {
        open: boolean;
        title: string;
        confirmLabel?: string;
        onConfirm: () => void | Promise<void>;
    }) =>
        open ? (
            <div role="dialog">
                <span>{title}</span>
                <button type="button" onClick={() => void onConfirm()}>
                    {confirmLabel ?? 'Bestätigen'}
                </button>
            </div>
        ) : null,
}));

vi.mock('sonner', () => ({
    toast: {
        success: mocks.toastSuccess,
        error: mocks.toastError,
        warning: vi.fn(),
    },
}));

import TenantsListView from './TenantsListView';

describe('TenantsListView lifecycle actions', () => {
    beforeEach(() => {
        mocks.deactivate.mockReset().mockResolvedValue({ success: true });
        mocks.activate.mockReset().mockResolvedValue({ success: true });
        mocks.toastSuccess.mockReset();
        mocks.toastError.mockReset();
    });

    it('shows a visible deactivate action and executes it only after confirmation', async () => {
        render(
            <MemoryRouter>
                <TenantsListView />
            </MemoryRouter>,
        );

        fireEvent.keyDown(screen.getByRole('button', { name: 'Aktionen für Musterteile GmbH' }), { key: 'Enter' });
        fireEvent.click(await screen.findByRole('menuitem', { name: 'Deaktivieren' }));
        expect(mocks.deactivate).not.toHaveBeenCalled();

        const dialog = await screen.findByRole('dialog');
        expect(within(dialog).getByText('Musterteile GmbH deaktivieren?')).toBeInTheDocument();
        fireEvent.click(within(dialog).getByRole('button', { name: 'Deaktivieren' }));

        await waitFor(() => expect(mocks.deactivate).toHaveBeenCalledWith('tenant-1'));
        await waitFor(() =>
            expect(mocks.toastSuccess).toHaveBeenCalledWith('Musterteile GmbH deaktiviert.'),
        );
    }, 15_000);

    it('reports an API error and keeps the confirmation available for retry', async () => {
        mocks.deactivate.mockRejectedValueOnce(new Error('Statuswechsel abgelehnt'));
        render(
            <MemoryRouter>
                <TenantsListView />
            </MemoryRouter>,
        );

        fireEvent.keyDown(screen.getByRole('button', { name: 'Aktionen für Musterteile GmbH' }), { key: 'Enter' });
        fireEvent.click(await screen.findByRole('menuitem', { name: 'Deaktivieren' }));
        const dialog = await screen.findByRole('dialog');
        fireEvent.click(within(dialog).getByRole('button', { name: 'Deaktivieren' }));

        await waitFor(() =>
            expect(mocks.toastError).toHaveBeenCalledWith('Statuswechsel abgelehnt'),
        );
        expect(screen.getByRole('dialog')).toBeInTheDocument();
    }, 15_000);
});
