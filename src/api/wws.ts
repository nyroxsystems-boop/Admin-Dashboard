/**
 * @deprecated — use the domain-specific modules instead:
 *   ./auth, ./admins, ./tenants, ./audit, ./oem, ./bot, ./inbox,
 *   ./orders, ./scraper, ./maintenance, ./health, ./emails
 *
 * This file exists only as a backward-compat re-export shim during the
 * Phase-2 view migration (Agent 3). It will be deleted once all `views/`
 * imports point at the new domain modules.
 */

/// <reference types="vite/client" />

export { setAuthToken, setAccessToken, getAuthToken, clearAuth, ApiError, isApiError, parseError } from './client';

// Auth
export {
    adminLogin,
    adminLogout,
    getAdminMe,
    requestPasswordReset,
    resetPassword,
    changePassword,
    updateSignature,
} from './auth';

// Admins
export {
    listAdmins as listAdminUsers,
    updateAdminEmail as updateAdminUserEmail,
    createAdmin,
    deleteAdmin,
    setAdminRole,
} from './admins';

// Tenants
export {
    listTenants,
    getAdminStats,
    getTenant as getTenantDetail,
    createTenant,
    updateTenant,
    updateTenantLimits,
    deactivateTenant,
    activateTenant,
    deleteTenant,
    listActiveDevices,
    removeActiveDevice,
    createTenantUser,
} from './tenants';

// Audit
export { getActivityLog, getAuditLog, exportAuditLogCsv } from './audit';

// OEM
export {
    getOemDatabaseStats,
    triggerOemSeeder,
    runOemValidator,
    getOemRecords,
    createOemRecord,
    updateOemRecord,
    deleteOemRecord,
    bulkDeleteOemRecords,
    lookupOem,
    approveOemResult,
    resolveOemForward,
    reverseOemLookup,
    searchOemByVin,
    fetchAccuracyStats,
    listOemErrors,
    resolveOemError,
} from './oem';

// Orders
export { listAllOrders, updateOrderStatus, updateOrder, getOrder } from './orders';

// Inbox
export { listInboxMessages, markInboxRead, listMailboxes, replyInboxMessage } from './inbox';

// Bot
export { sendBotTestMessage, uploadBotTestMedia, cancelBotTestRun } from './bot';

// Scraper / PartsLink24
export {
    lookupPartslink24,
    getPartslinkHealth,
    getBulkStatus,
    getBulkVehicles,
    createBulkVehicle,
    updateBulkVehicle,
    discoverFromPL24,
    seedBulkVins,
    deleteBulkVehicle,
    startBulkJob,
    startAllBulkJobs,
    pauseBulkJob,
    resumeBulkJob,
    cancelBulkJob,
    cancelAllBulkJobs,
    getBulkJobs,
    getBulkJobDetail,
    getBulkJobResults,
    exportBulkToOemDb,
    getBrands,
    crawlBrand,
    startBrandChain,
    pauseBrandChain,
    resumeBrandChain,
    cancelBrandChain,
    getBrandChainState,
} from './scraper';

// Maintenance
export { getMaintenanceState, setMaintenanceState } from './maintenance';

// Health
export { getSystemHealth, pingService } from './health';

// Emails
export {
    generateEmailTemplate,
    improveEmailTemplate,
    getEmailRecipients,
    sendMarketingEmail,
    getSavedTemplates,
    saveEmailTemplate,
} from './emails';

// Re-export types for backward compat
export type {
    Admin,
    Admin as AdminUser,
    Tenant,
    TenantDetail,
    AuditLog as AuditLogEntry,
    AuditLog as ActivityLogEntry,
    OemRecord,
    OemRecordsResponse,
    OemDatabaseStats,
    OemLookupResult,
    Order,
    OrderStatus,
    AdminStats,
    LoginResponse,
    EmailRecipient,
    EmailTemplate,
    GeneratedEmail,
    SystemHealth,
} from './types';

export type { OemSearchParams } from './oem';
export type { VinDecodedInfo, VinSearchResponse, AccuracyStats } from './oem';
export type {
    BulkVehicle,
    BulkJob,
    BulkStatus,
    BulkResultRow,
    BulkJobProgress,
    BrandChainError,
    BrandChainState,
    PartslinkResult,
} from './scraper';

/**
 * Legacy device shape exposed by listActiveDevices.
 * Kept as type alias so old callers compile.
 */
export interface ActiveDevice {
    id: string;
    device_id: string;
    user: string;
    last_seen: string;
    ip: string;
}
