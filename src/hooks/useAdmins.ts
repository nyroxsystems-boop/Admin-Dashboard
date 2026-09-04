/**
 * useAdmins — admin user list + self-service email update.
 *
 * The backend exposes only GET /list-admins and PUT /update-email (self-only),
 * so there are no create / delete / role-change hooks here. New admins are
 * provisioned server-side directly in the admin_users table.
 *
 * Admin shape from the API: { id, username, email, full_name?, created_at }.
 * There is no `role` or `last_login_at` in the list response.
 */

import {
    useQuery,
    useMutation,
    useQueryClient,
    type UseMutationResult,
} from '@tanstack/react-query';
import { listAdmins, updateAdminEmail } from '@/api/admins';
import type { Admin } from '@/api/types';

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
