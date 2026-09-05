import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TenantDetailSchema, TenantSchema } from '@/api/types';
import TenantDetailView from './TenantDetailView';

const state = vi.hoisted(() => ({ superadmin: true, role: 'merchant', reset: vi.fn(), devices: vi.fn() }));
const tenant = TenantSchema.parse({ id: 'dealer-a', name: 'Nord GmbH', slug: 'nord' });
vi.mock('@/auth/usePermissions', () => ({ usePermissions: () => ({ isSuperAdmin: state.superadmin, can: (permission: string) => state.superadmin || !['users.resetPassword', 'tenants.impersonate', 'billing.manage'].includes(permission) }) }));
vi.mock('@/hooks/useTenants', () => {
    const mutation = () => ({ mutate: vi.fn(), isPending: false });
    return {
        useTenants: () => ({ tenants: [tenant], isLoading: false, refetch: vi.fn() }),
        useTenant: () => ({ data: TenantDetailSchema.parse({ id: 'dealer-a', users: [{ id: 'owner-1', username: 'anna', email: 'anna@example.invalid', role: state.role, created_at: '2026-09-05' }], settings: {}, stats: {}, devices: [] }), isLoading: false, isError: false, refetch: vi.fn() }),
        useTenantDevices: (id: string | null) => { state.devices(id); return { devices: [], isLoading: false, refetch: vi.fn() }; },
        useRemoveDevice: mutation, useSuspendTenant: mutation, useUnsuspendTenant: mutation, useUpdateTenant: mutation, useUpdateTenantLimits: mutation,
    };
});
vi.mock('@/hooks/useImpersonate', () => ({ useImpersonate: () => ({ mutate: vi.fn(), isPending: false }) }));
vi.mock('@/api/tenants', () => ({ resetTenantUserPassword: state.reset, setTenantWhatsAppMeta: vi.fn(), testTenantWhatsAppMeta: vi.fn() }));
vi.mock('@/api/onboarding', () => ({ getTenantOnboardingHealth: async () => null }));
vi.mock('./TenantOverview', () => ({ TenantOverview: () => null }));
vi.mock('./TenantReadinessProfile', () => ({ TenantReadinessProfile: () => null }));
vi.mock('./TenantProvisioningPanel', () => ({ TenantProvisioning: () => null }));
vi.mock('./TenantOperations', () => ({ TenantOperations: () => null }));
function mount(tab = 'access') {
    return render(<MemoryRouter initialEntries={[`/tenants/dealer-a?tab=${tab}`]}><Routes><Route path="/tenants/:id" element={<TenantDetailView />} /></Routes></MemoryRouter>);
}
describe('Customer credential actions', () => {
    beforeEach(() => { vi.clearAllMocks(); state.superadmin = true; state.role = 'merchant'; state.reset.mockResolvedValue({ success: true }); });
    it('hides privileged reset and impersonation actions from support users', () => {
        state.superadmin = false; mount();
        expect(screen.queryByRole('button', { name: 'Passwort zurücksetzen' })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Händleransicht öffnen' })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Sperren' })).not.toBeInTheDocument();
    });
    it('does not permit an employee fallback for a reset', () => {
        state.role = 'staff'; mount();
        expect(screen.getByRole('button', { name: 'Passwort zurücksetzen' })).toBeDisabled();
        expect(screen.getByText(/Passwortreset gesperrt/)).toBeInTheDocument();
        expect(state.reset).not.toHaveBeenCalled();
    });
    it('enforces server length bounds and masks the password before submission', async () => {
        mount(); fireEvent.click(screen.getByRole('button', { name: 'Passwort zurücksetzen' }));
        const input = screen.getByLabelText('Neues Passwort (12–128 Zeichen)');
        expect(input).toHaveAttribute('type', 'password');
        fireEvent.change(input, { target: { value: '12345678901' } });
        expect(screen.getByRole('button', { name: 'Passwort setzen' })).toBeDisabled();
        fireEvent.change(input, { target: { value: 'Example!23456' } });
        fireEvent.click(screen.getByRole('button', { name: 'Passwort setzen' }));
        await waitFor(() => expect(state.reset).toHaveBeenCalledWith('owner-1', 'Example!23456'));
    });
    it('does not request device sessions while viewing the customer overview', () => {
        mount('overview');
        expect(state.devices).toHaveBeenCalledWith(null);
        expect(state.devices).not.toHaveBeenCalledWith('dealer-a');
    });
});
