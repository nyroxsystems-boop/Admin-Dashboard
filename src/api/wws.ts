// Admin Dashboard API Module
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
const API_TOKEN = import.meta.env.VITE_WAWI_API_TOKEN || 'api_dev_secret';

export interface AdminStats {
    total_tenants: number;
    total_users: number;
    total_devices: number;
    tenants: Tenant[];
}

export interface Tenant {
    id: number;
    name: string;
    slug: string;
    user_count: number;
    max_users: number;
    device_count: number;
    max_devices: number;
    is_active: boolean;
}

export interface ActiveDevice {
    id: string;
    device_id: string;
    user: string;
    last_seen: string;
    ip: string;
}

async function apiFetch(endpoint: string, options: RequestInit = {}) {
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Token ${API_TOKEN}`,
        ...options.headers,
    };

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers,
    });

    if (!response.ok) {
        throw new Error(`API Error: ${response.statusText}`);
    }

    return response.json();
}

export async function getAdminStats(): Promise<AdminStats> {
    // Mock data for now
    return {
        total_tenants: 3,
        total_users: 12,
        total_devices: 8,
        tenants: [
            {
                id: 1,
                name: 'AutoTeile Müller GmbH',
                slug: 'mueller',
                user_count: 5,
                max_users: 10,
                device_count: 3,
                max_devices: 5,
                is_active: true,
            },
            {
                id: 2,
                name: 'KFZ Schmidt',
                slug: 'schmidt',
                user_count: 4,
                max_users: 10,
                device_count: 2,
                max_devices: 5,
                is_active: true,
            },
            {
                id: 3,
                name: 'Auto Weber',
                slug: 'weber',
                user_count: 3,
                max_users: 5,
                device_count: 3,
                max_devices: 5,
                is_active: false,
            },
        ],
    };
}

export async function listActiveDevices(tenantId: number): Promise<ActiveDevice[]> {
    // Mock data
    return [
        {
            id: '1',
            device_id: 'device-abc-123',
            user: 'admin@example.com',
            last_seen: new Date().toISOString(),
            ip: '192.168.1.100',
        },
    ];
}

export async function removeActiveDevice(tenantId: number, deviceId: string): Promise<void> {
    // Mock implementation
    console.log(`Removing device ${deviceId} from tenant ${tenantId}`);
}

export async function updateTenantLimits(
    tenantId: number,
    limits: { max_users: number; max_devices: number }
): Promise<void> {
    // Mock implementation
    console.log(`Updating limits for tenant ${tenantId}:`, limits);
}

export async function createTenantUser(
    tenantId: number,
    user: { email: string; username: string; password: string; role: string }
): Promise<void> {
    // Mock implementation
    console.log(`Creating user for tenant ${tenantId}:`, user);
}
