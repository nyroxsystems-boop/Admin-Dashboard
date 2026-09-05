import { describe, expect, it } from 'vitest';
import { AdminStatsSchema } from './types';

describe('dashboard metric availability', () => {
    it('preserves unknown totals and sales figures instead of manufacturing zeros', () => {
        const parsed = AdminStatsSchema.parse({ kpis: { sales: { ordersToday: 'invalid', revenue: null }, team: {} } });
        expect(parsed.total_tenants).toBeNull();
        expect(parsed.total_users).toBeNull();
        expect(parsed.kpis?.sales?.ordersToday).toBeNull();
        expect(parsed.kpis?.sales?.revenue).toBeNull();
        expect(parsed.kpis?.team?.activeUsers).toBeNull();
    });
    it('distinguishes valid zero and numeric wire strings from missing values', () => {
        const parsed = AdminStatsSchema.parse({ total_tenants: '18', total_users: 0, kpis: { sales: { ordersToday: 0, revenue: '123.45' } } });
        expect(parsed.total_tenants).toBe(18);
        expect(parsed.total_users).toBe(0);
        expect(parsed.kpis?.sales?.ordersToday).toBe(0);
        expect(parsed.kpis?.sales?.revenue).toBe(123.45);
    });
});
