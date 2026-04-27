/**
 * useMe — current admin user + loading state.
 * Thin wrapper around AuthContext for ergonomic call-sites.
 */

import { useAuth } from '../context/AuthContext';
import type { Admin } from '../api/types';

export interface UseMeResult {
    me: Admin | null;
    isLoading: boolean;
    isAuthenticated: boolean;
    refresh: () => Promise<void>;
}

export function useMe(): UseMeResult {
    const { user, isLoading, isAuthenticated, refresh } = useAuth();
    return { me: user, isLoading, isAuthenticated, refresh };
}
