/**
 * useAdmins — admin user CRUD via real API.
 *
 * Differences from previous stub shape:
 *   - Admin uses `username` (was `name`)
 *   - role is optional (server may omit)
 *   - No `twoFactorEnabled`, no `lastLoginAt` (use `last_login_at` from API)
 *   - createAdmin requires { username, email, password } (and optional role)
 *   - Email updates go through useUpdateAdminEmail (PUT)
 *   - Role updates go through useSetAdminRole (PATCH)
 */

import {
    useQuery,
    useMutation,
    useQueryClient,
    type UseMutationResult,
} from '@tanstack/react-query';
import {
    listAdmins,
    createAdmin,
    updateAdminEmail,
    setAdminRole,
    deleteAdmin,
} from '@/api/admins';
import type { Admin, AdminRole } from '@/api/types';

const ADMINS_KEY = ['admin', 'admins'] as const;
const READ_OPTIONS = { staleTime: 30_000, gcTime: 5 * 60_000 } as const;

export function useAdmins(): {
    admins: Admin[];
    isLoading: boolean;
    error: unknown;
    refetch: () => void;
} {
    const q = useQuery({
        queryKey: ADMINS_KEY,
        queryFn: async () => {
            const res = await listAdmins();
            return res.admins;
        },
        ...READ_OPTIONS,
    });
    return {
        admins: q.data ?? [],
        isLoading: q.isLoading,
        error: q.error,
        refetch: () => void q.refetch(),
    };
}

export interface CreateAdminInput {
    username: string;
    email: string;
    password: string;
    role?: AdminRole;
}

export function useCreateAdmin(): UseMutationResult<
    { success: boolean; admin?: Admin },
    Error,
    CreateAdminInput
> {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (input) => createAdmin(input),
        onSuccess: () => {
            void qc.invalidateQueries({ queryKey: ADMINS_KEY });
        },
    });
}

export interface UpdateAdminEmailInput {
    id: number | string;
    email: string;
}

export function useUpdateAdminEmail(): UseMutationResult<
    { success: boolean },
    Error,
    UpdateAdminEmailInput
> {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, email }) => updateAdminEmail(id, email),
        onSuccess: () => {
            void qc.invalidateQueries({ queryKey: ADMINS_KEY });
        },
    });
}

export interface SetAdminRoleInput {
    id: number | string;
    role: AdminRole;
}

export function useSetAdminRole(): UseMutationResult<
    { success: boolean },
    Error,
    SetAdminRoleInput
> {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, role }) => setAdminRole(id, role),
        onSuccess: () => {
            void qc.invalidateQueries({ queryKey: ADMINS_KEY });
        },
    });
}

export function useDeleteAdmin(): UseMutationResult<
    { success: boolean },
    Error,
    number | string
> {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (id) => deleteAdmin(id),
        onSuccess: () => {
            void qc.invalidateQueries({ queryKey: ADMINS_KEY });
        },
    });
}
