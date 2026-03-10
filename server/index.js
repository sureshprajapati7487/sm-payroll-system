const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { sequelize, Company, Department, Shift, WorkGroup, SalaryType, AttendanceAction, PunchLocation, SystemSetting, SystemKey, Employee, Attendance, Production, ProductionItem, Leave, Loan, Expense, SalarySlip, Biometric, AdvanceSalary, Holiday, AuditLog, Client, ClientVisit, SalesTask, UserSession, IPRestriction, CustomReportTemplate, ScheduledReport, ReportJob, StatutoryRule, initDB } = require('./database');
const { Op } = require('sequelize');
const { startBackupScheduler, doBackup, getBackupStatus, getConfig, updateConfig } = require('./backup');

const BCRYPT_ROUNDS = 10;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// ── Brute Force Protection ───────────────────────────────────────────────────
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;

const failedAttempts = new Map();

setInterval(() => {
    const now = Date.now();
    for (const [key, val] of failedAttempts.entries()) {
        if (val.lockedUntil && now > val.lockedUntil) failedAttempts.delete(key);
    }
}, 30 * 60 * 1000);

function getAttemptKey(idOrEmail) { return (idOrEmail || '').trim().toLowerCase(); }
function isLocked(key) {
    const entry = failedAttempts.get(key);
    if (!entry || !entry.lockedUntil) return false;
    if (Date.now() > entry.lockedUntil) { failedAttempts.delete(key); return false; }
    return true;
}
function lockoutRemainingSeconds(key) {
    const entry = failedAttempts.get(key);
    if (!entry || !entry.lockedUntil) return 0;
    return Math.ceil((entry.lockedUntil - Date.now()) / 1000);
}
function recordFailedAttempt(key) {
    const entry = failedAttempts.get(key) || { count: 0, lockedUntil: null };
    entry.count += 1;
    if (entry.count >= MAX_FAILED_ATTEMPTS) {
        entry.lockedUntil = Date.now() + LOCKOUT_DURATION_MS;
        console.warn(`🔒 Account locked (${MAX_FAILED_ATTEMPTS} failed attempts): ${key}`);
    }
    failedAttempts.set(key, entry);
    return entry;
}
function clearFailedAttempts(key) { failedAttempts.delete(key); }

// IP-level rate limiter
const loginRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    message: { error: 'Too many login attempts from this device.', fix: 'Please wait 15 minutes before trying again.', retryAfter: 15 * 60 },
});

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';
const SERVER_START_TIME = Date.now();

// ── JWT Config ────────────────────────────────────────────────────────────────
const DEFAULT_JWT_SECRET = 'sm-payroll-super-secret-jwt-key-2026';
const DEFAULT_REFRESH_SECRET = 'sm-payroll-refresh-secret-key-2026-v2';

const JWT_SECRET = process.env.JWT_SECRET || DEFAULT_JWT_SECRET;
const JWT_EXPIRES = process.env.JWT_EXPIRES || '15m';
const REFRESH_SECRET = process.env.REFRESH_SECRET || DEFAULT_REFRESH_SECRET;
const REFRESH_EXPIRES = '7d';

// ── Security Check: Block production with weak secrets ────────────────────────
if (IS_PRODUCTION) {
    if (!process.env.JWT_SECRET || JWT_SECRET === DEFAULT_JWT_SECRET) {
        console.error('🚨 SECURITY ERROR: JWT_SECRET is not set in environment variables!');
        console.error('   Generate one: node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'hex\'))"');
        process.exit(1);
    }
    if (!process.env.REFRESH_SECRET || REFRESH_SECRET === DEFAULT_REFRESH_SECRET) {
        console.error('🚨 SECURITY ERROR: REFRESH_SECRET is not set in environment variables!');
        process.exit(1);
    }
} else if (!process.env.JWT_SECRET) {
    console.warn('⚠️  JWT_SECRET not in .env — using insecure default (dev only). Copy server/.env.example to server/.env');
}

// ── Error Hints ───────────────────────────────────────────────────────────────
const ERROR_HINTS = {
    'SequelizeConnectionError': { why: 'Database file is locked, missing, or corrupted.', fix: 'Restart the server. If it persists, delete database.sqlite and restart.' },
    'SequelizeValidationError': { why: 'Required fields are missing or have invalid values.', fix: 'Check the request payload — ensure all required fields are present.' },
    'SequelizeUniqueConstraintError': { why: 'A record with this unique value already exists.', fix: 'Use a different code/ID, or update the existing record.' },
    'SequelizeDatabaseError': { why: 'SQL query failed — schema mismatch or missing table.', fix: 'Run "npm start" to re-sync the database schema.' },
    'ENOENT': { why: 'A required file or directory was not found.', fix: 'Check that database.sqlite exists in /server folder.' },
    'ECONNREFUSED': { why: 'The backend server is not running.', fix: 'Run "cd server && npm start".' },
    'SyntaxError': { why: 'The request body contained invalid JSON.', fix: 'Ensure the frontend sends valid JSON with Content-Type: application/json.' },
    'TypeError': { why: 'A variable or property is undefined/null.', fix: 'Check backend logs for the undefined property.' },
    'SQLITE_CONSTRAINT': { why: 'A database constraint was violated.', fix: 'Ensure all required fields are provided and avoid duplicate entries.' },
    'SQLITE_ERROR': { why: 'Generic SQLite error — table missing or query malformed.', fix: 'Restart server to sync database.' },
    'DEFAULT': { why: 'An unexpected error occurred.', fix: 'Check the error message. Restart the server and try again.' },
};
function getErrorHint(err) {
    if (!err) return ERROR_HINTS.DEFAULT;
    const name = err.name || '';
    const msg = (err.message || '').toUpperCase();
    for (const key of Object.keys(ERROR_HINTS)) {
        if (name.includes(key) || msg.includes(key)) return ERROR_HINTS[key];
    }
    return ERROR_HINTS.DEFAULT;
}

const ERROR_LOG_PATH = path.join(__dirname, 'errors.log');

// Load existing errors on startup
let errorLog = [];
try {
    if (fs.existsSync(ERROR_LOG_PATH)) {
        // Read file, split by lines, parse valid JSON, get last 100
        const content = fs.readFileSync(ERROR_LOG_PATH, 'utf-8').trim();
        if (content) {
            const lines = content.split('\n');
            errorLog = lines.map(l => {
                try { return JSON.parse(l); } catch { return null; }
            }).filter(Boolean).reverse().slice(0, 100);
        }
    }
} catch (e) {
    console.error('Failed to load error log file', e);
}

const addError = (err, endpoint = 'system') => {
    const hint = getErrorHint(typeof err === 'string' ? null : err);
    const message = typeof err === 'string' ? err : (err.message || String(err));
    const name = typeof err === 'object' ? (err.name || 'Error') : 'Error';
    const logEntry = { id: Date.now(), timestamp: new Date().toISOString(), endpoint, errorType: name, message, why: hint.why, fix: hint.fix, stack: typeof err === 'object' ? (err.stack || null) : null };

    errorLog.unshift(logEntry);
    if (errorLog.length > 100) errorLog.pop();

    try {
        fs.appendFileSync(ERROR_LOG_PATH, JSON.stringify(logEntry) + '\n');
    } catch (fsErr) {
        console.error('Failed to write to error log file', fsErr);
    }
};

// ── CORS ──────────────────────────────────────────────────────────────────────
const ALLOWED_ORIGINS = [
    'http://localhost:5173',
    'https://localhost:5173',
    'http://localhost:4173',
    'https://sm-payroll-system.vercel.app',  // production frontend
    'https://192.168.1.3:5173',              // local network dev
    process.env.FRONTEND_URL,
].filter(Boolean);

// ── Auth Middleware ───────────────────────────────────────────────────────────
const PUBLIC_PATHS = [
    { method: 'GET', path: '/api/dev/reset-admin' }, // TEMPORARY DEBUG ROUTE
    { method: 'POST', path: '/api/auth/login' },
    { method: 'POST', path: '/api/auth/dev-login' },
    { method: 'POST', path: '/api/auth/refresh' },
    { method: 'POST', path: '/api/auth/logout' },
    { method: 'GET', path: '/api/health' },
    { method: 'GET', path: '/api/status/routes' },
    { method: 'GET', path: '/api/status/errors' },
    { method: 'POST', path: '/api/status/errors/report' },
    { method: 'GET', path: '/api/companies' },
    { method: 'POST', path: '/api/companies' },
    { method: 'POST', path: '/api/employees' },
    { method: 'GET', path: '/api/clients/export' },
    { method: 'GET', path: '/api/clients/demo-export' },
];

app.get('/api/dev/reset-admin', async (req, res) => {
    try {
        const emp = await Employee.findOne({ where: { code: 'ACLLP-01' } });
        if (!emp) {
            // Force create it
            const hashed = await bcrypt.hash('8824834657@AA', 10);
            await Employee.create({
                id: 'admin-recovery',
                companyId: 'c1',
                code: 'ACLLP-01',
                name: 'Admin Recovered',
                phone: '8824834657',
                role: 'ADMIN',
                password: hashed,
                status: 'ACTIVE'
            });
            return res.json({ msg: 'Admin did not exist. Force created.', code: 'ACLLP-01', pass: '8824834657@AA' });
        }
        const hashed = await bcrypt.hash('8824834657@AA', 10);
        await emp.update({ password: hashed });
        res.json({ msg: 'Admin existed. Password forcefully reset.', code: 'ACLLP-01', pass: '8824834657@AA' });
    } catch (e) {
        res.json({ error: e.message });
    }
});

function isPublic(req) {
    return PUBLIC_PATHS.some(p => p.method === req.method && req.path.startsWith(p.path));
}
function authMiddleware(req, res, next) {
    if (isPublic(req)) return next();
    const header = req.headers['authorization'] || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : (req.query.token || null);
    if (!token) return res.status(401).json({ error: 'Unauthorized — token required', fix: 'Include Authorization: Bearer <token> header' });
    try { req.user = jwt.verify(token, JWT_SECRET); next(); }
    catch (e) { return res.status(401).json({ error: 'Invalid or expired token', fix: 'Login again to get a new token' }); }
}

app.use(cors({
    origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
        if (IS_PRODUCTION) { console.warn(`🚫 CORS blocked: ${origin}`); return callback(new Error(`CORS: origin ${origin} not allowed`)); }
        return callback(null, true);
    },
    credentials: true,
}));
app.use(bodyParser.json());
app.use(cookieParser());
app.use(authMiddleware);

// ── Company Scope Enforcement — prevents cross-tenant data bleed ──────────────
const { requireCompanyScope } = require('./rbac');
app.use((req, res, next) => {
    // Skip public routes (they have no user context yet)
    const PUBLIC_PREFIXES = ['/api/auth/', '/api/health', '/api/status/', '/api/companies', '/api/company-setup'];
    if (PUBLIC_PREFIXES.some(p => req.path.startsWith(p))) return next();
    requireCompanyScope(req, res, next);
});




// ── Initialize DB ─────────────────────────────────────────────────────────────
initDB().catch(err => addError(err, 'database:init'));

// ── HEALTH & STATUS ROUTES ────────────────────────────────────────────────────
app.get('/api/health', async (req, res) => {
    const uptimeSeconds = Math.floor((Date.now() - SERVER_START_TIME) / 1000);
    const h = Math.floor(uptimeSeconds / 3600), m = Math.floor((uptimeSeconds % 3600) / 60), s = uptimeSeconds % 60;
    let dbStatus = 'connected', dbError = null, dbWhy = null, dbFix = null;
    try { await sequelize.authenticate(); }
    catch (e) { dbStatus = 'error'; dbError = e.message; const hint = getErrorHint(e); dbWhy = hint.why; dbFix = hint.fix; addError(e, 'database:authenticate'); }
    res.json({
        server: 'online', uptime: `${h}h ${m}m ${s}s`, uptimeSeconds,
        startedAt: new Date(SERVER_START_TIME).toISOString(), checkedAt: new Date().toISOString(),
        database: { status: dbStatus, error: dbError, why: dbWhy, fix: dbFix, engine: 'SQLite', file: 'database.sqlite' },
        recentErrors: errorLog.slice(0, 20), totalErrors: errorLog.length,
    });
});
app.get('/api/status/routes', (req, res) => {
    res.json({
        routes: [
            { method: 'GET', path: '/api/health', description: 'Full health check', group: 'System' },
            { method: 'GET', path: '/api/status/routes', description: 'All registered API routes', group: 'System' },
            { method: 'GET', path: '/api/status/errors', description: 'Recent live error log', group: 'System' },
            { method: 'GET', path: '/api/companies', description: 'List all companies', group: 'Companies' },
            { method: 'POST', path: '/api/companies', description: 'Create a new company', group: 'Companies' },
            { method: 'GET', path: '/api/employees', description: 'List employees', group: 'Employees' },
            { method: 'POST', path: '/api/employees', description: 'Create employee', group: 'Employees' },
            { method: 'PUT', path: '/api/employees/:id', description: 'Update employee', group: 'Employees' },
            { method: 'DELETE', path: '/api/employees/:id', description: 'Delete employee', group: 'Employees' },
            { method: 'PATCH', path: '/api/employees/:id/change-password', description: 'Change password', group: 'Employees' },
            { method: 'GET', path: '/api/attendance', description: 'List attendance records', group: 'Attendance' },
            { method: 'POST', path: '/api/attendance', description: 'Save attendance record', group: 'Attendance' },
            { method: 'PUT', path: '/api/attendance/:id', description: 'Update attendance', group: 'Attendance' },
            { method: 'DELETE', path: '/api/attendance/:id', description: 'Delete attendance', group: 'Attendance' },
            { method: 'POST', path: '/api/attendance/:id/break', description: 'Break start/end', group: 'Attendance' },
            { method: 'POST', path: '/api/attendance/admin-punch', description: 'Admin manual punch', group: 'Attendance' },
            { method: 'GET', path: '/api/production', description: 'List production entries', group: 'Production' },
            { method: 'POST', path: '/api/production', description: 'Add production entry', group: 'Production' },
            { method: 'GET', path: '/api/leaves', description: 'List leave requests', group: 'Leaves' },
            { method: 'POST', path: '/api/leaves', description: 'Create leave request', group: 'Leaves' },
            { method: 'PUT', path: '/api/leaves/:id', description: 'Approve/reject leave', group: 'Leaves' },
            { method: 'GET', path: '/api/loans', description: 'List loans', group: 'Loans' },
            { method: 'POST', path: '/api/loans', description: 'Create loan', group: 'Loans' },
            { method: 'PUT', path: '/api/loans/:id', description: 'Update loan', group: 'Loans' },
            { method: 'GET', path: '/api/payroll', description: 'List salary slips', group: 'Payroll' },
            { method: 'POST', path: '/api/payroll', description: 'Save salary slip', group: 'Payroll' },
            { method: 'GET', path: '/api/payroll/:id', description: 'Get salary slip by ID', group: 'Payroll' },
            { method: 'PUT', path: '/api/payroll/:id', description: 'Update salary slip', group: 'Payroll' },
            { method: 'GET', path: '/api/expenses', description: 'List expenses', group: 'Expenses' },
            { method: 'POST', path: '/api/expenses', description: 'Create expense', group: 'Expenses' },
            { method: 'PATCH', path: '/api/expenses/:id', description: 'Update expense status', group: 'Expenses' },
            { method: 'DELETE', path: '/api/expenses/:id', description: 'Delete expense', group: 'Expenses' },
            { method: 'GET', path: '/api/advance-salary', description: 'List advance salary', group: 'Finance' },
            { method: 'POST', path: '/api/advance-salary', description: 'Request advance salary', group: 'Finance' },
            { method: 'GET', path: '/api/holidays', description: 'List holidays', group: 'Holidays' },
            { method: 'POST', path: '/api/holidays', description: 'Add holiday', group: 'Holidays' },
            { method: 'POST', path: '/api/holidays/bulk', description: 'Bulk import holidays', group: 'Holidays' },
            { method: 'GET', path: '/api/audit-logs', description: 'List audit logs', group: 'Admin' },
            { method: 'POST', path: '/api/audit-logs', description: 'Create audit log entry', group: 'Admin' },
            { method: 'GET', path: '/api/backup/status', description: 'Backup status', group: 'Admin' },
            { method: 'POST', path: '/api/backup/now', description: 'Trigger manual backup', group: 'Admin' },
            { method: 'GET', path: '/api/clients', description: 'List clients', group: 'Sales' },
            { method: 'POST', path: '/api/clients', description: 'Create client', group: 'Sales' },
            { method: 'GET', path: '/api/visits', description: 'List client visits', group: 'Sales' },
            { method: 'POST', path: '/api/visits/checkin', description: 'Salesman check-in at client', group: 'Sales' },
            { method: 'POST', path: '/api/auth/login', description: 'Login', group: 'Auth' },
            { method: 'POST', path: '/api/auth/refresh', description: 'Refresh access token', group: 'Auth' },
            { method: 'POST', path: '/api/auth/logout', description: 'Logout', group: 'Auth' },
        ]
    });
});
app.get('/api/status/errors', (req, res) => {
    res.json({ errors: errorLog, total: errorLog.length });
});
app.post('/api/status/errors/report', (req, res) => {
    const { name, message, stack, route } = req.body || {};
    if (message) addError({ name: name || 'FrontendError', message, stack }, route || 'FRONTEND_REACT');
    res.json({ ok: true });
});

// ── AUTH ROUTES ───────────────────────────────────────────────────────────────
app.post('/api/auth/login', loginRateLimiter, async (req, res) => {
    try {
        const { idOrEmail, password } = req.body || {};
        const ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress || req.ip;

        if (!idOrEmail || !password) return res.status(400).json({ error: 'idOrEmail and password are required' });

        // IP Whitelist Check
        const restrictions = await IPRestriction.findAll();
        if (restrictions.length > 0) {
            const whitelisted = restrictions.filter(r => r.isWhitelisted);
            if (whitelisted.length > 0) {
                const isAllowed = whitelisted.some(r => r.ipAddress === ipAddress);
                if (!isAllowed) {
                    await AuditLog.create({ id: `audit-${Date.now()}-${uuidv4().substring(0, 8)}`, timestamp: new Date().toISOString(), action: 'LOGIN_FAILED', userId: 'UNKNOWN', userName: idOrEmail || 'UNKNOWN', entityType: 'USER', entityName: idOrEmail, status: 'FAILED', ipAddress, errorMessage: 'IP not whitelisted' });
                    return res.status(403).json({ error: 'Access denied from this IP address.' });
                }
            }
        }

        const cleanId = (idOrEmail || '').trim().toUpperCase();
        const cleanEmail = (idOrEmail || '').trim().toLowerCase();
        const cleanPass = (password || '').trim();
        const attemptKey = getAttemptKey(idOrEmail);

        if (isLocked(attemptKey)) {
            const remaining = lockoutRemainingSeconds(attemptKey);
            const mins = Math.ceil(remaining / 60);
            return res.status(429).json({ error: 'Account temporarily locked due to too many failed attempts.', fix: `${mins} minute${mins !== 1 ? 's' : ''} baad try karein.`, lockedFor: remaining, retryAfter: remaining });
        }

        const employee = await Employee.findOne({ where: { [Op.or]: [{ code: cleanId }, { email: cleanEmail }] } });
        if (!employee) {
            recordFailedAttempt(attemptKey);
            await AuditLog.create({ id: `audit-${Date.now()}-${uuidv4().substring(0, 8)}`, timestamp: new Date().toISOString(), action: 'LOGIN_FAILED', userId: 'UNKNOWN', userName: idOrEmail || 'UNKNOWN', entityType: 'USER', entityName: idOrEmail, status: 'FAILED', ipAddress, errorMessage: 'Invalid employee code/email' });
            return res.status(401).json({ error: 'Invalid credentials', fix: 'Check your employee code/email and password' });
        }

        const storedPass = (employee.password || '').trim();
        let isValid = false;
        if (storedPass.startsWith('$2b$') || storedPass.startsWith('$2a$')) {
            isValid = await bcrypt.compare(cleanPass, storedPass);
        } else {
            isValid = (storedPass === cleanPass);
            if (isValid) {
                const hashed = await bcrypt.hash(cleanPass, BCRYPT_ROUNDS);
                await employee.update({ password: hashed });
                console.log(`🔐 Password auto-upgraded to bcrypt for: ${employee.code}`);
            }
        }

        if (!isValid) {
            const entry = recordFailedAttempt(attemptKey);
            await AuditLog.create({ id: `audit-${Date.now()}-${uuidv4().substring(0, 8)}`, timestamp: new Date().toISOString(), action: 'LOGIN_FAILED', userId: employee.id, userName: employee.name, userRole: employee.role, entityType: 'USER', entityName: employee.name, status: 'FAILED', ipAddress, errorMessage: 'Invalid password' });
            const rem = MAX_FAILED_ATTEMPTS - entry.count;
            if (entry.lockedUntil) return res.status(429).json({ error: 'Too many failed attempts. Account locked for 15 minutes.', fix: '15 minute baad try karein.', lockedFor: LOCKOUT_DURATION_MS / 1000, retryAfter: LOCKOUT_DURATION_MS / 1000 });
            return res.status(401).json({ error: 'Invalid credentials', fix: 'Check your password and try again', attemptsRemaining: rem > 0 ? rem : 0 });
        }

        clearFailedAttempts(attemptKey);

        // Session and Audit
        const sessionId = uuidv4();
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
        const userAgent = req.headers['user-agent'] || 'Unknown';
        await UserSession.create({ id: sessionId, userId: employee.id, loginTime: new Date().toISOString(), lastActivity: new Date().toISOString(), ipAddress, userAgent, expiresAt, isActive: true });
        await AuditLog.create({ id: uuidv4(), timestamp: new Date().toISOString(), action: 'LOGIN', userId: employee.id, userName: employee.name, userRole: employee.role, entityType: 'USER', entityName: employee.name, status: 'SUCCESS', ipAddress });

        const payload = { id: employee.id, name: employee.name, role: employee.role || 'EMPLOYEE', email: employee.email, companyId: employee.companyId, sessionId };
        const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES });
        const refreshToken = jwt.sign(payload, REFRESH_SECRET, { expiresIn: REFRESH_EXPIRES });

        res.cookie('refresh_token', refreshToken, {
            httpOnly: true,
            secure: IS_PRODUCTION,
            sameSite: IS_PRODUCTION ? 'none' : 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000,
            path: '/',
        });
        res.json({ token, user: payload, expiresIn: 15 * 60 });
    } catch (e) {
        addError(e, 'POST /api/auth/login');
        const h = getErrorHint(e);
        res.status(500).json({ error: e.message, why: h.why, fix: h.fix });
    }
});

app.get('/api/auth/verify', (req, res) => { res.json({ valid: true, user: req.user }); });

app.post('/api/auth/refresh', async (req, res) => {
    const refreshToken = req.cookies?.refresh_token;
    if (!refreshToken) return res.status(401).json({ error: 'No refresh token', fix: 'Please login again' });
    try {
        const decoded = jwt.verify(refreshToken, REFRESH_SECRET);

        if (decoded.sessionId) {
            const session = await UserSession.findOne({ where: { id: decoded.sessionId } });
            if (!session || !session.isActive) throw new Error('Session revoked or inactive');
            await session.update({ lastActivity: new Date().toISOString() });
        }

        const payload = { id: decoded.id, name: decoded.name, role: decoded.role, email: decoded.email, companyId: decoded.companyId, sessionId: decoded.sessionId };
        const newToken = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES });
        console.log(`🔄 Token refreshed for: ${decoded.id}`);
        res.json({ token: newToken, user: payload, expiresIn: 15 * 60 });
    } catch (e) {
        res.clearCookie('refresh_token', { path: '/' });
        return res.status(401).json({ error: 'Refresh token expired or invalid', fix: 'Please login again' });
    }
});

app.post('/api/auth/logout', async (req, res) => {
    const refreshToken = req.cookies?.refresh_token;
    if (refreshToken) {
        try {
            const decoded = jwt.verify(refreshToken, REFRESH_SECRET);
            if (decoded.sessionId) await UserSession.update({ isActive: false }, { where: { id: decoded.sessionId } });

            const ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress || req.ip;
            await AuditLog.create({ id: uuidv4(), timestamp: new Date().toISOString(), action: 'LOGOUT', userId: decoded.id, userName: decoded.name, userRole: decoded.role, entityType: 'USER', entityName: decoded.name, status: 'SUCCESS', ipAddress });
        } catch (e) { }
    }
    res.clearCookie('refresh_token', { path: '/' });
    res.json({ success: true, message: 'Logged out successfully' });
});

app.post('/api/auth/dev-login', (req, res) => {
    if (IS_PRODUCTION) return res.status(403).json({ error: 'Disabled in production.', fix: 'Use /api/auth/login with valid credentials.' });
    const { id, name, role, email } = req.body || {};
    if (!id || !role) return res.status(400).json({ error: 'id and role required' });
    const payload = { id, name: name || role, role, email: email || `${role.toLowerCase()}@smpayroll.com` };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES });
    res.json({ token, user: payload });
});

// ── Verify Password (logout confirmation) ─────────────────────────────────────
const LOGOUT_MASTER_PASSWORD = '882483'; // Fixed master password for logout
app.post('/api/auth/verify-password', async (req, res) => {
    try {
        const { password } = req.body || {};
        if (!password) return res.status(400).json({ valid: false, error: 'Password required' });
        const cleanPass = password.trim();
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ valid: false, error: 'Not authenticated' });

        // ✅ Master logout password — works for ALL users
        if (cleanPass === LOGOUT_MASTER_PASSWORD) return res.json({ valid: true });

        // Also allow the user's own login password
        const employee = await Employee.findOne({ where: { id: userId } });
        if (employee) {
            const storedPass = (employee.password || '').trim();
            const isValid = storedPass.startsWith('$2b$') || storedPass.startsWith('$2a$')
                ? await bcrypt.compare(cleanPass, storedPass)
                : storedPass === cleanPass;
            if (isValid) return res.json({ valid: true });
        }

        // Fallback: also allow any active SUPER_ADMIN's password
        const superAdmins = await Employee.findAll({ where: { role: 'SUPER_ADMIN', status: 'ACTIVE' } });
        for (const admin of superAdmins) {
            const storedPass = (admin.password || '').trim();
            const isValid = storedPass.startsWith('$2b$') || storedPass.startsWith('$2a$')
                ? await bcrypt.compare(cleanPass, storedPass)
                : storedPass === cleanPass;
            if (isValid) return res.json({ valid: true });
        }

        return res.status(401).json({ valid: false, error: 'Galat password — logout cancel kiya gaya' });
    } catch (e) {
        addError(e, 'POST /api/auth/verify-password');
        res.status(500).json({ valid: false, error: 'Server error' });
    }
});



// ── COMPANY ROUTES ────────────────────────────────────────────────────────────
app.get('/api/companies', async (req, res) => {
    try { res.json(await Company.findAll()); }
    catch (e) { addError(e, 'GET /api/companies'); const h = getErrorHint(e); res.status(500).json({ error: e.message, why: h.why, fix: h.fix }); }
});
app.post('/api/companies', async (req, res) => {
    try {
        const existing = await Company.findOne({ where: { id: req.body.id } });
        if (existing) { await existing.update(req.body); return res.json(existing); }
        let code = req.body.code || 'CO', newCompany;
        for (let attempt = 0; attempt < 5; attempt++) {
            try {
                newCompany = await Company.create({ ...req.body, code: attempt === 0 ? code : `${code}${attempt + 1}` });
                break;
            } catch (uniqueErr) { if (uniqueErr.name !== 'SequelizeUniqueConstraintError') throw uniqueErr; }
        }
        if (!newCompany) throw new Error('Could not create company — code conflict');

        // Auto-create Admin if provided
        if (req.body.admin) {
            const { name, loginId, email, password } = req.body.admin;
            const adminCode = loginId ? loginId.trim() : `${newCompany.code}-01`;
            const hashed = await bcrypt.hash(password, 10);

            await Employee.create({
                id: `emp-${Date.now()}-${uuidv4().substring(0, 4)}`,
                companyId: newCompany.id,
                code: adminCode,
                name: name || 'Admin',
                phone: null,
                email: email || null,
                role: 'ADMIN',
                password: hashed,
                status: 'ACTIVE',
                baseSalary: 0
            });
        }

        res.status(201).json(newCompany);
    } catch (e) { addError(e, 'POST /api/companies'); const h = getErrorHint(e); res.status(500).json({ error: e.message, why: h.why, fix: h.fix }); }
});
app.put('/api/companies/:id', async (req, res) => {
    try {
        const company = await Company.findOne({ where: { id: req.params.id } });
        if (!company) return res.status(404).json({ error: 'Company not found' });
        await company.update(req.body);
        res.json(company);
    } catch (e) { addError(e, `PUT /api/companies/${req.params.id}`); const h = getErrorHint(e); res.status(500).json({ error: e.message, why: h.why, fix: h.fix }); }
});
app.delete('/api/companies/:id', async (req, res) => {
    try {
        const company = await Company.findOne({ where: { id: req.params.id } });
        if (!company) return res.status(404).json({ error: 'Company not found' });
        await company.destroy();
        res.json({ success: true });
    } catch (e) { addError(e, `DELETE /api/companies/${req.params.id}`); const h = getErrorHint(e); res.status(500).json({ error: e.message, why: h.why, fix: h.fix }); }
});

// ── Modular Routes ─────────────────────────────────────────────────────────────
// Route logic is split into separate files for maintainability.
const employeesRoute = require('./routes/employees');
const attendanceRoute = require('./routes/attendance');
const payrollRoute = require('./routes/payroll');
const clientsRoute = require('./routes/clients');
const adminRoute = require('./routes/admin');
const financeRoute = require('./routes/finance');
const analyticsRoute = require('./routes/analytics');
const reportsRoute = require('./routes/reports');
const uploadRoute = require('./routes/upload');
const salesRoute = require('./routes/sales');
const productionRoute = require('./routes/production');

// Inject shared dependencies into each route module
const sharedModels = {
    Employee, Attendance, Production, Leave, Loan, SalarySlip,
    Expense, Biometric, AdvanceSalary, Holiday, AuditLog,
    Client, ClientVisit, SalesTask, Company, sequelize,
    Department, Shift, WorkGroup, SalaryType, AttendanceAction, PunchLocation,
    SystemSetting, SystemKey, IPRestriction, UserSession,
    addError, getErrorHint,
    doBackup, getBackupStatus, getConfig, updateConfig,
    CustomReportTemplate, ScheduledReport, StatutoryRule,
};
employeesRoute.init(sharedModels);
attendanceRoute.init(sharedModels);
payrollRoute.init(sharedModels);
clientsRoute.init(sharedModels);
adminRoute.init(sharedModels);
analyticsRoute.init(sharedModels);
reportsRoute.init(sharedModels);

const calculatorsRoutes = require('./routes/calculators.js');

// Mount routes
app.use('/api/employees', employeesRoute.router);
app.use('/api/attendance', attendanceRoute.router);
app.use('/api', payrollRoute.router);                   // /api/leaves, /api/loans, /api/payroll
app.use('/api/clients', clientsRoute.router);           // /api/clients/*
app.use('/api/visits', clientsRoute.visitsRouter);      // /api/visits/*
app.use('/api/finance', financeRoute);                  // /api/finance/advances
app.use('/api', adminRoute.router);                     // /api/biometrics, /api/expenses, etc.
app.use('/api/analytics', analyticsRoute.router);
app.use('/api/reports', reportsRoute.router);
app.use('/api/calculators', calculatorsRoutes);
app.use('/api/upload', uploadRoute);
app.use('/api/sales', salesRoute);                      // /api/sales/tasks
app.use('/api/production', productionRoute);            // /api/production/*

app.use('/api/downloads', express.static(path.join(__dirname, 'public/downloads')));

// ── BACKUP ROUTES ─────────────────────────────────────────────────────────────
app.get('/api/backup/status', (req, res) => {
    try { res.json(getBackupStatus()); }
    catch (e) { addError(e, 'GET /api/backup/status'); res.status(500).json({ error: e.message }); }
});

app.post('/api/backup/now', (req, res) => {
    try {
        const result = doBackup('manual');
        res.json(result);
    } catch (e) { addError(e, 'POST /api/backup/now'); res.status(500).json({ success: false, error: e.message }); }
});

app.get('/api/backup/config', (req, res) => {
    try { res.json(getConfig()); }
    catch (e) { addError(e, 'GET /api/backup/config'); res.status(500).json({ error: e.message }); }
});

app.patch('/api/backup/config', (req, res) => {
    try {
        const updated = updateConfig(req.body);
        res.json({ success: true, config: updated });
    } catch (e) { addError(e, 'PATCH /api/backup/config'); res.status(500).json({ success: false, error: e.message }); }
});

app.get('/api/backup/download/:filename', (req, res) => {
    try {
        const { filename } = req.params;
        // Security: only allow backup files
        if (!filename.startsWith('database_backup_') || !filename.endsWith('.sqlite')) {
            return res.status(400).json({ error: 'Invalid filename' });
        }
        const filePath = path.join(__dirname, 'backups', filename);
        if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Backup file not found' });
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Type', 'application/octet-stream');
        res.sendFile(filePath);
    } catch (e) { addError(e, 'GET /api/backup/download'); res.status(500).json({ error: e.message }); }
});

app.delete('/api/backup/:filename', (req, res) => {
    try {
        const { filename } = req.params;
        if (!filename.startsWith('database_backup_') || !filename.endsWith('.sqlite')) {
            return res.status(400).json({ error: 'Invalid filename' });
        }
        const filePath = path.join(__dirname, 'backups', filename);
        if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Backup file not found' });
        fs.unlinkSync(filePath);
        res.json({ success: true, deleted: filename });
    } catch (e) { addError(e, 'DELETE /api/backup'); res.status(500).json({ error: e.message }); }
});

// ── Catch-All 404 ─────────────────────────────────────────────────────────────
app.use((req, res) => {
    res.status(404).json({ error: `Route not found: ${req.method} ${req.path}`, why: 'This API route is not registered on the backend.', fix: 'Visit /api/status/routes for the full list of available routes.' });
});
app.use((err, req, res, _next) => {
    addError(err, `${req.method} ${req.path}`);
    const h = getErrorHint(err);
    res.status(500).json({ error: err.message, why: h.why, fix: h.fix });
});

// ── Start Server ──────────────────────────────────────────────────────────────
const HTTPS_PORT = 3443;

initDB().then(() => {
    require('./scheduler').init(sharedModels);
    require('./cronManager').initCronManager(); // Initialize background cron jobs
    app.listen(PORT, HOST, () => {
        console.log(`\n✅ SM Payroll Backend (HTTP)  → http://${HOST}:${PORT}`);
        console.log(`📊 Health:  http://localhost:${PORT}/api/health`);
        startBackupScheduler();
    });

    // ── HTTPS Server (self-signed cert) ───────────────────────────────────────────
    try {
        const https = require('https');
        const fs = require('fs');
        const { generateAndSaveCert, KEY_PATH, CERT_PATH } = require('./generate-ssl');

        let key, cert;
        if (fs.existsSync(KEY_PATH) && fs.existsSync(CERT_PATH)) {
            key = fs.readFileSync(KEY_PATH, 'utf8');
            cert = fs.readFileSync(CERT_PATH, 'utf8');
        } else {
            console.log('⚠️  No SSL certificates found. Generating new ones...');
            const generated = generateAndSaveCert();
            key = generated.key;
            cert = generated.cert;
        }
        https.createServer({ key, cert }, app).listen(HTTPS_PORT, HOST, () => {
            console.log(`🔒 SM Payroll Backend (HTTPS) → https://0.0.0.0:${HTTPS_PORT}`);
            console.log(`📡 Phone access:  https://<your-pc-ip>:${HTTPS_PORT}/api/health`);
            console.log(`📋 Routes:  https://localhost:${HTTPS_PORT}/api/status/routes\n`);
        });
    } catch (e) {
        console.warn('⚠️  HTTPS server not started:', e.message);
    }

}).catch(err => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
});
