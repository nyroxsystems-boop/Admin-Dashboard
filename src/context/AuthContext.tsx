/**
 * Auth Context for Admin Dashboard
 * Manages admin authentication state and provides login/logout functionality
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
    adminLogin,
    adminLogout,
    getAdminMe,
    getAuthToken,
    clearAuth,
    type AdminUser
} from '../api/wws';

interface AuthContextType {
    user: AdminUser | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    login: (username: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
    refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
    children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
    const [user, setUser] = useState<AdminUser | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Check for existing session on mount
    useEffect(() => {
        const initAuth = async () => {
            const token = getAuthToken();
            if (token) {
                try {
                    const userData = await getAdminMe();
                    setUser(userData);
                } catch (error) {
                    // Token invalid or expired - force re-login
                    console.log('[Auth] Token invalid, clearing auth');
                    clearAuth();
                    setUser(null);
                }
            }
            setIsLoading(false);
        };

        initAuth();

        // Listen for session expiry events from the API client
        const handleAuthExpired = () => {
            console.log('[Auth] Session expired — forcing logout');
            setUser(null);
            clearAuth();
        };
        window.addEventListener('auth:expired', handleAuthExpired);
        return () => window.removeEventListener('auth:expired', handleAuthExpired);
    }, []);

    const login = async (username: string, password: string) => {
        const response = await adminLogin(username, password);
        setUser(response.user);
    };

    const logout = async () => {
        await adminLogout();
        setUser(null);
    };

    const refreshUser = async () => {
        try {
            const userData = await getAdminMe();
            setUser(userData);
        } catch (error) {
            setUser(null);
            clearAuth();
        }
    };

    return (
        <AuthContext.Provider
            value={{
                user,
                isAuthenticated: !!user,
                isLoading,
                login,
                logout,
                refreshUser
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
