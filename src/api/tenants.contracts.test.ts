import { describe, expect, it } from 'vitest';

import {
    CreateTenantResultSchema,
    TenantArraySchema,
    TenantDetailSchema,
} from './types';

describe('tenant API wire contracts', () => {
    it('keeps opaque IDs verbatim and normalizes numeric IDs and legacy scalar values', () => {
        const tenants = TenantArraySchema.parse([
            {
                id: 42,
                name: 'Numeric dealer',
                slug: 'numeric-dealer',
                user_count: '2',
                max_users: '10',
                device_count: '1',
                max_devices: '5',
                is_active: 0,
                onboarding_status: 'pending',
                payment_status: 'trial',
            },
            {
                id: 'dealer-001',
                name: 'Opaque dealer',
                slug: 'opaque-dealer',
                user_count: 1,
                max_users: 10,
                device_count: 0,
                max_devices: 5,
                is_active: true,
                onboarding_status: 'configured',
                payment_status: 'active',
            },
        ]);

        expect(tenants.map((tenant) => tenant.id)).toEqual(['42', 'dealer-001']);
        expect(tenants[0]).toMatchObject({
            user_count: 2,
            max_users: 10,
            device_count: 1,
            max_devices: 5,
            is_active: false,
        });
    });

    it('normalizes the real PostgreSQL detail payload instead of losing all transforms', async () => {
        const parsed = TenantDetailSchema.parse({
            id: 42,
            users: [
                {
                    id: 7,
                    name: 'Legacy Owner',
                    email: 'owner@example.test',
                    username: null,
                    role: null,
                    is_active: 0,
                    created_at: '2026-07-13T10:00:00.000Z',
                },
            ],
            devices: [],
            orders: [],
            settings: {
                max_users: null,
                max_devices: '7',
            },
            stats: {
                total_orders: '3',
                oem_resolved: '2',
                oem_rate: 67,
                total_messages: '8',
                revenue: '199.95',
                user_count: 1,
                device_count: 0,
            },
            audit: [],
        });

        expect(parsed).toMatchObject({
            id: '42',
            users: [
                {
                    id: '7',
                    username: '',
                    role: 'user',
                    is_active: false,
                },
            ],
            settings: {
                max_users: 10,
                max_devices: 7,
                whatsapp_number: null,
                onboarding_status: null,
                payment_status: null,
            },
            stats: {
                total_orders: 3,
                oem_resolved: 2,
                total_messages: 8,
                revenue: 199.95,
            },
        });
    });

    it('maps the complete provisioning result including mail and one-time setup data', () => {
        const response = {
            id: 23,
            name: 'Beispiel Teile GmbH',
            email: 'owner@example.test',
            wawi_synced: true,
            welcome_email_sent: false,
            setup_link: 'https://app.example.test/password-reset?token=secret',
            user_created: {
                id: 99,
                username: 'owner',
                email: 'owner@example.test',
                role: 'merchant',
                initial_password: 'one-time-secret',
                password_was_set: false,
            },
        };
        const result = CreateTenantResultSchema.parse(response);

        expect(result).toMatchObject({
            id: '23',
            welcome_email_sent: false,
            setup_link: response.setup_link,
            user_created: { id: '99', initial_password: 'one-time-secret' },
        });
    });
});
