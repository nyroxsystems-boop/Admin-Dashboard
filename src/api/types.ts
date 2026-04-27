/**
 * Admin Dashboard — Shared API Types & Zod Schemas
 *
 * Jeder Domain-Type hat ein passendes Zod-Schema, mit dem Server-Responses
 * zur Laufzeit validiert werden können. Das schützt das UI vor schweigenden
 * Backend-Drift-Bugs.
 *
 * Verwendung:
 *   const data = await apiFetch<unknown>('/api/admin/tenants');
 *   return parseApiResponse(TenantArraySchema, data);
 */

import { z } from 'zod';

// ──────────────────────────────────────────────────────────────────────────
//  Helper
// ──────────────────────────────────────────────────────────────────────────

/**
 * Best-effort parse: tries the schema, but on failure logs a warning and
 * returns the raw payload cast to the schema's inferred type. This is the
 * pragmatic choice for an admin dashboard talking to a backend whose data
 * predates the schema — a single unexpected enum value should not blank
 * the whole dashboard. Hard validation belongs at the network boundary
 * for fields that are actually security-critical (login response shape,
 * etc.), and those callers should use parseApiResponseStrict() instead.
 */
export function parseApiResponse<S extends z.ZodTypeAny>(schema: S, data: unknown): z.infer<S> {
    const result = schema.safeParse(data);
    if (result.success) return result.data as z.infer<S>;
    const issues = result.error.issues
        .map((i) => `${i.path.join('.') || '<root>'}: ${i.message}`)
        .join('; ');
    // eslint-disable-next-line no-console
    console.warn(`[API] schema mismatch (continuing with raw data): ${issues}`);
    return data as z.infer<S>;
}

/** Strict parse — throws on schema mismatch. Use only for security-critical
 *  responses (login, /me) where bad data should fail loud. */
export function parseApiResponseStrict<S extends z.ZodTypeAny>(schema: S, data: unknown): z.infer<S> {
    const result = schema.safeParse(data);
    if (!result.success) {
        const issues = result.error.issues.map((i) => `${i.path.join('.') || '<root>'}: ${i.message}`).join('; ');
        throw new Error(`API response validation failed: ${issues}`);
    }
    return result.data as z.infer<S>;
}

/** Permissive parse — returns null instead of throwing. Use for legacy endpoints. */
export function safeParseApiResponse<S extends z.ZodTypeAny>(schema: S, data: unknown): z.infer<S> | null {
    const result = schema.safeParse(data);
    return result.success ? (result.data as z.infer<S>) : null;
}

// ──────────────────────────────────────────────────────────────────────────
//  Roles & Permissions
// ──────────────────────────────────────────────────────────────────────────

export const AdminRoleSchema = z.enum(['SUPER_ADMIN', 'SUPPORT_ADMIN', 'READ_ONLY']);
export type AdminRole = z.infer<typeof AdminRoleSchema>;

/** Backend may also send legacy role strings; normalize at boundary. */
export const LegacyAdminRoleSchema = z.enum(['superadmin', 'admin', 'viewer']);

// ──────────────────────────────────────────────────────────────────────────
//  Admin / User
// ──────────────────────────────────────────────────────────────────────────

export const AdminSchema = z.object({
    id: z.union([z.number(), z.string()]).transform((v) => String(v)),
    username: z.string(),
    email: z.string().email().or(z.string()),
    role: z.union([AdminRoleSchema, LegacyAdminRoleSchema]).optional(),
    must_change_password: z.boolean().optional(),
    signature: z.string().nullish(),
    created_at: z.string().optional(),
    last_login_at: z.string().nullish(),
});
export type Admin = z.infer<typeof AdminSchema>;

export const AdminListResponseSchema = z.object({
    admins: z.array(AdminSchema),
});
export type AdminListResponse = z.infer<typeof AdminListResponseSchema>;

// ──────────────────────────────────────────────────────────────────────────
//  Auth
// ──────────────────────────────────────────────────────────────────────────

export const LoginResponseSchema = z.object({
    access: z.string(),
    refresh: z.string().optional(),
    expiresIn: z.number().optional(),
    expires_in: z.number().optional(),
    user: AdminSchema,
});
export type LoginResponse = z.infer<typeof LoginResponseSchema>;

export const PasswordResetResponseSchema = z.object({
    success: z.boolean(),
    message: z.string().optional(),
});
export type PasswordResetResponse = z.infer<typeof PasswordResetResponseSchema>;

// ──────────────────────────────────────────────────────────────────────────
//  Tenant
// ──────────────────────────────────────────────────────────────────────────

// Status enums kept as type hints for TypeScript callers, but the schemas
// below accept any string the backend returns. Strict enums were rejecting
// real production data (e.g. legacy `tenant_settings` rows with values
// like "in_progress" or empty strings) and crashing the whole dashboard
// via parseApiResponse → throw.
export const TenantPaymentStatusSchema = z.string().nullish();
export const TenantOnboardingStatusSchema = z.string().nullish();
export type TenantPaymentStatus = 'paid' | 'trial' | 'overdue' | (string & {});
export type TenantOnboardingStatus = 'pending' | 'completed' | (string & {});

export const TenantSchema = z.object({
    // Backend returns either an InvenTree numeric pk or a merchant_id
    // string (UUID-ish). UI everywhere treats id as number — for UUID-ish
    // ids we hash to a stable positive integer instead of NaN, so React
    // keys + Set<number> bookkeeping keep working.
    id: z.union([z.number(), z.string()]).transform((v): number => {
        if (typeof v === 'number') return v;
        const n = Number(v);
        if (Number.isFinite(n)) return n;
        // Stable djb2-style hash → 32-bit positive int for non-numeric ids
        let h = 5381;
        for (let i = 0; i < v.length; i++) h = ((h * 33) ^ v.charCodeAt(i)) | 0;
        return Math.abs(h);
    }),
    name: z.string().default(''),
    slug: z.string().default(''),
    user_count: z.number().default(0),
    max_users: z.number().default(0),
    device_count: z.number().default(0),
    max_devices: z.number().default(0),
    is_active: z.boolean().default(true),
    onboarding_status: TenantOnboardingStatusSchema,
    payment_status: TenantPaymentStatusSchema,
    whatsapp_number: z.string().nullish(),
    logo_url: z.string().nullish(),
    created_at: z.string().optional(),
}).passthrough();
export type Tenant = z.infer<typeof TenantSchema>;

export const TenantArraySchema = z.array(TenantSchema);

export const TenantUserSchema = z.object({
    id: z.union([z.number(), z.string()]).transform((v) => String(v)),
    name: z.string().nullish(),
    email: z.string(),
    username: z.string(),
    role: z.string(),
    is_active: z.boolean().default(true),
    created_at: z.string(),
});
export type TenantUser = z.infer<typeof TenantUserSchema>;

export const TenantDeviceSchema = z.object({
    device_id: z.string(),
    user_agent: z.string().nullish(),
    ip_address: z.string().nullish(),
    created_at: z.string(),
    last_seen_at: z.string().nullish(),
});
export type TenantDevice = z.infer<typeof TenantDeviceSchema>;

export const TenantDetailSchema = z.object({
    id: z.union([z.number(), z.string()]).transform((v) => String(v)),
    users: z.array(TenantUserSchema),
    devices: z.array(TenantDeviceSchema),
    orders: z.array(z.unknown()).default([]),
    settings: z.object({
        max_users: z.number(),
        max_devices: z.number(),
        whatsapp_number: z.string().nullish(),
        onboarding_status: z.string().nullish(),
        payment_status: z.string().nullish(),
    }),
    stats: z.object({
        total_orders: z.number().default(0),
        oem_resolved: z.number().default(0),
        oem_rate: z.number().default(0),
        total_messages: z.number().default(0),
        revenue: z.number().default(0),
        user_count: z.number().default(0),
        device_count: z.number().default(0),
    }),
    audit: z.array(z.unknown()).default([]),
});
export type TenantDetail = z.infer<typeof TenantDetailSchema>;

// ──────────────────────────────────────────────────────────────────────────
//  Audit Log
// ──────────────────────────────────────────────────────────────────────────

export const AuditLogSchema = z.object({
    id: z.union([z.number(), z.string()]).transform((v) => String(v)),
    admin_user: z.string().nullish(),
    admin_username: z.string().nullish(),
    action: z.string().nullish(),
    action_type: z.string().nullish(),
    entity_type: z.string().nullish(),
    entity_id: z.string().nullish(),
    entity_name: z.string().nullish(),
    old_value: z.string().nullish(),
    new_value: z.string().nullish(),
    details: z.string().nullish(),
    ip_address: z.string().nullish(),
    timestamp: z.string().optional(),
    created_at: z.string().optional(),
});
export type AuditLog = z.infer<typeof AuditLogSchema>;

export const AuditLogPageSchema = z.object({
    logs: z.array(AuditLogSchema),
    cursor: z.string().nullish(),
    hasMore: z.boolean().optional(),
});
export type AuditLogPage = z.infer<typeof AuditLogPageSchema>;

// ──────────────────────────────────────────────────────────────────────────
//  Admin Stats
// ──────────────────────────────────────────────────────────────────────────

export const AdminStatsKpisSchema = z.object({
    sales: z
        .object({
            totalOrders: z.number().default(0),
            ordersToday: z.number().default(0),
            revenue: z.number().default(0),
            conversionRate: z.number().default(0),
        })
        .optional(),
    team: z
        .object({
            activeUsers: z.number().default(0),
            tenantCount: z.number().default(0),
            messagesSent: z.number().default(0),
        })
        .optional(),
    oem: z
        .object({
            resolvedCount: z.number().default(0),
            successRate: z.number().default(0),
        })
        .optional(),
});

export const AdminStatsSchema = z.object({
    total_tenants: z.number().default(0),
    total_users: z.number().default(0),
    total_devices: z.number().default(0),
    tenants: z.array(TenantSchema).default([]),
    history: z
        .array(z.object({ name: z.string(), orders: z.number(), revenue: z.number() }))
        .optional(),
    kpis: AdminStatsKpisSchema.optional(),
});
export type AdminStats = z.infer<typeof AdminStatsSchema>;

// ──────────────────────────────────────────────────────────────────────────
//  OEM Records
// ──────────────────────────────────────────────────────────────────────────

export const OemRecordSchema = z.object({
    id: z.number(),
    oem: z.string(),
    brand: z.string(),
    part_category: z.string(),
    part_description: z.string(),
    model: z.string(),
    model_code: z.string().nullish(),
    year_from: z.number().nullish(),
    year_to: z.number().nullish(),
    engine: z.string().nullish(),
    confidence: z.number(),
    sources: z.string(),
    created_at: z.string(),
});
export type OemRecord = z.infer<typeof OemRecordSchema>;

export const OemRecordsResponseSchema = z.object({
    records: z.array(OemRecordSchema),
    total: z.number(),
    page: z.number(),
    limit: z.number(),
    totalPages: z.number(),
    filters: z.object({
        brands: z.array(z.string()),
        categories: z.array(z.string()),
        modelCodes: z.array(z.string()).optional(),
    }),
});
export type OemRecordsResponse = z.infer<typeof OemRecordsResponseSchema>;

export const OemDatabaseStatsSchema = z.object({
    exists: z.boolean(),
    totalRecords: z.number(),
    sizeBytes: z.number(),
    sizeMB: z.string(),
    brands: z.array(z.object({ brand: z.string(), count: z.number() })),
    categories: z.array(z.object({ part_category: z.string(), count: z.number() })),
});
export type OemDatabaseStats = z.infer<typeof OemDatabaseStatsSchema>;

export const OemLookupResultSchema = z.object({
    oem: z.string(),
    existsInRegistry: z.boolean(),
    registryRecord: z
        .object({
            id: z.number(),
            oem: z.string(),
            brand: z.string(),
            part_category: z.string(),
            part_description: z.string(),
            model: z.string(),
            confidence: z.number(),
        })
        .nullable(),
    aiResult: z.object({
        partName: z.string(),
        brand: z.string(),
        part_category: z.string(),
        part_description: z.string(),
        model: z.string(),
        vehicles: z.string(),
        manufacturer: z.string(),
        confidence: z.number(),
        notes: z.string(),
    }),
});
export type OemLookupResult = z.infer<typeof OemLookupResultSchema>;

// ──────────────────────────────────────────────────────────────────────────
//  Order
// ──────────────────────────────────────────────────────────────────────────

export const OrderStatusSchema = z.enum([
    'new',
    'in_progress',
    'awaiting_parts',
    'ready',
    'done',
    'archived',
    'cancelled',
]);
export type OrderStatus = z.infer<typeof OrderStatusSchema>;

export const OrderSchema = z.object({
    id: z.string(),
    status: OrderStatusSchema,
    customer_name: z.string().nullish(),
    customer_contact: z.string().nullish(),
    requested_part_name: z.string().nullish(),
    oem_number: z.string().nullish(),
    vehicle_description: z.string().nullish(),
    created_at: z.string(),
    updated_at: z.string(),
    merchant_id: z.string(),
    notes: z.string().nullish(),
});
export type Order = z.infer<typeof OrderSchema>;

// ──────────────────────────────────────────────────────────────────────────
//  Inbox
// ──────────────────────────────────────────────────────────────────────────

export const InboxMessageSchema = z.object({
    id: z.string(),
    from: z.string(),
    subject: z.string().nullish(),
    body: z.string().nullish(),
    received_at: z.string(),
    is_read: z.boolean().default(false),
    mailbox: z.string().optional(),
});
export type InboxMessage = z.infer<typeof InboxMessageSchema>;

// ──────────────────────────────────────────────────────────────────────────
//  System Health
// ──────────────────────────────────────────────────────────────────────────

export const SystemHealthSchema = z.object({
    redis: z.enum(['ok', 'degraded', 'down']).default('ok'),
    db: z.enum(['ok', 'degraded', 'down']).default('ok'),
    botApi: z.enum(['ok', 'degraded', 'down']).default('ok'),
    timestamp: z.string().optional(),
});
export type SystemHealth = z.infer<typeof SystemHealthSchema>;

// ──────────────────────────────────────────────────────────────────────────
//  Maintenance
// ──────────────────────────────────────────────────────────────────────────

export const MaintenanceStateSchema = z.object({
    enabled: z.boolean(),
    message: z.string().optional(),
    scheduled_until: z.string().nullish(),
});
export type MaintenanceState = z.infer<typeof MaintenanceStateSchema>;

// ──────────────────────────────────────────────────────────────────────────
//  Bot Testing
// ──────────────────────────────────────────────────────────────────────────

export const BotTestResponseSchema = z.object({
    success: z.boolean(),
    message: z.string().optional(),
    raw: z.unknown().optional(),
});
export type BotTestResponse = z.infer<typeof BotTestResponseSchema>;

// ──────────────────────────────────────────────────────────────────────────
//  Email Templates (Marketing)
// ──────────────────────────────────────────────────────────────────────────

export const EmailRecipientSchema = z.object({
    email: z.string(),
    name: z.string(),
    id: z.string(),
});
export type EmailRecipient = z.infer<typeof EmailRecipientSchema>;

export const GeneratedEmailSchema = z.object({
    subject: z.string(),
    preview: z.string(),
    htmlContent: z.string(),
    plainText: z.string(),
});
export type GeneratedEmail = z.infer<typeof GeneratedEmailSchema>;

export const EmailTemplateSchema = z.object({
    id: z.string(),
    name: z.string(),
    subject: z.string(),
    html_content: z.string(),
    prompt: z.string().optional(),
    created_by: z.string().optional(),
    created_at: z.string(),
});
export type EmailTemplate = z.infer<typeof EmailTemplateSchema>;
