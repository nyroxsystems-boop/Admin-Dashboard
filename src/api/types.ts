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
    mfa_enabled: z.boolean().optional(),
    app_access: z.object({ admin: z.boolean(), crm: z.boolean() }).optional(),
    crm_role: z.string().nullish(),
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

/**
 * Antwort der Anmeldung.
 *
 * ─── Warum `access` OPTIONAL ist ──────────────────────────────────────────
 *
 * Das Backend hat auf Cookie-Sitzungen umgestellt. Das Sitzungstoken kommt
 * jetzt als httpOnly-Cookie (`admin_session`) und steht NUR noch dann im
 * Antwortkörper, wenn `ADMIN_ALLOW_LEGACY_TOKEN_RESPONSE=true` gesetzt ist
 * oder NODE_ENV nicht "production" lautet:
 *
 *   const exposeLegacyToken = process.env.NODE_ENV !== 'production'
 *       || process.env.ADMIN_ALLOW_LEGACY_TOKEN_RESPONSE === 'true';
 *   return res.json({ ...(exposeLegacyToken ? { access: token } : {}), … });
 *
 * In Produktion trifft beides nicht zu — es kommt kein `access`.
 *
 * Solange hier `z.string()` stand, scheiterte die strenge Prüfung mit
 * "access: Required", und der Fehlerpfad zeigte pauschal "Ungültige
 * Anmeldedaten". Serverseitig war die Anmeldung dabei ERFOLGREICH: das Cookie
 * war gesetzt und der Login stand im Protokoll. Das ist auch der Grund, warum
 * die Fehlersuche über die Protokolle in die Irre lief — dort standen lauter
 * Erfolge, während niemand hineinkam.
 *
 * Optional statt entfernt: Entwicklungsumgebungen bekommen das Feld weiterhin,
 * und wer es hat, soll es auch benutzen (dann trägt der Bearer-Header).
 */
export const LoginResponseSchema = z.object({
    access: z.string().optional(),
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

/**
 * PostgreSQL wire values are not completely uniform in the legacy admin API:
 * COUNT/SUM values can arrive as decimal strings and `users.is_active` is an
 * INTEGER (0/1), while newer endpoints already return booleans.  Normalising
 * those values at the API boundary keeps one legacy row from disabling every
 * Zod transform for the complete tenant response.
 */
const BooleanWireSchema = z.preprocess((value) => {
    if (value === true || value === 1 || value === '1' || value === 'true') return true;
    if (value === false || value === 0 || value === '0' || value === 'false') return false;
    return value;
}, z.boolean());

function wireNumber(defaultValue: number): z.ZodEffects<z.ZodNumber, number, unknown> {
    return z.preprocess(
        (value) => (value === null || value === undefined || value === '' ? defaultValue : value),
        z.coerce.number().finite(),
    );
}

export const TenantSchema = z.object({
    // Backend returns either an InvenTree numeric pk or a merchant_id
    // string (UUID-ish / `local-*`). The id is passed VERBATIM as string:
    // the previous djb2-hash "stabilized" non-numeric ids into invented
    // numbers — every mutation (deactivate/impersonate/devices) then hit
    // the backend with an id that matches no tenant, while the UI showed a
    // success toast. Backend routes accept the id as an opaque string.
    id: z.union([z.number(), z.string()]).transform((v) => String(v)),
    name: z.string().default(''),
    slug: z.string().default(''),
    user_count: wireNumber(0),
    max_users: wireNumber(0),
    device_count: wireNumber(0),
    max_devices: wireNumber(0),
    is_active: BooleanWireSchema.default(true),
    // Demo-Sandbox-Kunde (Live-Demo) — wird in der Liste als „Demo" markiert und
    // aus den Plattform-Umsatz-KPIs ausgeschlossen.
    is_demo: BooleanWireSchema.optional(),
    onboarding_status: TenantOnboardingStatusSchema,
    payment_status: TenantPaymentStatusSchema,
    whatsapp_number: z.string().nullish(),
    logo_url: z.string().nullish(),
    created_at: z.string().optional(),
    // Soft-Delete-Tombstone (Befund B7) — kommt nur bei ?include_deleted=1 mit.
    deleted: BooleanWireSchema.optional(),
}).passthrough();
export type Tenant = z.infer<typeof TenantSchema>;

export const TenantArraySchema = z.array(TenantSchema);

export const TenantUserSchema = z.object({
    id: z.union([z.number(), z.string()]).transform((v) => String(v)),
    name: z.string().nullish(),
    email: z.string(),
    // users.username is nullable in migration 001; old imported owners can
    // therefore legitimately have no username yet.
    username: z.string().nullish().transform((value) => value ?? ''),
    role: z.string().nullish().transform((value) => value ?? 'user'),
    // users.is_active is still INTEGER in PostgreSQL (0/1).
    is_active: BooleanWireSchema.default(true),
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

/**
 * Canonical response shape of GET /api/admin/tenants/:id/devices.
 *
 * The platform backend returns numeric or string row IDs, while the legacy WWS
 * endpoint calls the user-agent field `ua`. Normalize both variants at the
 * network boundary so the UI never renders raw `null`/`undefined` values or
 * relies on a TypeScript-only assertion for security-relevant session data.
 */
export const ActiveTenantDeviceSchema = z.object({
    id: z.union([z.number(), z.string()]).transform((value) => String(value)),
    session_id: z.union([z.number(), z.string()]).transform((value) => String(value)),
    user_id: z.union([z.number(), z.string()]).transform((value) => String(value)),
    device_id: z.string().min(1),
    user: z
        .string()
        .nullish()
        .transform((value) => value?.trim() || 'Unbekannter Benutzer'),
    last_seen: z
        .string()
        .nullish()
        .transform((value) => value ?? null),
    ip: z
        .string()
        .nullish()
        .transform((value) => value ?? null),
    user_agent: z.string().nullish().optional(),
    ua: z.string().nullish().optional(),
}).transform(({ user_agent, ua, ...device }) => ({
    ...device,
    user_agent: user_agent ?? ua ?? null,
}));
export type ActiveTenantDevice = z.infer<typeof ActiveTenantDeviceSchema>;

export const ActiveTenantDeviceArraySchema = z.array(ActiveTenantDeviceSchema);

export const TenantDetailSchema = z.object({
    id: z.union([z.number(), z.string()]).transform((v) => String(v)),
    users: z.array(TenantUserSchema),
    devices: z.array(TenantDeviceSchema),
    orders: z.array(z.unknown()).default([]),
    settings: z.object({
        // GET /detail returns the raw tenant_settings row. Legacy rows may
        // contain NULL limits, and the route's no-row fallback only includes
        // the two limit fields. Supply the same defaults as the backend list.
        max_users: wireNumber(10),
        max_devices: wireNumber(5),
        whatsapp_number: z.string().nullish().default(null),
        onboarding_status: z.string().nullish().default(null),
        payment_status: z.string().nullish().default(null),
    }),
    stats: z.object({
        // node-postgres serialises COUNT/SUM(bigint) as strings. Coercion is
        // intentional here; without it one real order made the entire detail
        // response fall back to unnormalised raw data.
        total_orders: wireNumber(0),
        oem_resolved: wireNumber(0),
        oem_rate: wireNumber(0),
        total_messages: wireNumber(0),
        revenue: wireNumber(0),
        user_count: wireNumber(0),
        device_count: wireNumber(0),
    }),
    audit: z.array(z.unknown()).default([]),
});
export type TenantDetail = z.infer<typeof TenantDetailSchema>;

/** Exact successful response of POST /api/admin/tenants. */
export const CreateTenantResultSchema = z.object({
    id: z.union([z.number(), z.string()]).transform((value) => String(value)),
    name: z.string(),
    email: z.string(),
    wawi_synced: z.boolean().default(false),
    welcome_email_sent: z.boolean().default(false),
    setup_link: z.string().min(1).optional(),
    user_created: z.object({
        id: z.union([z.number(), z.string()]).transform((value) => String(value)),
        username: z.string(),
        email: z.string(),
        role: z.string(),
        initial_password: z.string().optional(),
        password_was_set: z.boolean().optional(),
    }).optional(),
}).passthrough();
export type CreateTenantResult = z.infer<typeof CreateTenantResultSchema>;

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

/**
 * Zählwerte kommen als Zeichenkette an — das ist kein Fehler, sondern PostgreSQL.
 *
 * `SELECT COUNT(*)` liefert ein `bigint`, und der Node-Treiber gibt `bigint`
 * grundsätzlich als String zurück: der Wertebereich ist grösser als der von
 * JavaScripts `number`, ein stiller Genauigkeitsverlust wäre die Alternative.
 * JSON kennt ohnehin keinen bigint.
 *
 * Im Backend steht `const totalOrders = totalOrdersResult?.count || 0` — eine
 * nicht-leere Zeichenkette ist wahr, also wird "14" unverändert durchgereicht.
 * Das erzeugte bei jedem Laden des Dashboards fünf Meldungen in der Konsole:
 *
 *   [API] schema mismatch: kpis.sales.totalOrders: Expected number, received string
 *
 * Angezeigt wurde trotzdem das Richtige, weil der Prüfer bei Abweichung mit den
 * Rohdaten weitermacht. Eine Meldung, die bei jedem Laden erscheint und nie
 * etwas bedeutet, ist aber schlimmer als keine — sie gewöhnt das Auge daran,
 * die Konsole zu überblättern, und dann geht die echte Meldung mit unter.
 *
 * `coerce` statt `number`: die Zeichenkette wird beim Prüfen umgewandelt. Das
 * ist hier richtig und nicht bloss bequem — eine Zahl als String ist eine
 * legitime Übertragungsform, keine kaputte Antwort. Der Vertrag lautet "eine
 * Zahl", und `coerce` stellt genau das her.
 *
 * `z.coerce.number()` ohne `.default()`: `coerce` macht aus `undefined` ein
 * `NaN` statt den Vorgabewert zu nehmen. `.catch(0)` fängt beides ab — fehlend
 * wie unbrauchbar.
 */
const zahl = z.coerce.number().catch(0);

/** A missing or malformed operating metric is unknown, never a synthetic zero. */
const knownMetric = z.preprocess(value =>
    value == null || (typeof value !== 'number' && typeof value !== 'string') || (typeof value === 'string' && !value.trim()) ? null : value,
z.coerce.number().finite().nullable().catch(null));

export const AdminStatsKpisSchema = z.object({
    sales: z
        .object({
            totalOrders: zahl,
            ordersToday: knownMetric,
            revenue: knownMetric,
            conversionRate: zahl,
        })
        .optional(),
    team: z
        .object({
            activeUsers: knownMetric,
            tenantCount: knownMetric,
            messagesSent: zahl,
        })
        .optional(),
    oem: z
        .object({
            resolvedCount: zahl,
            successRate: zahl,
        })
        .optional(),
});

export const AdminStatsSchema = z.object({
    total_tenants: knownMetric,
    total_users: knownMetric,
    total_devices: knownMetric,
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
    oem: z.string().default(''),
    brand: z.string().default(''),
    // Backend column names may have shifted: accept legacy `category` alias too
    part_category: z.string().default(''),
    part_description: z.string().default(''),
    model: z.string().default(''),
    model_code: z.string().nullish(),
    year_from: z.number().nullish(),
    year_to: z.number().nullish(),
    engine: z.string().nullish(),
    confidence: z.number().default(0),
    // Production rows have null/missing sources — keep it forgiving so the
    // table renders instead of crashing in `sources.split(',')` callers.
    sources: z.string().nullish(),
    created_at: z.string().default(''),
}).passthrough();
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
    provider_email_id: z.string().optional(),
    direction: z.enum(['inbound', 'outbound']).default('inbound'),
    message_id: z.string().nullish(),
    in_reply_to: z.string().nullish(),
    from: z.string(),
    from_name: z.string().nullish(),
    to: z.array(z.string()).default([]),
    cc: z.array(z.string()).default([]),
    bcc: z.array(z.string()).default([]),
    subject: z.string().nullish(),
    body: z.string().nullish(),
    html: z.string().nullish(),
    received_at: z.string(),
    is_read: z.boolean().default(false),
    mailbox: z.string().optional(),
    /** Alle Postfächer, denen diese Nachricht zugeordnet ist. */
    mailboxes: z.array(z.string()).default([]),
    folder: z.enum(['inbox', 'sent', 'drafts', 'archive', 'trash', 'spam']).default('inbox'),
    /** Warum die Nachricht als Spam gilt. Null = nicht eingestuft. */
    spam_reason: z.enum(['blocklist', 'auth', 'manual']).nullish(),
    /**
     * Woher die Postfach-Zuordnung stammt. 'header' heißt: der Zustellempfänger
     * war nicht ermittelbar und die Zuordnung beruht auf einer Kopfzeile, die
     * der Absender geschrieben hat. Wird in der Oberfläche gekennzeichnet.
     */
    mailbox_source: z.string().nullish(),
    attachments: z.array(z.object({
        id: z.string(),
        filename: z.string().nullish(),
        size: z.number().optional(),
        content_type: z.string(),
        content_disposition: z.string().nullish().optional(),
        content_id: z.string().nullish().optional(),
    })).default([]),
    status: z.string().optional(),
    assigned_to: z.string().nullish(),
    assignment_status: z.enum(['open', 'in_progress', 'done']).optional(),
    assignment_notes: z.string().nullish(),
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

// Backend persists only a single global boolean (merchant_settings 'admin'
// → maintenanceMode). No free-text message or scheduled end time is stored,
// so the type stays intentionally minimal — exposing fields the backend
// silently drops would be a phantom control.
export const MaintenanceStateSchema = z.object({
    enabled: z.boolean(),
});
export type MaintenanceState = z.infer<typeof MaintenanceStateSchema>;

// ──────────────────────────────────────────────────────────────────────────
//  Bot Testing
// ──────────────────────────────────────────────────────────────────────────

// Real shape of POST /api/bot-testing/chat (botTestingRoutes.ts): the bot's
// reply text plus optional order context and interim status messages. The
// previous { success, message } shape matched nothing the backend sends —
// every response rendered as "Failed".
// P2.2: OEM-Kandidat aus dem Resolver (confidence 0..1).
export const BotOemCandidateSchema = z.object({
    oem: z.string(),
    brand: z.string().nullish(),
    source: z.string().optional(),
    confidence: z.number().optional(),
});
export type BotOemCandidate = z.infer<typeof BotOemCandidateSchema>;

// P2.2: strukturierte orderDetails (flach vom Backend angereichert). passthrough,
// weil die volle OrderRow zusätzlich durchgereicht wird.
export const BotOrderDetailsSchema = z
    .object({
        id: z.union([z.string(), z.number()]).nullish(),
        status: z.string().nullish(),
        oem_number: z.string().nullish(),
        requested_part_name: z.string().nullish(),
        brand: z.string().nullish(),
        model: z.string().nullish(),
        year: z.union([z.string(), z.number()]).nullish(),
        vin: z.string().nullish(),
        total: z.union([z.string(), z.number()]).nullish(),
        oemCandidates: z.array(BotOemCandidateSchema).default([]),
        oemConfidence: z.number().nullish(),
    })
    .passthrough();
export type BotOrderDetails = z.infer<typeof BotOrderDetailsSchema>;

export const BotTestResponseSchema = z.object({
    reply: z.string(),
    orderId: z.union([z.string(), z.number()]).nullish(),
    orderDetails: BotOrderDetailsSchema.nullish(),
    // P2.2: Angebots-PDF (nur wenn der Turn ein Angebot bestätigt hat).
    pdfDocument: z
        .object({ base64: z.string(), filename: z.string(), caption: z.string().optional() })
        .nullish(),
    interimMessages: z.array(z.string()).default([]),
    messageCount: z.number().optional(),
    session: z.unknown().optional(),
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
