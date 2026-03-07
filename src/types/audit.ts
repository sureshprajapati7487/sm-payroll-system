// Audit & Security Types for Phase 15

export type AuditAction =
    | 'LOGIN'
    | 'LOGIN_FAILED'
    | 'LOGOUT'
    | 'CHANGE_PASSWORD'
    | 'CREATE_EMPLOYEE'
    | 'UPDATE_EMPLOYEE'
    | 'DELETE_EMPLOYEE'
    | 'CREATE_LOAN'
    | 'APPROVE_LOAN'
    | 'REJECT_LOAN'
    | 'PAY_EMI'
    | 'EDIT_EMI'
    | 'DELETE_TRANSACTION'
    | 'GENERATE_PAYROLL'
    | 'UPDATE_PAYROLL'
    | 'DELETE_PAYROLL'
    | 'MARK_ATTENDANCE'
    | 'EDIT_ATTENDANCE'
    | 'DELETE_ATTENDANCE'
    | 'APPROVE_LEAVE'
    | 'REJECT_LEAVE'
    | 'ROLE_CHANGE'
    | 'PERMISSION_CHANGE'
    | 'SETTINGS_UPDATE'
    | 'DATA_EXPORT'
    | 'BULK_IMPORT';

export interface AuditLog {
    id: string;
    timestamp: string;
    userId: string;
    userName: string;
    userRole: string;
    action: AuditAction;
    entityType: 'EMPLOYEE' | 'LOAN' | 'PAYROLL' | 'ATTENDANCE' | 'LEAVE' | 'USER' | 'SETTINGS';
    entityId?: string;
    entityName?: string;
    details: Record<string, any>; // Additional context
    ipAddress: string;
    userAgent: string;
    previousValue?: any; // For updates
    newValue?: any; // For updates
    status: 'SUCCESS' | 'FAILED';
    errorMessage?: string;
}

export interface SessionInfo {
    id: string;
    userId: string;
    loginTime: string;
    lastActivity: string;
    ipAddress: string;
    userAgent: string;
    expiresAt: string;
    isActive: boolean;
}

export interface IPRestriction {
    id: string;
    ipAddress: string;
    ipRange?: string; // e.g., "192.168.1.0/24"
    description: string;
    isWhitelisted: boolean;
    createdBy: string;
    createdAt: string;
}

export interface DataMaskingRule {
    field: string;
    maskType: 'PARTIAL' | 'FULL' | 'HASH';
    visibleChars?: number; // For PARTIAL masking
    allowedRoles: string[]; // Roles that can see unmasked data
}
