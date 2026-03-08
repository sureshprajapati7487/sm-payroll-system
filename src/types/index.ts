export type Role = 'SUPER_ADMIN' | 'ADMIN' | 'ACCOUNT_ADMIN' | 'MANAGER' | 'EMPLOYEE';

export enum Roles {
    SUPER_ADMIN = 'SUPER_ADMIN',
    ADMIN = 'ADMIN',
    ACCOUNT_ADMIN = 'ACCOUNT_ADMIN',
    MANAGER = 'MANAGER',
    EMPLOYEE = 'EMPLOYEE',
}

export interface User {
    id: string;
    name: string;
    role: Role;
    avatar?: string;
    email: string;
    companyId?: string; // From server JWT — used to auto-switch company after login
}


export enum EmployeeStatus {
    ACTIVE = 'ACTIVE',
    INACTIVE = 'INACTIVE',
    ON_LEAVE = 'ON_LEAVE',
    SUSPENDED = 'SUSPENDED',
}

export type ShiftType = 'MORNING' | 'EVENING' | 'NIGHT' | 'GENERAL';
export enum SalaryType {
    MONTHLY = 'MONTHLY',
    DAILY = 'DAILY',
    HOURLY = 'HOURLY',
    PRODUCTION = 'PRODUCTION', // Quantity / Piece Rate
}

export interface BankDetails {
    accountNumber: string;
    ifscCode: string;
    bankName: string;
    panCard?: string;
    aadharNumber?: string;
    upiId?: string;
}

// ── Relative / Emergency Contact ──────────────────────────────────────────────
export interface RelativeInfo {
    name?: string;
    relation?: string;       // Father, Mother, Spouse, Brother, Sister, Friend
    phone?: string;
    dateOfBirth?: string;
    occupation?: string;
    address?: string;
    aadharNumber?: string;
    panNumber?: string;
    aadharUrl?: string;      // Base64 photo of Aadhar card
    panUrl?: string;         // Base64 photo of PAN card
    photoUrl?: string;       // Passport-size photo of relative
}

// ── Statutory / Government Deductions Config ──────────────────────────────────
export interface StatutoryConfig {
    // PF - Provident Fund (12% of Basic, employer also 12%)
    pfApplicable: boolean;
    pfNumber?: string;        // UAN (Universal Account Number)
    pfRate?: number;          // Default 12 (%), can override
    pfCapped?: boolean;       // Cap at ₹15,000 basic (standard rule)

    // ESIC - Employee State Insurance (0.75% employee, 3.25% employer)
    esicApplicable: boolean;
    esicNumber?: string;      // ESIC IP Number
    esicRate?: number;        // Default 0.75 (%)

    // PT - Professional Tax (State-wise slab, usually ₹200/month)
    ptApplicable: boolean;
    ptState?: string;         // State name for PT calculation
    ptAmount?: number;        // Monthly PT amount (optional override)

    // TDS - Tax Deducted at Source (based on income tax slabs)
    tdsApplicable: boolean;
    tdsPanLinked?: boolean;   // If PAN is linked, uses slab; else 20% flat
    tdsPercentage?: number;   // Optional manual override %
    tdsDeclaredInvestment?: number; // Annual declared 80C investments
}

export interface Employee {
    id: string;
    companyId?: string;
    code: string;
    name: string;
    email: string;
    phone: string;
    department: string;
    designation: string;
    role: Role;
    joiningDate: string;
    status: EmployeeStatus;

    // Work Details
    shift: ShiftType;
    salaryType: SalaryType;
    basicSalary: number;
    paymentRate?: number;
    reportsTo?: string;
    password?: string;
    whatsappNumber?: string;

    // Secure Data
    faceData?: string;
    bankDetails?: BankDetails;
    documents?: {
        aadharUrl?: string;
        panUrl?: string;
    };

    // Relative / Emergency Contact
    relativeInfo?: RelativeInfo;

    avatar?: string;

    // Leave Management
    isLeaveBlocked?: boolean;
    leaveBalance?: {
        CASUAL: number;
        SICK: number;
        PAID: number;
        UNPAID: number;
    };

    // Loan Management - Max Limit
    loanLimit?: number;
    loanLimitType?: 'FIXED' | 'SALARY_MULTIPLE';
    salaryMultiplier?: number;

    // ── Statutory / Govt Deductions ──────────────────────────
    statutoryConfig?: StatutoryConfig;

    // ── Dynamic Custom Fields ─────────────────────────────────
    customData?: Record<string, any>;
}


// Attendance
export enum AttendanceStatus {
    PRESENT = 'PRESENT',
    ABSENT = 'ABSENT',
    HALF_DAY = 'HALF_DAY',
    LATE = 'LATE',
    ON_LEAVE = 'ON_LEAVE',
    HOLIDAY = 'HOLIDAY',        // New
    WEEKLY_OFF = 'WEEKLY_OFF',   // New
    WORK_FROM_HOME = 'WORK_FROM_HOME' // Ensuring this exists for consistency
}

export interface BreakRecord {
    start: string;   // ISO timestamp
    end?: string;    // ISO timestamp (undefined = break in progress)
}

export interface AttendanceRecord {
    id: string;
    companyId?: string;
    employeeId: string;
    date: string;            // ISO Date YYYY-MM-DD
    checkIn?: string;        // ISO Timestamp
    checkOut?: string;       // ISO Timestamp
    status: AttendanceStatus;
    shiftId?: string;        // Shift assigned
    lateByMinutes?: number;
    overtimeHours?: number;
    isOverride?: boolean;    // Admin manually changed status

    // ── Break Time Tracking ───────────────────────────────────────────────────
    breaks?: BreakRecord[];  // Array of break sessions today

    // ── Admin Manual Punch ────────────────────────────────────────────────────
    isManualPunch?: boolean; // true if admin punched on behalf
    manualPunchBy?: string;  // Admin user name
    manualPunchReason?: string;

    // ── Punch Meta ────────────────────────────────────────────────────────────
    punchLocationId?: string;  // Which GPS zone was matched
    usedPinPunch?: boolean;    // true if punched via PIN mode
    punchMode?: 'face' | 'fingerprint' | 'photoUpload' | 'pin' | 'admin'; // How punch happened
}


export interface Holiday {
    id: string;
    name: string;
    date: string; // YYYY-MM-DD
    type: 'NATIONAL' | 'FESTIVAL' | 'OPTIONAL';
    description?: string;
}

export interface RegularizationRequest {
    id: string;
    employeeId: string;
    date: string; // YYYY-MM-DD
    type: 'MISSED_PUNCH' | 'OFFICIAL_DUTY' | 'WORK_FROM_HOME' | 'LEAVE_CORRECTION';
    reason: string;
    status: 'PENDING' | 'APPROVED' | 'REJECTED';
    createdAt: string;
}

export interface ProductionItem {
    id: string;
    companyId?: string;
    name: string; // e.g. "Stitching Shirt"
    rate: number; // e.g. 15
    category: string; // e.g. "Stitching"
}

export interface Shift {
    id: string;
    companyId: string; // [NEW] Multi-Tenancy Link
    name: string;
    startTime: string; // "09:00"
    endTime: string; // "18:00"
    graceTimeMinutes: number; // 15
}

export interface ShiftConfig {
    companyId: string;
    startTime: string; // "09:00"
    endTime: string; // "18:00"
    graceTimeMinutes: number; // 15
    halfDayThresholdHours: number; // 4
}

export enum ProductionStatus {
    PENDING = 'PENDING',
    APPROVED = 'APPROVED',
    REJECTED = 'REJECTED',
}

export interface ProductionEntry {
    id: string;
    companyId?: string;
    date: string; // YYYY-MM-D
    employeeId: string;
    item: string; // e.g., "Stitching Shirt"
    itemId?: string; // Linked backend master item ID
    qty: number;
    rate: number;
    totalAmount: number; // qty * rate
    status: ProductionStatus;
    remarks?: string;
}

export enum LeaveType {
    CASUAL = 'CASUAL',
    SICK = 'SICK',
    PAID = 'PAID',
    UNPAID = 'UNPAID',
}

export enum LeaveStatus {
    PENDING = 'PENDING',
    APPROVED = 'APPROVED',
    REJECTED = 'REJECTED',
}

export interface LeaveRequest {
    id: string;
    companyId?: string;
    employeeId: string;
    type: LeaveType;
    startDate: string;
    endDate: string;
    isHalfDay?: boolean; // New Feature
    daysCount?: number; // Calculated days (e.g. 0.5 or 2.0)
    reason: string;
    status: LeaveStatus;
    appliedOn: string;
    // Workflow tracking
    workflowApprovals?: {
        stepId: string;
        roleId: string;
        roleName: string;
        status: 'PENDING' | 'APPROVED' | 'REJECTED';
        actorName?: string;
        actedAt?: string;
    }[];
    currentWorkflowStep?: number; // 0-based index of the current awaiting step
}

export enum LoanType {
    PF_LOAN = 'PF_LOAN',
    ADVANCE_CASH = 'ADVANCE_CASH',
    FOOD = 'FOOD',
    FINE = 'FINE',
    SALARY_PAY = 'SALARY_PAY',
    OTHER = 'OTHER',
}

export enum LoanStatus {
    REQUESTED = 'REQUESTED',
    CHECKED = 'CHECKED', // Verified by Checker
    ACTIVE = 'ACTIVE',
    REJECTED = 'REJECTED',
    CLOSED = 'CLOSED',
}

export interface LoanTransaction {
    id: string;
    date: string;
    amount: number;
    type: 'EMI' | 'SETTLEMENT' | 'ADVANCE_PAYMENT';
    remarks?: string;
}

export interface AuditLog {
    id: string;
    date: string;
    action: string; // 'REQUESTED', 'CHECKED', 'APPROVED', 'REJECTED'
    performedBy: string; // User Name
    performedById: string; // User ID
    details?: string;
}

export interface LoanRecord {
    id: string;
    companyId?: string; // Multi-Tenancy Link
    employeeId: string;
    type: LoanType;
    amount: number; // Total Loan Amount
    emiAmount: number; // Monthly Deduction
    balance: number; // Remaining to pay
    tenureMonths: number;
    reason: string;
    issuedDate?: string;
    approverId?: string; // Manager responsible for final approval
    checkingApproverId?: string; // Intermediate Checker
    status: LoanStatus;
    ledger: LoanTransaction[]; // Passbook History
    auditTrail: AuditLog[]; // Action History

    // Advanced Features
    skippedMonths?: SkippedMonth[]; // EMI skip history
    allowedSkips?: number; // Max skips allowed (default: 2)
    settlementRequest?: SettlementRequest | null; // Early settlement request

    // Workflow tracking
    workflowApprovals?: {
        stepId: string;
        roleId: string;
        roleName: string;
        status: 'PENDING' | 'APPROVED' | 'REJECTED';
        actorName?: string;
        actedAt?: string;
    }[];
    currentWorkflowStep?: number; // 0-based index of the current awaiting step
}

// Notification System Types
export interface LoanNotification {
    id: string;
    loanId: string;
    employeeId: string;
    employeeName: string;
    employeeCode: string;
    amount: number;
    balance: number;
    emiAmount: number;
    tenureMonths: number;
    loanType: LoanType;
    reason: string;
    approverId: string;
    timestamp: string;
    isRead: boolean;
    currentSalary?: number; // Employee's current monthly salary (Net Salary)
    workedDays?: number; // Current month worked days
    perDayRate?: number; // Per day rate for salary calculation
    workInMonth?: number; // Basic Salary + Overtime only
}

// Advanced Loan Features
export interface SkippedMonth {
    id: string;
    loanId: string;
    monthYear: string; // YYYY-MM format
    reason: string;
    requestedBy: string; // Employee ID
    requestedDate: string;
    approvedBy?: string; // Admin ID
    approvedDate?: string;
    status: 'PENDING' | 'APPROVED' | 'REJECTED';
}

export interface SettlementRequest {
    id: string;
    loanId: string;
    outstandingAmount: number; // Balance before settlement
    settlementAmount: number; // Amount to be paid
    discount: number; // Waived amount
    requestedBy: string; // Employee ID
    requestDate: string;
    approvedBy?: string; // Admin ID
    approvedDate?: string;
    status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'SETTLED';
}


export interface Permission {
    id: string;
    label: string;
}

export type PayrollStatus = 'DRAFT' | 'SIMULATION' | 'FINAL_APPROVED' | 'LOCKED' | 'PAID' | 'GENERATED';

export interface SalarySlip {
    id: string;
    companyId?: string;
    employeeId: string;
    month: string; // "2024-05"

    // Days
    totalDays: number;
    presentDays: number;
    paidLeaveDays: number;
    absentDays: number;

    // Earnings
    basicSalary: number; // For Fixed
    productionAmount: number; // For Piece Rate
    overtimeAmount: number;
    allowances: number;
    grossSalary: number;

    // Deductions
    loanDeduction: number;
    advanceDeduction: number;   // ← Advance salary recovery this month
    pfDeduction: number;
    taxDeduction: number;
    otherDeduction: number;
    totalDeductions: number;

    netSalary: number; // Gross - Total Deductions
    status: PayrollStatus;
    generatedOn: string;
    generatedBy?: string; // Admin Name
}
