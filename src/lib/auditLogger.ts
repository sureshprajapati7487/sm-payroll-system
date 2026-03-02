/**
 * auditLogger.ts — Central audit logging helper
 * Call `audit(...)` from any store action to record activity.
 * Uses lazy import to avoid circular dependency issues.
 */

import { AuditAction } from '@/types/audit';

interface AuditParams {
    action: AuditAction;
    entityType?: 'EMPLOYEE' | 'LOAN' | 'PAYROLL' | 'ATTENDANCE' | 'LEAVE' | 'USER' | 'SETTINGS';
    entityId?: string;
    entityName?: string;
    details?: Record<string, any>;
    previousValue?: any;
    newValue?: any;
    status?: 'SUCCESS' | 'FAILED';
    errorMessage?: string;
}

// Lazy-load auditStore & authStore to avoid circular imports
export async function audit(params: AuditParams) {
    try {
        const { useAuditStore } = await import('@/store/auditStore');
        const { useAuthStore } = await import('@/store/authStore');

        const user = useAuthStore.getState().user;
        if (!user) return; // Not logged in — no audit needed

        useAuditStore.getState().addLog({
            userId: user.id,
            userName: user.name,
            userRole: user.role,
            action: params.action,
            entityType: params.entityType ?? 'USER',
            entityId: params.entityId,
            entityName: params.entityName,
            details: params.details ?? {},
            previousValue: params.previousValue,
            newValue: params.newValue,
            ipAddress: 'localhost',
            userAgent: navigator?.userAgent ?? '',
            status: params.status ?? 'SUCCESS',
            errorMessage: params.errorMessage,
        });
    } catch {
        // Silently fail — audit must never break core functionality
    }
}

// Note: auditSync removed — use audit() with fire-and-forget pattern: audit({...})
// It's async but non-blocking since callers don't await it.

/**
 * auditAnonymous — Log events that happen BEFORE login (e.g. failed login attempts).
 * Unlike `audit()`, this does NOT require a logged-in user.
 */
export async function auditAnonymous(params: AuditParams & {
    attemptedUserId?: string; // the ID/email that was tried
}) {
    try {
        const { useAuditStore } = await import('@/store/auditStore');
        useAuditStore.getState().addLog({
            userId: params.attemptedUserId || 'UNKNOWN',
            userName: params.attemptedUserId || 'Unknown',
            userRole: 'GUEST',
            action: params.action,
            entityType: params.entityType ?? 'USER',
            entityId: params.entityId,
            entityName: params.entityName ?? params.attemptedUserId,
            details: params.details ?? {},
            ipAddress: 'client',
            userAgent: navigator?.userAgent ?? '',
            status: params.status ?? 'FAILED',
            errorMessage: params.errorMessage,
        });
    } catch {
        // Silently fail — audit must never break core functionality
    }
}
