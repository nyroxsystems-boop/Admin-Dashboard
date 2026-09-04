/**
 * @deprecated — use the domain-specific modules instead:
 *   ./auth, ./admins, ./tenants, ./audit, ./oem, ./bot, ./inbox,
 *   ./orders, ./maintenance, ./health, ./emails
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

// Admins (read + self-service email only; no create/delete/role endpoints exist)
export {
    listAdmins as listAdminUsers,
    updateAdminEmail as updateAdminUserEmail,
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
    listActiveDevices,
    removeActiveDevice,
    createTenantUser,
    resetTenantUserPassword,
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
export { sendBotTestMessage, fileToBase64, cancelBotTestRun } from './bot';

// Maintenance
export { getMaintenanceState, setMaintenanceState } from './maintenance';

// Health
export { getSystemHealth } from './health';

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

/** Legacy name for the normalized device-session response. */
export type { ActiveTenantDevice as ActiveDevice } from './types';
