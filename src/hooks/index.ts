// ── Foundation utilities ───────────────────────────────────────────────────
export { useDebounce } from './useDebounce';
export { useBeforeUnload } from './useBeforeUnload';
export { useLocalStorage } from './useLocalStorage';
export { useMediaQuery, useIsMobile, useIsTablet, useIsDesktop } from './useMediaQuery';
export { useSWR, clearCache, invalidateCache, invalidateCacheByPrefix } from './useCache';
export { useKeyboardShortcuts, type ShortcutHandler } from './useKeyboardShortcuts';

// ── Tenants ────────────────────────────────────────────────────────────────
export {
    useTenants,
    useTenant,
    useCreateTenant,
    useUpdateTenant,
    useUpdateTenantLimits,
    useDeactivateTenant,
    useActivateTenant,
    useTenantDevices,
    useRemoveDevice,
    type CreateTenantInput,
    type UpdateTenantInput,
    type UpdateTenantLimitsInput,
    type RemoveDeviceInput,
    type TenantDeviceRow,
} from './useTenants';

// ── Admins (read + self-service email only) ──────────────────────────────────
export {
    useAdmins,
    useUpdateAdminEmail,
    type UpdateAdminEmailInput,
} from './useAdmins';

// ── Audit ──────────────────────────────────────────────────────────────────
export { useAuditLogs, useExportAuditCsv } from './useAuditLogs';

// ── Maintenance ────────────────────────────────────────────────────────────
export {
    useMaintenance,
    useSetMaintenance,
    type SetMaintenanceInput,
} from './useMaintenance';

// ── OEM ────────────────────────────────────────────────────────────────────
export {
    useOemRegistry,
    useCreateOemRecord,
    useUpdateOemRecord,
    useDeleteOemRecord,
    useBulkDeleteOemRecords,
    type CreateOemRecordInput,
    type UpdateOemRecordInput,
} from './useOemRegistry';
export {
    useOemLookup,
    useReverseLookup,
    useSearchByVin,
    useApproveOemResult,
    type SearchByVinInput,
    type ApproveOemInput,
} from './useOemLookup';
export {
    useOemBatch,
    type BatchProgress,
    type BatchItem,
    type RunBatchOptions,
} from './useOemBatch';
export {
    useOemErrors,
    useResolveOemError,
    type OemErrorEntry,
} from './useOemErrors';

// ── Bot Testing ────────────────────────────────────────────────────────────
export {
    useBotTesting,
    useSendBotTestMessage,
    useCancelBotTestRun,
    type BotTestResult,
} from './useBotTesting';

// ── Inbox ──────────────────────────────────────────────────────────────────
export {
    useInbox,
    useMailboxes,
    useMarkInboxRead,
    useSendInboxEmail,
    useReplyInbox,
    type InboxItem,
    type MarkInboxReadInput,
    type ReplyInboxInput,
} from './useInbox';

// ── Orders ─────────────────────────────────────────────────────────────────
export {
    useOrders,
    useOrder,
    useUpdateOrderStatus,
    useUpdateOrder,
    type AdminOrder,
    type UpdateOrderStatusInput,
    type UpdateOrderInput,
} from './useOrders';

// ── Dashboard / Health ─────────────────────────────────────────────────────
export {
    useDashboardMetrics,
    type DashboardMetrics,
} from './useDashboardMetrics';
export { useSystemHealth } from './useSystemHealth';

// ── Notifications (SSE) & Impersonation (JWT) ─────────────────────────────
export {
    useNotifications,
    type NotificationItem,
} from './useNotifications';
export {
    useImpersonate,
    type ImpersonateInput,
    type ImpersonateResult,
} from './useImpersonate';

// ── Re-exports of API types for view convenience ───────────────────────────
export type {
    Tenant,
    TenantDetail,
    TenantUser,
    TenantDevice,
    Admin,
    AdminRole,
    AuditLog,
    AuditLogPage,
    OemRecord,
    OemRecordsResponse,
    OemDatabaseStats,
    OemLookupResult,
    Order,
    OrderStatus,
    InboxMessage,
    SystemHealth,
    MaintenanceState,
    AdminStats,
    BotTestResponse,
} from '@/api/types';
