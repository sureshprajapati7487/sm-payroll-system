const { Sequelize, DataTypes } = require('sequelize');
const path = require('path');

// ── Database Connection ────────────────────────────────────────────────────────
// Production (Render): uses DATABASE_URL (PostgreSQL)
// Development (local): uses SQLite file
let sequelize;

if (process.env.DATABASE_URL) {
    // PostgreSQL — Render free tier
    sequelize = new Sequelize(process.env.DATABASE_URL, {
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
    createdAt: { type: DataTypes.DATE, defaultValue: Sequelize.NOW }
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
        type: DataTypes.ENUM('ACTIVE', 'INACTIVE', 'ON_LEAVE', 'SUSPENDED'),
        defaultValue: 'ACTIVE'
    },
    shift: { type: DataTypes.STRING, defaultValue: 'GENERAL' },
    salaryType: { type: DataTypes.STRING, defaultValue: 'MONTHLY' },
    basicSalary: { type: DataTypes.FLOAT, defaultValue: 0 },
    paymentRate: { type: DataTypes.FLOAT, defaultValue: 0 },
    reportsTo: { type: DataTypes.STRING },
    password: { type: DataTypes.STRING },
    whatsappNumber: { type: DataTypes.STRING },
    avatar: { type: DataTypes.STRING },
    bankDetails: { type: DataTypes.JSON },
    isLeaveBlocked: { type: DataTypes.BOOLEAN, defaultValue: false },
    leaveBalance: { type: DataTypes.JSON },
    loanLimit: { type: DataTypes.FLOAT },
    loanLimitType: { type: DataTypes.STRING },
    salaryMultiplier: { type: DataTypes.FLOAT }
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
    indexes: [{ fields: ['employeeId', 'date'] }]
});


// ── 4. Production Entry ───────────────────────────────────────────────────────
const Production = sequelize.define('Production', {
    id: { type: DataTypes.STRING, primaryKey: true },
    companyId: { type: DataTypes.STRING },
    employeeId: { type: DataTypes.STRING, allowNull: false },
    date: { type: DataTypes.STRING, allowNull: false },
    item: { type: DataTypes.STRING },
    qty: { type: DataTypes.FLOAT, defaultValue: 0 },
    rate: { type: DataTypes.FLOAT, defaultValue: 0 },
    totalAmount: { type: DataTypes.FLOAT, defaultValue: 0 },
    status: {
        type: DataTypes.ENUM('PENDING', 'APPROVED', 'REJECTED'),
        defaultValue: 'PENDING'
    },
    remarks: { type: DataTypes.STRING }
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
});

// ── 6. Loan Record ────────────────────────────────────────────────────────────
const Loan = sequelize.define('Loan', {
    id: { type: DataTypes.STRING, primaryKey: true },
    companyId: { type: DataTypes.STRING },
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
});

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
    pfDeduction: { type: DataTypes.FLOAT, defaultValue: 0 },
    taxDeduction: { type: DataTypes.FLOAT, defaultValue: 0 },
    otherDeduction: { type: DataTypes.FLOAT, defaultValue: 0 },
    totalDeductions: { type: DataTypes.FLOAT, defaultValue: 0 },
    netSalary: { type: DataTypes.FLOAT, defaultValue: 0 },
    status: {
        type: DataTypes.ENUM('GENERATED', 'PAID'),
        defaultValue: 'GENERATED'
    },
    generatedOn: { type: DataTypes.STRING },
    generatedBy: { type: DataTypes.STRING }
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
    status: {
        type: DataTypes.ENUM('PENDING', 'APPROVED', 'REJECTED', 'PAID'),
        defaultValue: 'PENDING'
    },
    auditTrail: { type: DataTypes.JSON, defaultValue: [] }
});


// ── 9. Biometric ──────────────────────────────────────────────────────────────
const Biometric = sequelize.define('Biometric', {
    employeeId: { type: DataTypes.STRING, primaryKey: true },
    faceDescriptor: { type: DataTypes.JSON, defaultValue: null },   // Float32Array as number[]
    thumbCredential: { type: DataTypes.JSON, defaultValue: null },   // { credentialId, rawId }
    registeredAt: { type: DataTypes.STRING },
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
});

// ── 11. Holiday ─────────────────────────────────────────────────────────────────
const Holiday = sequelize.define('Holiday', {
    id: { type: DataTypes.STRING, primaryKey: true },
    companyId: { type: DataTypes.STRING },
    name: { type: DataTypes.STRING, allowNull: false },
    date: { type: DataTypes.STRING, allowNull: false },   // YYYY-MM-DD
    type: { type: DataTypes.ENUM('NATIONAL', 'FESTIVAL', 'OPTIONAL'), defaultValue: 'FESTIVAL' },
    description: { type: DataTypes.STRING },
});

// ── 12. Audit Log ────────────────────────────────────────────────────────────
const AuditLog = sequelize.define('AuditLog', {
    id: { type: DataTypes.STRING, primaryKey: true },
    companyId: { type: DataTypes.STRING },
    userId: { type: DataTypes.STRING, allowNull: false },
    userName: { type: DataTypes.STRING, allowNull: false },
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

// ── Sync Database ─────────────────────────────────────────────────────────────
const initDB = async () => {
    try {
        await sequelize.sync({ alter: true }); // alter: true adds new columns without dropping data
        console.log('Database synced successfully.');
    } catch (error) {
        console.error('Database sync failed:', error);
        throw error;
    }
};

module.exports = { sequelize, Company, Employee, Attendance, Production, Leave, Loan, SalarySlip, Expense, Biometric, AdvanceSalary, Holiday, AuditLog, Client, ClientVisit, initDB };

