import { useSecurityAlertsStore } from '@/store/securityAlertsStore';
import { useAuthStore } from '@/store/authStore';
import { useSecurityStore } from '@/store/securityStore';
import type { SecurityAlertSeverity, SecurityAlertType } from '@/store/securityAlertsStore';

// ── Helper to fire a security alert from anywhere ─────────────────────────────
// Usage:  const { alertRoleChange } = useSecurityAlerts();
export const useSecurityAlerts = () => {
    const user = useAuthStore(s => s.user);
    const ipAddress = useSecurityStore(s => s.currentIp);

    const fire = (
        type: SecurityAlertType,
        severity: SecurityAlertSeverity,
        title: string,
        description: string,
        metadata?: Record<string, unknown>
    ) => {
        useSecurityAlertsStore.getState().addAlert({
            type,
            severity,
            title,
            description,
            userId: user?.id ?? 'anonymous',
            userName: user?.name ?? 'Unknown User',
            ipAddress: ipAddress ?? undefined,
            metadata,
        });
    };

    return {
        // 🔐 Role / permission events
        alertRoleChange: (role: string, addedCount: number, removedCount: number) =>
            fire(
                'role_change',
                ['ADMIN', 'ACCOUNT_ADMIN'].includes(role.toUpperCase()) ? 'high' : 'medium',
                `Role Permissions Updated: ${role}`,
                `${user?.name} modified permissions for the ${role} role. +${addedCount} granted, -${removedCount} revoked.`,
                { role, addedCount, removedCount }
            ),

        alertPermissionDenied: (attemptedAction: string) =>
            fire(
                'permission_denied',
                'medium',
                'Unauthorized Access Attempt',
                `${user?.name} attempted to perform "${attemptedAction}" without the required permission.`,
                { attemptedAction }
            ),

        // 🚫 Failed login
        alertFailedLogin: (attemptedId: string, reason: string, severity: SecurityAlertSeverity = 'high') =>
            useSecurityAlertsStore.getState().addAlert({
                type: 'failed_login',
                severity,
                title: 'Failed Login Attempt',
                description: `Login failed for "${attemptedId}". Reason: ${reason}.`,
                userId: attemptedId,
                userName: attemptedId,
                ipAddress: ipAddress ?? undefined,
                metadata: { attemptedId, reason },
            }),

        // 💰 Salary / payroll access
        alertSalaryAccess: (action: string) =>
            fire(
                'salary_access',
                'medium',
                'Sensitive Salary Data Accessed',
                `${user?.name} performed "${action}" on salary/payroll data.`,
                { action }
            ),

        // 🗑️ Bulk delete
        alertBulkDelete: (entityType: string, count: number) =>
            fire(
                'bulk_delete',
                count >= 10 ? 'critical' : 'high',
                `Bulk Delete: ${count} ${entityType}`,
                `${user?.name} deleted ${count} ${entityType} records in a single operation.`,
                { entityType, count }
            ),

        // 📤 Data export
        alertDataExport: (reportName: string, recordCount: number) =>
            fire(
                'data_export',
                'low',
                `Sensitive Report Exported: ${reportName}`,
                `${user?.name} exported "${reportName}" (${recordCount} records).`,
                { reportName, recordCount }
            ),

        // 👑 God mode
        alertGodMode: (enabled: boolean) =>
            fire(
                'god_mode_enabled',
                'critical',
                enabled ? 'God Mode Activated' : 'God Mode Deactivated',
                `${user?.name} ${enabled ? 'activated' : 'deactivated'} God Mode (unrestricted access).`,
                { enabled }
            ),
    };
};
