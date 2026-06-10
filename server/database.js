const { Sequelize, DataTypes } = require('sequelize');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// ── Database Connection ────────────────────────────────────────────────────────
// Production (Render): uses DATABASE_URL (PostgreSQL)
// Development (local): uses SQLite file
let sequelize;

const dbUrl = process.env.DATABASE_URL;
const isRenderInternal = dbUrl && dbUrl.includes('dpg-') && dbUrl.includes('.render.com');

// Only use DATABASE_URL if it's not a Render-internal one, OR if we are actually ON Render
if (dbUrl && (!isRenderInternal || process.env.RENDER)) {
    // PostgreSQL — Render free tier
    sequelize = new Sequelize(dbUrl, {
        dialect: 'postgres',
        dialectOptions: {
            ssl: {
                require: true,
                rejectUnauthorized: false  // required for Render's self-signed cert
            }
        },
        logging: false
    });
    console.log('🐘 Using PostgreSQL database');
} else {
    // SQLite — local development
    sequelize = new Sequelize({
        dialect: 'sqlite',
        storage: path.join(__dirname, 'database.sqlite'),
        logging: false
    });
    console.log('📁 Using SQLite database (local)');
}

// ── 1. Company ────────────────────────────────────────────────────────────────
const Company = sequelize.define('Company', {
    id: { type: DataTypes.STRING, primaryKey: true },
    name: { type: DataTypes.STRING, allowNull: false },
    code: { type: DataTypes.STRING, allowNull: false },
    address: { type: DataTypes.STRING },
    phone: { type: DataTypes.STRING },
    email: { type: DataTypes.STRING },
    website: { type: DataTypes.STRING },
    taxId: { type: DataTypes.STRING },
    gstNumber: { type: DataTypes.STRING },
    panNumber: { type: DataTypes.STRING },
    logo: { type: DataTypes.TEXT },
    employeeCount: { type: DataTypes.INTEGER, defaultValue: 0 },
    isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
}, { timestamps: true });

// ── 1.5 Department ────────────────────────────────────────────────────────────
const Department = sequelize.define('Department', {
    id: { type: DataTypes.STRING, primaryKey: true },
    companyId: { type: DataTypes.STRING, allowNull: false },
    name: { type: DataTypes.STRING, allowNull: false },
    description: { type: DataTypes.STRING },
    salaryBasis: { type: DataTypes.STRING },
    defaultSalaryType: { type: DataTypes.STRING },
    headCount: { type: DataTypes.INTEGER },
    costCenter: { type: DataTypes.STRING },
}, { timestamps: true });

// ── 1.6 Shift ─────────────────────────────────────────────────────────────────
const Shift = sequelize.define('Shift', {
    id: { type: DataTypes.STRING, primaryKey: true },
    companyId: { type: DataTypes.STRING, allowNull: false },
    name: { type: DataTypes.STRING, allowNull: false },
    startTime: { type: DataTypes.STRING, allowNull: false }, // "09:00"
    endTime: { type: DataTypes.STRING, allowNull: false },   // "18:00"
    graceTimeMinutes: { type: DataTypes.INTEGER, defaultValue: 15 },
}, { timestamps: true });

// ── 1.7 Work Group ────────────────────────────────────────────────────────────
const WorkGroup = sequelize.define('WorkGroup', {
    id: { type: DataTypes.STRING, primaryKey: true },
    companyId: { type: DataTypes.STRING, allowNull: false },
    name: { type: DataTypes.STRING, allowNull: false },
    department: { type: DataTypes.STRING, allowNull: false },
    color: { type: DataTypes.STRING, defaultValue: 'blue' },
    icon: { type: DataTypes.STRING }
}, { timestamps: true });

// ── 1.8 Salary Type ───────────────────────────────────────────────────────────
const SalaryType = sequelize.define('SalaryType', {
    id: { type: DataTypes.STRING, primaryKey: true },
    companyId: { type: DataTypes.STRING, allowNull: false },
    key: { type: DataTypes.STRING, allowNull: false },
    label: { type: DataTypes.STRING, allowNull: false },
    description: { type: DataTypes.STRING },
    basis: { type: DataTypes.STRING, defaultValue: 'MONTHLY' } // MONTHLY | DAILY | PER_UNIT | WEEKLY | OTHER
}, { timestamps: true });

// ── 1.9 Attendance Action ─────────────────────────────────────────────────────
const AttendanceAction = sequelize.define('AttendanceAction', {
    id: { type: DataTypes.STRING, primaryKey: true },
    companyId: { type: DataTypes.STRING, allowNull: false },
    key: { type: DataTypes.STRING, allowNull: false },
    label: { type: DataTypes.STRING, allowNull: false },
    icon: { type: DataTypes.STRING },
    color: { type: DataTypes.STRING, defaultValue: 'slate' },
    enabled: { type: DataTypes.BOOLEAN, defaultValue: true },
    isDefault: { type: DataTypes.BOOLEAN, defaultValue: false }
}, { timestamps: true });

// ── 1.10 Punch Location ────────────────────────────────────────────────────────
const PunchLocation = sequelize.define('PunchLocation', {
    id: { type: DataTypes.STRING, primaryKey: true },
    companyId: { type: DataTypes.STRING, allowNull: false },
    name: { type: DataTypes.STRING, allowNull: false },
    lat: { type: DataTypes.FLOAT, allowNull: false },
    lng: { type: DataTypes.FLOAT, allowNull: false },
    radiusMeters: { type: DataTypes.INTEGER, defaultValue: 100 },
    enabled: { type: DataTypes.BOOLEAN, defaultValue: true },
    // Wi-Fi BSSID binding: MAC addresses of allowed routers for this zone.
    // Empty array = no BSSID restriction. Only enforced on Android WebView.
    allowedBSSIDs: { type: DataTypes.JSON, defaultValue: [] }
}, { timestamps: true });

// ── 1.11 System Setting ────────────────────────────────────────────────────────
const SystemSetting = sequelize.define('SystemSetting', {
    id: { type: DataTypes.STRING, primaryKey: true },
    companyId: { type: DataTypes.STRING, allowNull: false },
    key: { type: DataTypes.STRING, allowNull: false },
    value: { type: DataTypes.TEXT } // JSON stringified payload
}, { timestamps: true });

// ── 1.12 System Key (Super Admin) ──────────────────────────────────────────
const SystemKey = sequelize.define('SystemKey', {
    id: { type: DataTypes.STRING, primaryKey: true },
    companyId: { type: DataTypes.STRING, allowNull: false },
    key: { type: DataTypes.STRING, allowNull: false },
    label: { type: DataTypes.STRING, allowNull: false },
    value: { type: DataTypes.STRING, allowNull: false },
    category: {
        type: DataTypes.ENUM('PAYROLL', 'ATTENDANCE', 'LEAVES', 'GENERAL', 'SECURITY'),
        allowNull: false
    },
    description: { type: DataTypes.STRING },
    isSecret: { type: DataTypes.BOOLEAN, defaultValue: false }
}, { timestamps: true });

// ── 1.13 Security Models (Phase 9) ──────────────────────────────────────────
const UserSession = sequelize.define('UserSession', {
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    userId: { type: DataTypes.STRING },
    loginTime: { type: DataTypes.DATE },
    lastActivity: { type: DataTypes.DATE },
    ipAddress: { type: DataTypes.STRING },
    userAgent: { type: DataTypes.STRING },
    expiresAt: { type: DataTypes.DATE },
    isActive: { type: DataTypes.BOOLEAN, defaultValue: true }
}, {
    indexes: [
        { fields: ['userId', 'isActive'] },
    ]
});

const IPRestriction = sequelize.define('IPRestriction', {
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    companyId: { type: DataTypes.STRING },   // tenant-scoped; null = applies globally (legacy)
    ipAddress: { type: DataTypes.STRING },
    description: { type: DataTypes.STRING },
    isWhitelisted: { type: DataTypes.BOOLEAN, defaultValue: true },
    createdBy: { type: DataTypes.STRING }
}, {
    indexes: [{ fields: ['companyId'] }]
});

// ── 1.14 Reporting Models ─────────────────────────────────────────────────────
const CustomReportTemplate = sequelize.define('CustomReportTemplate', {
    id: { type: DataTypes.STRING, primaryKey: true },
    companyId: { type: DataTypes.STRING, allowNull: false }, // tenant isolation
    name: { type: DataTypes.STRING, allowNull: false },
    description: { type: DataTypes.STRING },
    columns: { type: DataTypes.TEXT }, // Stored as JSON string
    filters: { type: DataTypes.TEXT }  // Stored as JSON string
}, {
    indexes: [{ fields: ['companyId'] }]
});

const StatutoryRule = sequelize.define('StatutoryRule', {
    id: { type: DataTypes.STRING, primaryKey: true },
    companyId: { type: DataTypes.STRING, allowNull: false },
    effectiveDate: { type: DataTypes.STRING, allowNull: false }, // YYYY-MM-DD
    pfRate: { type: DataTypes.FLOAT, defaultValue: 12.0 },
    pfCappedAmount: { type: DataTypes.FLOAT, defaultValue: 1800 },
    esicRate: { type: DataTypes.FLOAT, defaultValue: 0.75 },
    esicThreshold: { type: DataTypes.FLOAT, defaultValue: 21000 },
    ptSlabs: { type: DataTypes.JSON, defaultValue: [] } // e.g. [{ min: 0, max: 7500, tax: 0 }, { min: 7501, max: 10000, tax: 150 }]
});

const ScheduledReport = sequelize.define('ScheduledReport', {
    id: { type: DataTypes.STRING, primaryKey: true },
    companyId: { type: DataTypes.STRING, allowNull: false }, // tenant isolation
    name: { type: DataTypes.STRING, allowNull: false },
    reportType: { type: DataTypes.STRING }, // payslip, attendance, statutory, custom
    frequency: { type: DataTypes.STRING }, // daily, weekly, monthly
    dayOfWeek: { type: DataTypes.INTEGER },
    dayOfMonth: { type: DataTypes.INTEGER },
    recipients: { type: DataTypes.TEXT }, // Stored as JSON string array
    enabled: { type: DataTypes.BOOLEAN, defaultValue: true },
    lastRun: { type: DataTypes.DATE },
    nextRun: { type: DataTypes.DATE },
    createdBy: { type: DataTypes.STRING }
}, {
    indexes: [{ fields: ['companyId'] }]
});

const ReportJob = sequelize.define('ReportJob', {
    id: { type: DataTypes.STRING, primaryKey: true },
    companyId: { type: DataTypes.STRING, allowNull: false },
    requestedBy: { type: DataTypes.STRING }, // employee ID of requestor
    reportType: { type: DataTypes.STRING, allowNull: false },
    format: { type: DataTypes.STRING, defaultValue: 'csv' }, // csv, pdf
    status: {
        type: DataTypes.ENUM('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'),
        defaultValue: 'PENDING'
    },
    progress: { type: DataTypes.INTEGER, defaultValue: 0 },
    downloadUrl: { type: DataTypes.STRING }, // path to generated file
    error: { type: DataTypes.TEXT },
    payload: { type: DataTypes.TEXT } // JSON stringified filters/columns
});

// ── 2. Employee ───────────────────────────────────────────────────────────────
const Employee = sequelize.define('Employee', {
    id: { type: DataTypes.STRING, primaryKey: true },
    companyId: { type: DataTypes.STRING, allowNull: false },
    code: { type: DataTypes.STRING, allowNull: false },
    name: { type: DataTypes.STRING, allowNull: false },
    email: { type: DataTypes.STRING },
    phone: { type: DataTypes.STRING },
    department: { type: DataTypes.STRING },
    designation: { type: DataTypes.STRING },
    role: {
        type: DataTypes.ENUM('SUPER_ADMIN', 'ADMIN', 'ACCOUNT_ADMIN', 'MANAGER', 'EMPLOYEE'),
        defaultValue: 'EMPLOYEE'
    },
    joiningDate: { type: DataTypes.STRING },
    status: {
        type: DataTypes.ENUM('ACTIVE', 'INACTIVE', 'ON_LEAVE', 'SUSPENDED', 'PENDING'),
        defaultValue: 'ACTIVE'
    },
    shift: { type: DataTypes.STRING, defaultValue: 'GENERAL' },
    groupId: { type: DataTypes.STRING }, // maps to WorkGroup.id
    salaryType: { type: DataTypes.STRING, defaultValue: 'MONTHLY' },
    basicSalary: { type: DataTypes.FLOAT, defaultValue: 0 },
    paymentRate: { type: DataTypes.FLOAT, defaultValue: 0 },
    reportsTo: { type: DataTypes.STRING },
    password: { type: DataTypes.STRING },
    attendancePin: { type: DataTypes.STRING },
    whatsappNumber: { type: DataTypes.STRING },
    avatar: { type: DataTypes.STRING },
    bankDetails: { type: DataTypes.JSON },
    isLeaveBlocked: { type: DataTypes.BOOLEAN, defaultValue: false },
    leaveBalance: { type: DataTypes.JSON },
    loanLimit: { type: DataTypes.FLOAT },
    loanLimitType: { type: DataTypes.STRING },
    salaryMultiplier: { type: DataTypes.FLOAT },
    documents: { type: DataTypes.JSON, defaultValue: [] },
    taxRegime: {
        type: DataTypes.ENUM('OLD', 'NEW'),
        defaultValue: 'NEW',
        allowNull: false,
        comment: 'Income tax regime elected by employee — OLD (with deductions) or NEW (without deductions)'
    },
}, {
    indexes: [
        { fields: ['companyId', 'status'] },
        { fields: ['companyId', 'department'] },
    ]
});

// ── 3. Attendance ─────────────────────────────────────────────────────────────
const Attendance = sequelize.define('Attendance', {
    id: { type: DataTypes.STRING, primaryKey: true },
    companyId: { type: DataTypes.STRING },
    employeeId: { type: DataTypes.STRING, allowNull: false },
    date: { type: DataTypes.STRING, allowNull: false }, // YYYY-MM-DD
    checkIn: { type: DataTypes.STRING },                // ISO timestamp
    checkOut: { type: DataTypes.STRING },
    status: {
        type: DataTypes.ENUM('PRESENT', 'ABSENT', 'HALF_DAY', 'LATE', 'ON_LEAVE', 'HOLIDAY', 'WEEKLY_OFF', 'WORK_FROM_HOME'),
        defaultValue: 'PRESENT'
    },
    shiftId: { type: DataTypes.STRING },                // Shift assigned
    lateByMinutes: { type: DataTypes.INTEGER, defaultValue: 0 },
    overtimeHours: { type: DataTypes.FLOAT, defaultValue: 0 },
    isOverride: { type: DataTypes.BOOLEAN, defaultValue: false },

    // ── Break Time Tracking ───────────────────────────────────────────────────
    breaks: { type: DataTypes.TEXT, defaultValue: '[]' }, // JSON array of { start, end? }

    // ── Admin Manual Punch Audit ──────────────────────────────────────────────
    isManualPunch: { type: DataTypes.BOOLEAN, defaultValue: false },
    manualPunchBy: { type: DataTypes.STRING },           // Admin name
    manualPunchReason: { type: DataTypes.STRING },

    // ── Punch Metadata ────────────────────────────────────────────────────────
    punchMode: { type: DataTypes.STRING },               // 'face'|'fingerprint'|'photoUpload'|'pin'|'admin'
    punchLocationId: { type: DataTypes.STRING },         // Which GPS zone matched
    usedPinPunch: { type: DataTypes.BOOLEAN, defaultValue: false },
}, {
    indexes: [
        { fields: ['employeeId', 'date'] },
        { fields: ['companyId', 'date'] },
        { fields: ['companyId', 'employeeId'] },
    ]
});


// ── 4. Production Entry ───────────────────────────────────────────────────────
const Production = sequelize.define('Production', {
    id: { type: DataTypes.STRING, primaryKey: true },
    companyId: { type: DataTypes.STRING },
    employeeId: { type: DataTypes.STRING, allowNull: false },
    date: { type: DataTypes.STRING, allowNull: false },
    item: { type: DataTypes.STRING },
    itemId: { type: DataTypes.STRING },
    qty: { type: DataTypes.FLOAT, defaultValue: 0 },
    rate: { type: DataTypes.FLOAT, defaultValue: 0 },
    totalAmount: { type: DataTypes.FLOAT, defaultValue: 0 },
    status: {
        type: DataTypes.ENUM('PENDING', 'APPROVED', 'REJECTED'),
        defaultValue: 'PENDING'
    },
    remarks: { type: DataTypes.STRING }
}, {
    indexes: [
        { fields: ['companyId', 'date'] },
        { fields: ['employeeId', 'date'] },
    ]
});

const ProductionItem = sequelize.define('ProductionItem', {
    id: { type: DataTypes.STRING, primaryKey: true },
    companyId: { type: DataTypes.STRING },
    name: { type: DataTypes.STRING, allowNull: false },
    rate: { type: DataTypes.FLOAT, defaultValue: 0 },
    category: { type: DataTypes.STRING }
});

// ── 5. Leave Request ──────────────────────────────────────────────────────────
const Leave = sequelize.define('Leave', {
    id: { type: DataTypes.STRING, primaryKey: true },
    companyId: { type: DataTypes.STRING },
    employeeId: { type: DataTypes.STRING, allowNull: false },
    type: {
        type: DataTypes.ENUM('CASUAL', 'SICK', 'PAID', 'UNPAID'),
        defaultValue: 'CASUAL'
    },
    startDate: { type: DataTypes.STRING, allowNull: false },
    endDate: { type: DataTypes.STRING, allowNull: false },
    isHalfDay: { type: DataTypes.BOOLEAN, defaultValue: false },
    daysCount: { type: DataTypes.FLOAT },
    reason: { type: DataTypes.STRING },
    status: {
        type: DataTypes.ENUM('PENDING', 'APPROVED', 'REJECTED'),
        defaultValue: 'PENDING'
    },
    appliedOn: { type: DataTypes.STRING }
}, {
    version: true, // Optimistic Locking
    indexes: [
        { fields: ['companyId', 'employeeId'] },
        { fields: ['companyId', 'status'] },
    ]
});

// ── 6. Loan Record ────────────────────────────────────────────────────────────
const Loan = sequelize.define('Loan', {
    id: { type: DataTypes.STRING, primaryKey: true },
    companyId: { type: DataTypes.STRING, allowNull: false },
    employeeId: { type: DataTypes.STRING, allowNull: false },
    type: { type: DataTypes.STRING, defaultValue: 'OTHER' }, // LoanType enum as string
    amount: { type: DataTypes.FLOAT, defaultValue: 0 },
    emiAmount: { type: DataTypes.FLOAT, defaultValue: 0 },
    balance: { type: DataTypes.FLOAT, defaultValue: 0 },
    tenureMonths: { type: DataTypes.INTEGER, defaultValue: 0 },
    reason: { type: DataTypes.STRING },
    issuedDate: { type: DataTypes.STRING },
    approverId: { type: DataTypes.STRING },
    checkingApproverId: { type: DataTypes.STRING },
    status: {
        type: DataTypes.ENUM('REQUESTED', 'CHECKED', 'ACTIVE', 'REJECTED', 'CLOSED'),
        defaultValue: 'REQUESTED'
    },
    ledger: { type: DataTypes.JSON, defaultValue: [] },
    auditTrail: { type: DataTypes.JSON, defaultValue: [] },
    skippedMonths: { type: DataTypes.JSON, defaultValue: [] },
    allowedSkips: { type: DataTypes.INTEGER, defaultValue: 2 },
    settlementRequest: { type: DataTypes.JSON }
}, {
    indexes: [
        { fields: ['companyId', 'employeeId'] },
        { fields: ['companyId', 'status'] },
    ]
});

// ── 6.1 Loan Ledger ──────────────────────────────────────────────────────────
const LoanLedger = sequelize.define('LoanLedger', {
    id: { type: DataTypes.STRING, primaryKey: true, defaultValue: () => uuidv4() },
    loanId: { type: DataTypes.STRING, allowNull: false },
    companyId: { type: DataTypes.STRING, allowNull: false },
    employeeId: { type: DataTypes.STRING, allowNull: false },
    date: { type: DataTypes.STRING, allowNull: false },       // YYYY-MM-DD
    amount: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
    type: { type: DataTypes.STRING, defaultValue: 'EMI' },   // EMI | PREPAY | WAIVER
    remarks: { type: DataTypes.STRING },
}, { tableName: 'LoanLedgers' });

// ── 7. Salary Slip / Payroll ──────────────────────────────────────────────────
const SalarySlip = sequelize.define('SalarySlip', {
    id: { type: DataTypes.STRING, primaryKey: true },
    companyId: { type: DataTypes.STRING },
    employeeId: { type: DataTypes.STRING, allowNull: false },
    month: { type: DataTypes.STRING, allowNull: false }, // YYYY-MM
    totalDays: { type: DataTypes.INTEGER, defaultValue: 0 },
    presentDays: { type: DataTypes.INTEGER, defaultValue: 0 },
    paidLeaveDays: { type: DataTypes.FLOAT, defaultValue: 0 },
    absentDays: { type: DataTypes.INTEGER, defaultValue: 0 },
    basicSalary: { type: DataTypes.FLOAT, defaultValue: 0 },
    productionAmount: { type: DataTypes.FLOAT, defaultValue: 0 },
    overtimeAmount: { type: DataTypes.FLOAT, defaultValue: 0 },
    allowances: { type: DataTypes.FLOAT, defaultValue: 0 },
    grossSalary: { type: DataTypes.FLOAT, defaultValue: 0 },
    loanDeduction: { type: DataTypes.FLOAT, defaultValue: 0 },
    advanceDeduction: { type: DataTypes.FLOAT, defaultValue: 0 },  // ← Advance salary recovery this month
    pfDeduction: { type: DataTypes.FLOAT, defaultValue: 0 },
    taxDeduction: { type: DataTypes.FLOAT, defaultValue: 0 },
    otherDeduction: { type: DataTypes.FLOAT, defaultValue: 0 },
    totalDeductions: { type: DataTypes.FLOAT, defaultValue: 0 },
    netSalary: { type: DataTypes.FLOAT, defaultValue: 0 },
    status: {
        type: DataTypes.ENUM('DRAFT', 'SIMULATION', 'FINAL_APPROVED', 'LOCKED'),
        defaultValue: 'DRAFT'
    },
    generatedOn: { type: DataTypes.STRING },
    generatedBy: { type: DataTypes.STRING }
}, {
    indexes: [
        { fields: ['companyId', 'employeeId'] },
        { fields: ['companyId', 'month'] },
        { fields: ['employeeId', 'month'] },
    ]
});

// ── 8. Expense ────────────────────────────────────────────────────────────────
const Expense = sequelize.define('Expense', {
    id: { type: DataTypes.STRING, primaryKey: true },
    companyId: { type: DataTypes.STRING },
    date: { type: DataTypes.STRING, allowNull: false },
    category: {
        type: DataTypes.ENUM('S_ADVANCE', 'TEA', 'TRANSPORT', 'MAINTENANCE', 'OTHER'),
        defaultValue: 'OTHER'
    },
    amount: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
    description: { type: DataTypes.STRING },
    paidTo: { type: DataTypes.STRING },
    addedBy: { type: DataTypes.STRING },
    receiptUrl: { type: DataTypes.STRING }, // S3 Private key; use signed URL for access
    status: {
        type: DataTypes.ENUM('PENDING', 'APPROVED', 'REJECTED', 'PAID'),
        defaultValue: 'PENDING'
    },
    auditTrail: { type: DataTypes.JSON, defaultValue: [] }
}, {
    indexes: [
        { fields: ['companyId', 'date'] },
    ]
});


// ── 9. Biometric ──────────────────────────────────────────────────────────────
// PK is now auto-increment id (not employeeId) to allow multiple descriptors per employee
// and to support separate face + fingerprint records in the future.
const Biometric = sequelize.define('Biometric', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    employeeId: { type: DataTypes.STRING, allowNull: false },       // indexed, not PK
    faceDescriptor: { type: DataTypes.JSON, defaultValue: null },   // Float32Array as number[]
    thumbCredential: { type: DataTypes.JSON, defaultValue: null },  // { credentialId, rawId }
    registeredAt: { type: DataTypes.STRING },
}, {
    indexes: [{ fields: ['employeeId'] }]
});

// ── 10. Advance Salary ───────────────────────────────────────────────────────
const AdvanceSalary = sequelize.define('AdvanceSalary', {
    id: { type: DataTypes.STRING, primaryKey: true },
    companyId: { type: DataTypes.STRING },
    employeeId: { type: DataTypes.STRING, allowNull: false },
    employeeName: { type: DataTypes.STRING, allowNull: false },
    amount: { type: DataTypes.FLOAT, allowNull: false },
    reason: { type: DataTypes.STRING },
    requestDate: { type: DataTypes.STRING },
    status: { type: DataTypes.ENUM('pending', 'approved', 'rejected'), defaultValue: 'pending' },
    approvedBy: { type: DataTypes.STRING },
    approvedDate: { type: DataTypes.STRING },
    installments: { type: DataTypes.INTEGER, defaultValue: 3 },
    monthlyDeduction: { type: DataTypes.FLOAT, defaultValue: 0 },
    remainingBalance: { type: DataTypes.FLOAT, defaultValue: 0 },
}, {
    indexes: [
        { fields: ['companyId', 'employeeId'] },
        { fields: ['companyId', 'status'] },
    ]
});

// ── 11. Holiday ─────────────────────────────────────────────────────────────────
const Holiday = sequelize.define('Holiday', {
    id: { type: DataTypes.STRING, primaryKey: true },
    companyId: { type: DataTypes.STRING },
    name: { type: DataTypes.STRING, allowNull: false },
    date: { type: DataTypes.STRING, allowNull: false },   // YYYY-MM-DD
    type: { type: DataTypes.ENUM('NATIONAL', 'FESTIVAL', 'OPTIONAL'), defaultValue: 'FESTIVAL' },
    description: { type: DataTypes.STRING },
}, {
    indexes: [
        { fields: ['companyId', 'date'] },
    ]
});

// ── 12. Audit Log ────────────────────────────────────────────────────────────
const AuditLog = sequelize.define('AuditLog', {
    id: { type: DataTypes.STRING, primaryKey: true },
    companyId: { type: DataTypes.STRING },
    userId: { type: DataTypes.STRING, allowNull: true },
    userName: { type: DataTypes.STRING, allowNull: true },
    userRole: { type: DataTypes.STRING },
    action: { type: DataTypes.STRING, allowNull: false },   // AuditAction enum value
    entityType: { type: DataTypes.STRING },                     // EMPLOYEE | LOAN | etc.
    entityId: { type: DataTypes.STRING },
    entityName: { type: DataTypes.STRING },
    details: { type: DataTypes.JSON },
    ipAddress: { type: DataTypes.STRING },
    userAgent: { type: DataTypes.TEXT },
    previousValue: { type: DataTypes.JSON },
    newValue: { type: DataTypes.JSON },
    status: { type: DataTypes.ENUM('SUCCESS', 'FAILED'), defaultValue: 'SUCCESS' },
    errorMessage: { type: DataTypes.TEXT },
    timestamp: { type: DataTypes.STRING },                     // ISO string
}, {
    indexes: [{ fields: ['companyId', 'timestamp'] }, { fields: ['action'] }, { fields: ['userId'] }]
});

// ── 13. Client / Party ────────────────────────────────────────────────────────
const Client = sequelize.define('Client', {
    id: { type: DataTypes.STRING, primaryKey: true },
    companyId: { type: DataTypes.STRING, allowNull: false },
    name: { type: DataTypes.STRING, allowNull: false },
    code: { type: DataTypes.STRING },           // e.g. C-001
    shopName: { type: DataTypes.STRING },           // dukan ka naam
    ownerName: { type: DataTypes.STRING },
    phone: { type: DataTypes.STRING },
    phone2: { type: DataTypes.STRING },
    email: { type: DataTypes.STRING },
    address: { type: DataTypes.STRING },
    city: { type: DataTypes.STRING },
    state: { type: DataTypes.STRING },
    pincode: { type: DataTypes.STRING },
    type: { type: DataTypes.STRING, defaultValue: 'RETAIL' }, // RETAIL | WHOLESALE | DISTRIBUTOR | INSTITUTION
    category: { type: DataTypes.STRING },           // e.g. Grocery, Pharmacy, etc.
    // GPS location (set by salesman on first visit)
    latitude: { type: DataTypes.FLOAT },
    longitude: { type: DataTypes.FLOAT },
    locationSetAt: { type: DataTypes.STRING },           // ISO timestamp when location was set
    locationSetBy: { type: DataTypes.STRING },           // salesman employeeId
    // Assignment
    assignedTo: { type: DataTypes.STRING },           // salesman employeeId
    assignedToName: { type: DataTypes.STRING },
    // Stats (denormalized for fast reads)
    totalVisits: { type: DataTypes.INTEGER, defaultValue: 0 },
    lastVisitAt: { type: DataTypes.STRING },
    nextVisitDate: { type: DataTypes.STRING },
    avgVisitMins: { type: DataTypes.FLOAT, defaultValue: 0 },
    // Status
    status: { type: DataTypes.STRING, defaultValue: 'ACTIVE' }, // ACTIVE | INACTIVE | PROSPECT | BLOCKED
    notes: { type: DataTypes.TEXT },
    tags: { type: DataTypes.JSON, defaultValue: [] },
    creditLimit: { type: DataTypes.FLOAT, defaultValue: 0 },
    outstandingAmount: { type: DataTypes.FLOAT, defaultValue: 0 },
}, {
    indexes: [{ fields: ['companyId'] }, { fields: ['assignedTo'] }]
});

// ── 14. Client Visit ──────────────────────────────────────────────────────────
const ClientVisit = sequelize.define('ClientVisit', {
    id: { type: DataTypes.STRING, primaryKey: true },
    companyId: { type: DataTypes.STRING, allowNull: false },
    clientId: { type: DataTypes.STRING, allowNull: false },
    salesmanId: { type: DataTypes.STRING, allowNull: false },   // employeeId
    salesmanName: { type: DataTypes.STRING },
    // Timing
    checkInAt: { type: DataTypes.STRING, allowNull: false },   // ISO timestamp
    checkOutAt: { type: DataTypes.STRING },                     // ISO timestamp
    durationMins: { type: DataTypes.FLOAT, defaultValue: 0 },    // calculated
    // GPS at check-in (verify salesman is at client location)
    checkInLat: { type: DataTypes.FLOAT },
    checkInLng: { type: DataTypes.FLOAT },
    checkOutLat: { type: DataTypes.FLOAT },
    checkOutLng: { type: DataTypes.FLOAT },
    distanceFromClient: { type: DataTypes.FLOAT },  // metres from registered location
    // Visit details
    purpose: { type: DataTypes.STRING },  // SALES | COLLECTION | DEMO | COMPLAINT | FOLLOWUP | OTHER
    outcome: { type: DataTypes.STRING },  // ORDER_PLACED | NO_ORDER | FOLLOW_UP | etc.
    orderAmount: { type: DataTypes.FLOAT, defaultValue: 0 },
    collectionAmount: { type: DataTypes.FLOAT, defaultValue: 0 },
    notes: { type: DataTypes.TEXT },
    nextVisitDate: { type: DataTypes.STRING },
    photos: { type: DataTypes.JSON, defaultValue: [] },  // image URLs/base64
    visitNumber: { type: DataTypes.INTEGER, defaultValue: 1 }, // nth visit to this client
}, {
    indexes: [
        { fields: ['clientId'] },
        { fields: ['salesmanId'] },
        { fields: ['companyId', 'checkInAt'] }
    ]
});
// ── 15. Sales Task ─────────────────────────────────────────────────────────────
const SalesTask = sequelize.define('SalesTask', {
    id: { type: DataTypes.STRING, primaryKey: true },
    companyId: { type: DataTypes.STRING, allowNull: false },
    salesmanId: { type: DataTypes.STRING, allowNull: false },
    title: { type: DataTypes.STRING, allowNull: false },
    description: { type: DataTypes.TEXT },
    dueDate: { type: DataTypes.STRING }, // YYYY-MM-DD
    priority: { type: DataTypes.ENUM('high', 'medium', 'low'), defaultValue: 'medium' },
    status: { type: DataTypes.ENUM('todo', 'in-progress', 'done', 'canceled'), defaultValue: 'todo' },
    completedAt: { type: DataTypes.STRING },
}, {
    indexes: [{ fields: ['companyId'] }, { fields: ['salesmanId'] }]
});

// ── 16. Full & Final Settlement ───────────────────────────────────────────────
const FnFSettlement = sequelize.define('FnFSettlement', {
    id: { type: DataTypes.STRING, primaryKey: true, defaultValue: () => uuidv4() },
    companyId: { type: DataTypes.STRING, allowNull: false },
    employeeId: { type: DataTypes.STRING, allowNull: false },
    separationDate: { type: DataTypes.STRING, allowNull: false },  // YYYY-MM-DD
    reason: { type: DataTypes.STRING },  // RESIGNATION | TERMINATION | RETIREMENT | OTHER
    noticePeriodDays: { type: DataTypes.INTEGER, defaultValue: 0 },
    noticePeriodPay: { type: DataTypes.FLOAT, defaultValue: 0 },
    gratuityAmount: { type: DataTypes.FLOAT, defaultValue: 0 },
    leaveEncashment: { type: DataTypes.FLOAT, defaultValue: 0 },
    otherDeductions: { type: DataTypes.FLOAT, defaultValue: 0 },
    netAmount: { type: DataTypes.FLOAT, defaultValue: 0 },
    status: { type: DataTypes.ENUM('DRAFT', 'APPROVED'), defaultValue: 'DRAFT' },
    generatedBy: { type: DataTypes.STRING },
}, {
    indexes: [
        { fields: ['companyId', 'employeeId'] },
        { fields: ['companyId', 'status'] },
    ]
});

// ── 17. Overtime Policy ────────────────────────────────────────────────────────
const OvertimePolicy = sequelize.define('OvertimePolicy', {
    id: { type: DataTypes.STRING, primaryKey: true, defaultValue: () => uuidv4() },
    companyId: { type: DataTypes.STRING, allowNull: false },
    name: { type: DataTypes.STRING, allowNull: false },
    weeklyCapHours: { type: DataTypes.FLOAT, defaultValue: 48 },
    dailyCapHours: { type: DataTypes.FLOAT, defaultValue: 12 },
    multiplier: { type: DataTypes.FLOAT, defaultValue: 1.5 },
    effectiveFrom: { type: DataTypes.STRING },  // YYYY-MM-DD
}, {
    indexes: [{ fields: ['companyId'] }]
});

// ── Sync Database ─────────────────────────────────────────────────────────────
const initDB = async () => {
    try {
        console.log('Syncing database...');

        // ── Pre-sync Migration: Biometric table PK change ─────────────────────
        // Old schema: employeeId STRING was the PRIMARY KEY.
        // New schema: id INTEGER AUTO_INCREMENT is PK; employeeId is just an indexed column.
        // SQLite does not support ALTER TABLE ... ADD PRIMARY KEY, so we must recreate the table.
        try {
            const [biometricCols] = await sequelize.query(
                `PRAGMA table_info("Biometrics")`,
                { type: sequelize.QueryTypes ? sequelize.QueryTypes.SELECT : 'SELECT' }
            );
            const colList = Array.isArray(biometricCols) ? biometricCols : [biometricCols];
            const hasPkOnEmployeeId = colList.some(c => c.name === 'employeeId' && c.pk === 1);
            const hasNewIdCol = colList.some(c => c.name === 'id');

            if (hasPkOnEmployeeId && !hasNewIdCol) {
                console.log('🔧 Migrating Biometric table PK from employeeId → auto-increment id...');
                // 1. Backup existing data
                const existing = await sequelize.query(`SELECT * FROM "Biometrics"`, { type: 'SELECT' });
                // 2. Drop old table
                await sequelize.query(`DROP TABLE IF EXISTS "Biometrics"`);
                // 3. Recreate with new schema (sync will create it below, but we need it now for data restore)
                await sequelize.query(`
                    CREATE TABLE "Biometrics" (
                        "id" INTEGER PRIMARY KEY AUTOINCREMENT,
                        "employeeId" VARCHAR(255) NOT NULL,
                        "faceDescriptor" JSON,
                        "thumbCredential" JSON,
                        "registeredAt" VARCHAR(255),
                        "createdAt" DATETIME,
                        "updatedAt" DATETIME
                    )
                `);
                await sequelize.query(`CREATE INDEX IF NOT EXISTS "biometrics_employee_id" ON "Biometrics" ("employeeId")`);
                // 4. Restore data
                for (const row of existing) {
                    await sequelize.query(
                        `INSERT INTO "Biometrics" ("employeeId","faceDescriptor","thumbCredential","registeredAt") VALUES (?,?,?,?)`,
                        { replacements: [row.employeeId, row.faceDescriptor, row.thumbCredential, row.registeredAt] }
                    );
                }
                console.log(`✅ Biometric migration complete — ${existing.length} records restored.`);
            }
        } catch (biometricMigErr) {
            // If Biometrics table does not exist yet, skip — sync() will create it fresh
            if (!biometricMigErr.message?.includes('no such table')) {
                console.warn('⚠️  Biometric pre-migration warning:', biometricMigErr.message);
            }
        }

        // ── Post-migration Index Cleanup: SQLite fails on 'alter: true' if indexes already exist ──
        try {
            await sequelize.query('DROP INDEX IF EXISTS user_sessions_user_id_is_active');
            await sequelize.query('DROP INDEX IF EXISTS ip_restrictions_company_id');
            await sequelize.query('DROP INDEX IF EXISTS custom_report_templates_company_id');
            await sequelize.query('DROP INDEX IF EXISTS scheduled_reports_company_id');
            await sequelize.query('DROP INDEX IF EXISTS audit_logs_company_id_timestamp');
            await sequelize.query('DROP INDEX IF EXISTS audit_logs_action');
            await sequelize.query('DROP INDEX IF EXISTS audit_logs_user_id');
            await sequelize.query('DROP INDEX IF EXISTS clients_company_id');
            await sequelize.query('DROP INDEX IF EXISTS clients_assigned_to');
            await sequelize.query('DROP INDEX IF EXISTS sales_tasks_company_id');
            await sequelize.query('DROP INDEX IF EXISTS sales_tasks_salesman_id');
            await sequelize.query('DROP INDEX IF EXISTS fnf_settlements_company_id_employee_id');
            await sequelize.query('DROP INDEX IF EXISTS fnf_settlements_company_id_status');
            await sequelize.query('DROP INDEX IF EXISTS overtime_policies_company_id');
        } catch (idxDropErr) {
            console.warn('⚠️  Index preemptive drop warning (non-critical):', idxDropErr.message);
        }

        // Safe Auto-Migration: adds missing columns/tables without dropping data.
        // Wrapped in try-catch because on re-deploys, Sequelize tries to CREATE indexes
        // that already exist (no IF NOT EXISTS) — PostgreSQL throws "already exists" error.
        // If that happens, the schema is already current so we warn and continue.
        try {
            await sequelize.sync({ alter: { drop: false } });
            console.log('Database synced successfully.');
        } catch (syncErr) {
            const msg = (syncErr.message || '') + (syncErr.original?.message || '');
            if (msg.includes('already exists')) {
                console.warn('⚠️  Sync skipped duplicate index (schema is current):', syncErr.original?.message || syncErr.message);
            } else {
                // Unknown sync error — warn but don't crash the server
                console.warn('⚠️  Database sync warning (server will still start):', syncErr.message);
            }
        }

        // Seed initial admin only on Render (production) — not locally.
        // Local dev starts fresh via Company Setup page.
        const IS_RENDER = !!process.env.RENDER;
        if (IS_RENDER) {
            const bcrypt = require('bcrypt');
            const count = await Employee.count();
            if (count === 0) {
                console.log('🌱 [Render] Empty database detected. Seeding initial admin ACLLP-01...');
                const hashedPassword = await bcrypt.hash('8824834657@AA', 10);
                await Company.create({ id: 'c1', name: 'SM Payroll Default', code: 'SM' });
                await Employee.create({
                    id: 'ACLLP-01',
                    companyId: 'c1',
                    code: 'ACLLP-01',
                    name: 'Suresh Owner',
                    designation: 'Owner',
                    role: 'SUPER_ADMIN',
                    password: hashedPassword,
                    status: 'ACTIVE'
                });
                console.log('✅ Admin ACLLP-01 created with default password.');
            }
        }

        // ── Post-sync Migration: backfill companyId on ScheduledReport + CustomReportTemplate ──
        // These tables were created without companyId. Existing rows have companyId = NULL
        // which makes them invisible to company-scoped queries. Assign them to the first company.
        try {
            const firstCompany = await Company.findOne({ order: [['createdAt', 'ASC']] });
            if (firstCompany) {
                const cid = firstCompany.id;

                const nullReports = await ScheduledReport.count({ where: { companyId: null } });
                if (nullReports > 0) {
                    await ScheduledReport.update({ companyId: cid }, { where: { companyId: null } });
                    console.log(`🔧 Backfilled companyId='${cid}' on ${nullReports} ScheduledReport record(s).`);
                }

                const nullTemplates = await CustomReportTemplate.count({ where: { companyId: null } });
                if (nullTemplates > 0) {
                    await CustomReportTemplate.update({ companyId: cid }, { where: { companyId: null } });
                    console.log(`🔧 Backfilled companyId='${cid}' on ${nullTemplates} CustomReportTemplate record(s).`);
                }
            }
        } catch (backfillErr) {
            console.warn('⚠️  companyId backfill warning:', backfillErr.message);
        }

    } catch (err) {
        const msg = err.message || '';
        if (msg.includes('already exists')) {
            console.warn('⚠️  DB init skipped pre-existing index — schema is current, server starting normally.');
        } else {
            console.error('Initial DB Sync Error:', err);
        }
    }
};

module.exports = { sequelize, Company, Department, Shift, WorkGroup, SalaryType, AttendanceAction, PunchLocation, SystemSetting, SystemKey, Employee, Attendance, Production, ProductionItem, Leave, Loan, LoanLedger, SalarySlip, Expense, Biometric, AdvanceSalary, Holiday, AuditLog, Client, ClientVisit, SalesTask, UserSession, IPRestriction, CustomReportTemplate, ScheduledReport, ReportJob, StatutoryRule, FnFSettlement, OvertimePolicy, initDB };
