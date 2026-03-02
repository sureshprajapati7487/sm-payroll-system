const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const { v4: uuidv4 } = require('uuid');
const { initDB, Company, Employee, Attendance, Production, Leave, Loan, SalarySlip, Expense, Biometric, AdvanceSalary, Holiday, AuditLog, Client, ClientVisit, sequelize } = require('./database');
const { Op } = require('sequelize');
const { startBackupScheduler, doBackup, getBackupStatus } = require('./backup');

const BCRYPT_ROUNDS = 10;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// ── Brute Force Protection ───────────────────────────────────────────────────
const MAX_FAILED_ATTEMPTS = 5;       // attempts before account lock
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

// In-memory store: key = lowercased id/email, value = { count, lockedUntil }
const failedAttempts = new Map();

// Clean up expired lockouts every 30 minutes so Map doesn't grow forever
setInterval(() => {
    const now = Date.now();
    for (const [key, val] of failedAttempts.entries()) {
        if (val.lockedUntil && now > val.lockedUntil) failedAttempts.delete(key);
    }
}, 30 * 60 * 1000);

function getAttemptKey(idOrEmail) {
    return (idOrEmail || '').trim().toLowerCase();
}
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
function clearFailedAttempts(key) {
    failedAttempts.delete(key);
}

// IP-level rate limiter: max 20 login requests per 15 min per IP
// (catches bots trying different accounts from same IP)
const loginRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true,  // only count failures
    message: {
        error: 'Too many login attempts from this device.',
        fix: 'Please wait 15 minutes before trying again.',
        retryAfter: 15 * 60,
    },
});

const app = express();
const PORT = 3000;
const HOST = '0.0.0.0';

const SERVER_START_TIME = Date.now();

// ── JWT Config ────────────────────────────────────────────────────────────────
const JWT_SECRET = process.env.JWT_SECRET || 'sm-payroll-super-secret-jwt-key-2026';
const JWT_EXPIRES = process.env.JWT_EXPIRES || '15m';   // short-lived access token
const REFRESH_SECRET = process.env.REFRESH_SECRET || 'sm-payroll-refresh-secret-key-2026-v2';
const REFRESH_EXPIRES = '7d';  // long-lived refresh token

// Public paths that do NOT require a token
const PUBLIC_PATHS = [
    { method: 'POST', path: '/api/auth/login' },
    { method: 'POST', path: '/api/auth/dev-login' },
    { method: 'POST', path: '/api/auth/refresh' },   // ━━ refresh is public — no access token needed
    { method: 'POST', path: '/api/auth/logout' },    // ━━ logout clears cookie
    { method: 'GET', path: '/api/health' },
    { method: 'GET', path: '/api/status/routes' },
    { method: 'GET', path: '/api/status/errors' },
    { method: 'POST', path: '/api/status/errors/report' },
    // Company setup is public — user creates company BEFORE logging in
    { method: 'GET', path: '/api/companies' },
    { method: 'POST', path: '/api/companies' },
    // First-time admin employee creation during company setup
    { method: 'POST', path: '/api/employees' },
    // Client CSV export / demo — file download, public is OK
    { method: 'GET', path: '/api/clients/export' },
    { method: 'GET', path: '/api/clients/demo-export' },
];

function isPublic(req) {
    return PUBLIC_PATHS.some(p =>
        p.method === req.method && req.path.startsWith(p.path)
    );
}

function authMiddleware(req, res, next) {
    if (isPublic(req)) return next();
    const header = req.headers['authorization'] || '';
    // Accept ?token= query param too — needed for file downloads (anchor nav can't set headers)
    const token = header.startsWith('Bearer ') ? header.slice(7) : (req.query.token || null);
    if (!token) return res.status(401).json({ error: 'Unauthorized — token required', fix: 'Include Authorization: Bearer <token> header' });
    try {
        req.user = jwt.verify(token, JWT_SECRET);
        next();
    } catch (e) {
        return res.status(401).json({ error: 'Invalid or expired token', fix: 'Login again to get a new token' });
    }
}

// ── Error Hints Dictionary ────────────────────────────────────────────────────
const ERROR_HINTS = {
    'SequelizeConnectionError': { why: 'Database file is locked, missing, or corrupted.', fix: 'Restart the server. If it persists, delete database.sqlite and restart to re-create it.' },
    'SequelizeValidationError': { why: 'Required fields are missing or have invalid values in the request body.', fix: 'Check the request payload — ensure all required fields are present and correctly typed.' },
    'SequelizeUniqueConstraintError': { why: 'A record with this unique value already exists.', fix: 'Use a different code/ID, or update the existing record instead of creating a new one.' },
    'SequelizeDatabaseError': { why: 'SQL query failed — usually due to a schema mismatch or missing table.', fix: 'Run "npm start" to re-sync the database schema.' },
    'ENOENT': { why: 'A required file or directory was not found on disk.', fix: 'Check that database.sqlite exists in /server folder.' },
    'ECONNREFUSED': { why: 'The backend server is not running or is blocked by a firewall.', fix: 'Run "cd server && npm start".' },
    'SyntaxError': { why: 'The request body contained invalid JSON.', fix: 'Ensure the frontend sends valid JSON with Content-Type: application/json.' },
    'TypeError': { why: 'A variable or property is undefined/null.', fix: 'Check backend logs for the undefined property.' },
    'SQLITE_CONSTRAINT': { why: 'A database constraint (unique, NOT NULL, foreign key) was violated.', fix: 'Ensure all required fields are provided and avoid duplicate entries.' },
    'SQLITE_ERROR': { why: 'Generic SQLite error — table may be missing or query is malformed.', fix: 'Restart server to sync database.' },
    'DEFAULT': { why: 'An unexpected error occurred during request processing.', fix: 'Check the error message for clues. Restart the server and try again.' }
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

const errorLog = [];
const addError = (err, endpoint = 'system') => {
    const hint = getErrorHint(typeof err === 'string' ? null : err);
    const message = typeof err === 'string' ? err : (err.message || String(err));
    const name = typeof err === 'object' ? (err.name || 'Error') : 'Error';
    errorLog.unshift({
        id: Date.now(),
        timestamp: new Date().toISOString(),
        endpoint,
        errorType: name,
        message,
        why: hint.why,
        fix: hint.fix,
        stack: typeof err === 'object' ? (err.stack || null) : null,
    });
    if (errorLog.length > 100) errorLog.pop();
};

// ── CORS Whitelist ────────────────────────────────────────────────────────────
const ALLOWED_ORIGINS = [
    'http://localhost:5173',
    'https://localhost:5173',
    'http://localhost:4173',  // vite preview
    // Production Vercel URL — set FRONTEND_URL env var on Render
    process.env.FRONTEND_URL,
].filter(Boolean);

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, Postman, same-server calls)
        if (!origin) return callback(null, true);
        if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
        // Log and block unknown origins in production
        if (IS_PRODUCTION) {
            console.warn(`🚫 CORS blocked: ${origin}`);
            return callback(new Error(`CORS: origin ${origin} not allowed`));
        }
        // In dev: allow all (easier local testing with different ports)
        return callback(null, true);
    },
    credentials: true,  // needed for httpOnly refresh cookie
}));
app.use(bodyParser.json());
app.use(cookieParser());         // parse refresh_token cookie
app.use(authMiddleware); // JWT protection on all routes


// ── Initialize DB ─────────────────────────────────────────────────────────────
initDB().catch(err => addError(err, 'database:init'));

// ── HEALTH & STATUS ROUTES ────────────────────────────────────────────────────
app.get('/api/health', async (req, res) => {
    const uptimeSeconds = Math.floor((Date.now() - SERVER_START_TIME) / 1000);
    const h = Math.floor(uptimeSeconds / 3600), m = Math.floor((uptimeSeconds % 3600) / 60), s = uptimeSeconds % 60;

    let dbStatus = 'connected', dbError = null, dbWhy = null, dbFix = null;
    try { await sequelize.authenticate(); }
    catch (e) {
        dbStatus = 'error'; dbError = e.message;
        const hint = getErrorHint(e); dbWhy = hint.why; dbFix = hint.fix;
        addError(e, 'database:authenticate');
    }

    const endpoints = [
        { method: 'GET', path: '/api/health', description: 'Health Check', group: 'System', status: 'ok', error: null, why: null, fix: null },
        { method: 'GET', path: '/api/status/routes', description: 'Routes List', group: 'System', status: 'ok', error: null, why: null, fix: null },
        { method: 'GET', path: '/api/status/errors', description: 'Error Log', group: 'System', status: 'ok', error: null, why: null, fix: null },
        { method: 'GET', path: '/api/companies', description: 'List Companies', group: 'Companies', status: 'unknown', error: null, why: null, fix: null },
        { method: 'POST', path: '/api/companies', description: 'Create Company', group: 'Companies', status: 'ok', error: null, why: null, fix: null },
        { method: 'GET', path: '/api/employees', description: 'List Employees', group: 'Employees', status: 'unknown', error: null, why: null, fix: null },
        { method: 'POST', path: '/api/employees', description: 'Create Employee', group: 'Employees', status: 'ok', error: null, why: null, fix: null },
        { method: 'PUT', path: '/api/employees/:id', description: 'Update Employee', group: 'Employees', status: 'ok', error: null, why: null, fix: null },
        { method: 'DELETE', path: '/api/employees/:id', description: 'Delete Employee', group: 'Employees', status: 'ok', error: null, why: null, fix: null },
        { method: 'GET', path: '/api/attendance', description: 'List Attendance', group: 'Attendance', status: 'unknown', error: null, why: null, fix: null },
        { method: 'POST', path: '/api/attendance', description: 'Save Attendance', group: 'Attendance', status: 'ok', error: null, why: null, fix: null },
        { method: 'GET', path: '/api/production', description: 'List Production', group: 'Production', status: 'unknown', error: null, why: null, fix: null },
        { method: 'POST', path: '/api/production', description: 'Add Production Entry', group: 'Production', status: 'ok', error: null, why: null, fix: null },
        { method: 'GET', path: '/api/leaves', description: 'List Leave Requests', group: 'Leaves', status: 'unknown', error: null, why: null, fix: null },
        { method: 'POST', path: '/api/leaves', description: 'Create Leave Request', group: 'Leaves', status: 'ok', error: null, why: null, fix: null },
        { method: 'GET', path: '/api/loans', description: 'List Loans', group: 'Loans', status: 'unknown', error: null, why: null, fix: null },
        { method: 'POST', path: '/api/loans', description: 'Create Loan', group: 'Loans', status: 'ok', error: null, why: null, fix: null },
        { method: 'POST', path: '/api/auth/login', description: 'Login Auth', group: 'Auth', status: 'ok', error: null, why: null, fix: null },
    ];

    // Live checks
    const liveChecks = [
        { idx: 3, fn: () => Company.findAll({ limit: 1 }) },
        { idx: 5, fn: () => Employee.findAll({ limit: 1 }) },
        { idx: 9, fn: () => Attendance.findAll({ limit: 1 }) },
        { idx: 11, fn: () => Production.findAll({ limit: 1 }) },
        { idx: 13, fn: () => Leave.findAll({ limit: 1 }) },
        { idx: 15, fn: () => Loan.findAll({ limit: 1 }) },
        { idx: 17, fn: () => Employee.count() },
    ];
    for (const { idx, fn } of liveChecks) {
        try { await fn(); endpoints[idx].status = 'ok'; }
        catch (e) {
            endpoints[idx].status = 'error'; endpoints[idx].error = e.message;
            const hint = getErrorHint(e); endpoints[idx].why = hint.why; endpoints[idx].fix = hint.fix;
        }
    }

    res.json({
        server: 'online', uptime: `${h}h ${m}m ${s}s`, uptimeSeconds,
        startedAt: new Date(SERVER_START_TIME).toISOString(),
        checkedAt: new Date().toISOString(),
        database: { status: dbStatus, error: dbError, why: dbWhy, fix: dbFix, engine: 'SQLite', file: 'database.sqlite' },
        endpoints, recentErrors: errorLog.slice(0, 20), totalErrors: errorLog.length,
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
            { method: 'GET', path: '/api/employees', description: 'List employees (by company)', group: 'Employees' },
            { method: 'POST', path: '/api/employees', description: 'Create a new employee', group: 'Employees' },
            { method: 'PUT', path: '/api/employees/:id', description: 'Update employee by ID', group: 'Employees' },
            { method: 'DELETE', path: '/api/employees/:id', description: 'Delete employee by ID', group: 'Employees' },
            { method: 'GET', path: '/api/attendance', description: 'List attendance records', group: 'Attendance' },
            { method: 'POST', path: '/api/attendance', description: 'Save attendance record', group: 'Attendance' },
            { method: 'PUT', path: '/api/attendance/:id', description: 'Update attendance record', group: 'Attendance' },
            { method: 'DELETE', path: '/api/attendance/:id', description: 'Delete attendance record', group: 'Attendance' },
            { method: 'POST', path: '/api/attendance/:id/break', description: 'Break start/end punch', group: 'Attendance' },
            { method: 'POST', path: '/api/attendance/admin-punch', description: 'Admin manual punch for any employee', group: 'Attendance' },
            { method: 'GET', path: '/api/production', description: 'List production entries', group: 'Production' },
            { method: 'POST', path: '/api/production', description: 'Add production entry', group: 'Production' },
            { method: 'PUT', path: '/api/production/:id', description: 'Update production entry', group: 'Production' },
            { method: 'DELETE', path: '/api/production/:id', description: 'Delete production entry', group: 'Production' },
            { method: 'GET', path: '/api/leaves', description: 'List leave requests', group: 'Leaves' },
            { method: 'POST', path: '/api/leaves', description: 'Create leave request', group: 'Leaves' },
            { method: 'PUT', path: '/api/leaves/:id', description: 'Update leave (approve/reject)', group: 'Leaves' },
            { method: 'GET', path: '/api/loans', description: 'List loans', group: 'Loans' },
            { method: 'POST', path: '/api/loans', description: 'Create/request loan', group: 'Loans' },
            { method: 'PUT', path: '/api/loans/:id', description: 'Update loan (approve/EMI)', group: 'Loans' },
            { method: 'GET', path: '/api/payroll', description: 'List salary slips', group: 'Payroll' },
            { method: 'POST', path: '/api/payroll', description: 'Save salary slip', group: 'Payroll' },
            { method: 'PUT', path: '/api/payroll/:id', description: 'Update salary slip status', group: 'Payroll' },
            { method: 'POST', path: '/api/auth/login', description: 'Authenticate / login user', group: 'Auth' },
        ]
    });
});

app.get('/api/status/errors', (req, res) => {
    res.json({ errors: errorLog, total: errorLog.length });
});
// Frontend can POST React crashes here so they appear in Server Status
app.post('/api/status/errors/report', (req, res) => {
    const { name, message, stack, route } = req.body || {};
    if (message) {
        const errObj = { name: name || 'FrontendError', message, stack };
        addError(errObj, route || 'FRONTEND_REACT');
    }
    res.json({ ok: true });
});

// ── AUTH ROUTES ────────────────────────────────────────────────────────────
// Apply IP-level rate limiter to login route
app.post('/api/auth/login', loginRateLimiter, async (req, res) => {
    try {
        const { idOrEmail, password } = req.body || {};
        if (!idOrEmail || !password) {
            return res.status(400).json({ error: 'idOrEmail and password are required' });
        }

        const cleanId = (idOrEmail || '').trim().toUpperCase();
        const cleanEmail = (idOrEmail || '').trim().toLowerCase();
        const cleanPass = (password || '').trim();
        const attemptKey = getAttemptKey(idOrEmail);

        // ── SECURITY: admin/admin backdoor removed ────────────────────────────
        // Do NOT add hardcoded credentials here.

        // ── SECURITY: Account lockout check ─────────────────────────────────────
        if (isLocked(attemptKey)) {
            const remaining = lockoutRemainingSeconds(attemptKey);
            const mins = Math.ceil(remaining / 60);
            return res.status(429).json({
                error: `Account temporarily locked due to too many failed attempts.`,
                fix: `${mins} minute${mins !== 1 ? 's' : ''} baad try karein.`,
                lockedFor: remaining,
                retryAfter: remaining,
            });
        }

        // Look up employee by code or email
        const employee = await Employee.findOne({
            where: {
                [Op.or]: [
                    { code: cleanId },
                    { email: cleanEmail },
                ]
            }
        });

        if (!employee) {
            // Record attempt even for unknown users (prevents enumeration via timing)
            recordFailedAttempt(attemptKey);
            return res.status(401).json({ error: 'Invalid credentials', fix: 'Check your employee code/email and password' });
        }

        // ── SECURITY: Dual-mode password check (bcrypt + plain-text migration) ──
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
            const remaining = MAX_FAILED_ATTEMPTS - entry.count;
            if (entry.lockedUntil) {
                // Just got locked
                return res.status(429).json({
                    error: `Too many failed attempts. Account locked for 15 minutes.`,
                    fix: '15 minute baad try karein.',
                    lockedFor: LOCKOUT_DURATION_MS / 1000,
                    retryAfter: LOCKOUT_DURATION_MS / 1000,
                });
            }
            return res.status(401).json({
                error: 'Invalid credentials',
                fix: 'Check your password and try again',
                attemptsRemaining: remaining > 0 ? remaining : 0,
            });
        }

        // Success — clear failed attempt counter
        clearFailedAttempts(attemptKey);

        // Issue short-lived ACCESS token
        const payload = {
            id: employee.id,
            name: employee.name,
            role: employee.role || 'EMPLOYEE',
            email: employee.email,
            companyId: employee.companyId,
        };
        const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES });

        // Issue long-lived REFRESH token in httpOnly cookie (7 days)
        const refreshToken = jwt.sign(payload, REFRESH_SECRET, { expiresIn: REFRESH_EXPIRES });
        res.cookie('refresh_token', refreshToken, {
            httpOnly: true,
            secure: false,     // set true in production behind HTTPS
            sameSite: 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
            path: '/',
        });

        res.json({ token, user: payload, expiresIn: 15 * 60 }); // expiresIn in seconds

    } catch (e) {
        addError(e, 'POST /api/auth/login');
        const h = getErrorHint(e);
        res.status(500).json({ error: e.message, why: h.why, fix: h.fix });
    }
});

// GET /api/auth/verify — check if token is still valid
app.get('/api/auth/verify', (req, res) => {
    res.json({ valid: true, user: req.user });
});

// POST /api/auth/refresh — issue new access token using httpOnly refresh cookie
app.post('/api/auth/refresh', (req, res) => {
    const refreshToken = req.cookies?.refresh_token;
    if (!refreshToken) {
        return res.status(401).json({ error: 'No refresh token', fix: 'Please login again' });
    }
    try {
        const decoded = jwt.verify(refreshToken, REFRESH_SECRET);
        // Issue new short-lived access token
        const payload = {
            id: decoded.id,
            name: decoded.name,
            role: decoded.role,
            email: decoded.email,
            companyId: decoded.companyId,
        };
        const newToken = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES });
        console.log(`🔄 Token refreshed for: ${decoded.id}`);
        res.json({ token: newToken, user: payload, expiresIn: 15 * 60 });
    } catch (e) {
        // Refresh token expired or invalid — force re-login
        res.clearCookie('refresh_token', { path: '/' });
        return res.status(401).json({ error: 'Refresh token expired or invalid', fix: 'Please login again' });
    }
});

// POST /api/auth/logout — clear refresh cookie
app.post('/api/auth/logout', (req, res) => {
    res.clearCookie('refresh_token', { path: '/' });
    res.json({ success: true, message: 'Logged out successfully' });
});

// POST /api/auth/dev-login — issue real JWT for mock role users (dev mode ONLY)
// ── SECURITY: Blocked in production ──────────────────────────────────────────
app.post('/api/auth/dev-login', (req, res) => {
    if (IS_PRODUCTION) {
        return res.status(403).json({ error: 'This endpoint is disabled in production.', fix: 'Use /api/auth/login with valid credentials.' });
    }
    const { id, name, role, email } = req.body || {};
    if (!id || !role) return res.status(400).json({ error: 'id and role required' });
    const payload = { id, name: name || role, role, email: email || `${role.toLowerCase()}@smpayroll.com` };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES });
    res.json({ token, user: payload });
});

app.get('/api/companies', async (req, res) => {
    try { res.json(await Company.findAll()); }
    catch (e) { addError(e, 'GET /api/companies'); const h = getErrorHint(e); res.status(500).json({ error: e.message, why: h.why, fix: h.fix }); }
});
app.post('/api/companies', async (req, res) => {
    try {
        // Check if company with same ID already exists (update it)
        const existing = await Company.findOne({ where: { id: req.body.id } });
        if (existing) {
            await existing.update(req.body);
            return res.json(existing);
        }

        // Handle UNIQUE constraint on code — try with suffix if taken
        let code = req.body.code || 'CO';
        let newCompany;
        for (let attempt = 0; attempt < 5; attempt++) {
            try {
                const tryCode = attempt === 0 ? code : `${code}${attempt + 1}`;
                newCompany = await Company.create({ ...req.body, code: tryCode });
                break;
            } catch (uniqueErr) {
                if (uniqueErr.name !== 'SequelizeUniqueConstraintError') throw uniqueErr;
            }
        }
        if (!newCompany) throw new Error('Could not create company — code conflict');
        res.status(201).json(newCompany);
    }
    catch (e) { addError(e, 'POST /api/companies'); const h = getErrorHint(e); res.status(500).json({ error: e.message, why: h.why, fix: h.fix }); }
});

// ── EMPLOYEE ROUTES ───────────────────────────────────────────────────────────
app.get('/api/employees', async (req, res) => {
    const { companyId } = req.query;
    try {
        const where = companyId ? { companyId } : {};
        res.json(await Employee.findAll({ where }));
    } catch (e) { addError(e, 'GET /api/employees'); const h = getErrorHint(e); res.status(500).json({ error: e.message, why: h.why, fix: h.fix }); }
});
// ── Password strength check (server-side backup to frontend) ────────────────────
function validatePasswordStrength(password) {
    if (!password) return null; // optional field — no password is OK
    if (password.startsWith('$2b$') || password.startsWith('$2a$')) return null; // already hashed
    const p = password.trim();
    if (p.length < 8) return 'Password min 8 characters hona chahiye';
    if (!/[0-9]/.test(p)) return 'Password mein at least 1 number hona chahiye';
    if (!/[a-zA-Z]/.test(p)) return 'Password mein at least 1 letter hona chahiye';
    if (/\s/.test(p)) return 'Password mein spaces nahi hone chahiye';
    return null; // valid
}

app.post('/api/employees', async (req, res) => {
    try {
        const data = { ...req.body };
        // ── Server-side password strength validation
        const pwdErr = validatePasswordStrength(data.password);
        if (pwdErr) return res.status(400).json({ error: pwdErr, fix: 'Please use a stronger password (min 8 chars, 1 number, 1 letter)' });
        // Hash password before saving if provided
        if (data.password && !data.password.startsWith('$2b$')) {
            data.password = await bcrypt.hash(data.password.trim(), BCRYPT_ROUNDS);
        }
        res.json(await Employee.create(data));
    }
    catch (e) { addError(e, 'POST /api/employees'); const h = getErrorHint(e); res.status(500).json({ error: e.message, why: h.why, fix: h.fix }); }
});
app.put('/api/employees/:id', async (req, res) => {
    try {
        const data = { ...req.body };
        // ── Server-side password strength validation (only if changing password)
        const pwdErr = validatePasswordStrength(data.password);
        if (pwdErr) return res.status(400).json({ error: pwdErr, fix: 'Please use a stronger password (min 8 chars, 1 number, 1 letter)' });
        // If password is being updated, hash it
        if (data.password && !data.password.startsWith('$2b$')) {
            data.password = await bcrypt.hash(data.password.trim(), BCRYPT_ROUNDS);
        }
        await Employee.update(data, { where: { id: req.params.id } });
        res.json({ success: true });
    }
    catch (e) { addError(e, 'PUT /api/employees/:id'); const h = getErrorHint(e); res.status(500).json({ error: e.message, why: h.why, fix: h.fix }); }
});

// PATCH /api/employees/:id/change-password — secure password change with old password verification
app.patch('/api/employees/:id/change-password', async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body || {};
        if (!currentPassword || !newPassword) {
            return res.status(400).json({ error: 'currentPassword aur newPassword dono required hain' });
        }

        // Fetch employee
        const emp = await Employee.findOne({ where: { id: req.params.id } });
        if (!emp) return res.status(404).json({ error: 'Employee not found' });

        // Verify current password
        const stored = emp.password || '';
        let currentValid = false;
        if (stored.startsWith('$2b$') || stored.startsWith('$2a$')) {
            currentValid = await bcrypt.compare(currentPassword.trim(), stored);
        } else {
            // Plain text fallback (legacy, auto-upgrades below)
            currentValid = stored.trim() === currentPassword.trim();
        }

        if (!currentValid) {
            return res.status(401).json({ error: 'Current password galat hai', fix: 'Apna current password sahi se enter karein' });
        }

        // Validate new password strength
        const pwdErr = validatePasswordStrength(newPassword);
        if (pwdErr) return res.status(400).json({ error: pwdErr, fix: 'Stronger password use karein (min 8 chars, 1 number, 1 letter)' });

        // Same as old?
        if (currentPassword.trim() === newPassword.trim()) {
            return res.status(400).json({ error: 'New password old password se alag hona chahiye' });
        }

        // Hash and save
        const hashed = await bcrypt.hash(newPassword.trim(), BCRYPT_ROUNDS);
        await Employee.update({ password: hashed }, { where: { id: req.params.id } });

        res.json({ success: true, message: 'Password successfully updated!' });
    } catch (e) {
        addError(e, 'PATCH /api/employees/:id/change-password');
        const h = getErrorHint(e);
        res.status(500).json({ error: e.message, why: h.why, fix: h.fix });
    }
});

// D: DELETE employee
app.delete('/api/employees/:id', async (req, res) => {
    try {
        const deleted = await Employee.destroy({ where: { id: req.params.id } });
        if (!deleted) return res.status(404).json({ error: 'Employee not found', why: 'No employee with this ID exists in the database.', fix: 'Refresh the employee list and try again.' });
        res.json({ success: true, message: 'Employee deleted successfully' });
    } catch (e) { addError(e, 'DELETE /api/employees/:id'); const h = getErrorHint(e); res.status(500).json({ error: e.message, why: h.why, fix: h.fix }); }
});

// ── ATTENDANCE ROUTES ─────────────────────────────────────────────────────────
app.get('/api/attendance', async (req, res) => {
    const { companyId, employeeId, date } = req.query;
    try {
        const where = {};
        if (companyId) where.companyId = companyId;
        if (employeeId) where.employeeId = employeeId;
        if (date) where.date = date;
        res.json(await Attendance.findAll({ where }));
    } catch (e) { addError(e, 'GET /api/attendance'); const h = getErrorHint(e); res.status(500).json({ error: e.message, why: h.why, fix: h.fix }); }
});
app.post('/api/attendance', async (req, res) => {
    try {
        const record = await Attendance.upsert(req.body); // upsert to avoid duplicates on same day
        res.json(record);
    } catch (e) { addError(e, 'POST /api/attendance'); const h = getErrorHint(e); res.status(500).json({ error: e.message, why: h.why, fix: h.fix }); }
});
app.put('/api/attendance/:id', async (req, res) => {
    try { await Attendance.update(req.body, { where: { id: req.params.id } }); res.json({ success: true }); }
    catch (e) { addError(e, 'PUT /api/attendance/:id'); const h = getErrorHint(e); res.status(500).json({ error: e.message, why: h.why, fix: h.fix }); }
});
app.delete('/api/attendance/:id', async (req, res) => {
    try { await Attendance.destroy({ where: { id: req.params.id } }); res.json({ success: true }); }
    catch (e) { addError(e, 'DELETE /api/attendance/:id'); const h = getErrorHint(e); res.status(500).json({ error: e.message, why: h.why, fix: h.fix }); }
});

// ── BREAK PUNCH ───────────────────────────────────────────────────────────────
// POST /api/attendance/:id/break
// Body: { action: 'start' | 'end' }
// Appends a break record to the attendance row's `breaks` JSON array
app.post('/api/attendance/:id/break', async (req, res) => {
    try {
        const { action } = req.body; // 'start' or 'end'
        if (!action || !['start', 'end'].includes(action)) {
            return res.status(400).json({ error: 'action must be "start" or "end"' });
        }

        const record = await Attendance.findOne({ where: { id: req.params.id } });
        if (!record) return res.status(404).json({ error: 'Attendance record not found' });

        // Parse existing breaks (stored as JSON string or array)
        let breaks = [];
        try {
            breaks = record.breaks
                ? (typeof record.breaks === 'string' ? JSON.parse(record.breaks) : record.breaks)
                : [];
        } catch { breaks = []; }

        const now = new Date().toISOString();

        if (action === 'start') {
            // Prevent double-start
            const active = breaks.find(b => !b.end);
            if (active) return res.status(409).json({ error: 'Break already in progress' });
            breaks.push({ start: now });
        } else {
            // End the active break
            const activeIdx = breaks.findIndex(b => !b.end);
            if (activeIdx === -1) return res.status(409).json({ error: 'No active break to end' });
            breaks[activeIdx].end = now;
        }

        await Attendance.update(
            { breaks: JSON.stringify(breaks) },
            { where: { id: req.params.id } }
        );
        res.json({ success: true, breaks });
    } catch (e) {
        addError(e, 'POST /api/attendance/:id/break');
        const h = getErrorHint(e);
        res.status(500).json({ error: e.message, why: h.why, fix: h.fix });
    }
});

// ── ADMIN MANUAL PUNCH ────────────────────────────────────────────────────────
// POST /api/attendance/admin-punch
// Body: { employeeId, type: 'checkIn'|'checkOut'|'breakStart'|'breakEnd', time, reason, adminName, shiftId? }
// Admin can punch for any employee at any time with audit trail
app.post('/api/attendance/admin-punch', async (req, res) => {
    try {
        const { employeeId, type, time, reason, adminName, shiftId } = req.body;

        if (!employeeId || !type || !time || !reason || !adminName) {
            return res.status(400).json({ error: 'employeeId, type, time, reason, adminName are required' });
        }

        const today = time.split('T')[0];

        // Find or create today's record
        let record = await Attendance.findOne({ where: { employeeId, date: today } });

        if (type === 'checkIn') {
            const payload = {
                checkIn: time,
                isManualPunch: true,
                manualPunchBy: adminName,
                manualPunchReason: reason,
                punchMode: 'admin',
            };
            if (record) {
                await Attendance.update(payload, { where: { id: record.id } });
                res.json({ success: true, id: record.id, ...payload });
            } else {
                const newRec = await Attendance.create({
                    id: `manual-${uuidv4()}`,
                    employeeId, date: today,
                    status: 'PRESENT',
                    shiftId: shiftId || null,
                    lateByMinutes: 0, overtimeHours: 0,
                    breaks: '[]',
                    ...payload,
                });
                res.json({ success: true, ...newRec.toJSON() });
            }
        } else if (type === 'checkOut' && record) {
            const checkIn = record.checkIn ? new Date(record.checkIn) : new Date(time);
            const checkOutDt = new Date(time);
            const diffH = (checkOutDt.getTime() - checkIn.getTime()) / 3600000;
            const overtimeHours = parseFloat((diffH > 9 ? diffH - 9 : 0).toFixed(2));
            const payload = {
                checkOut: time, overtimeHours,
                isManualPunch: true, manualPunchBy: adminName, manualPunchReason: reason,
            };
            await Attendance.update(payload, { where: { id: record.id } });
            res.json({ success: true, id: record.id, ...payload });
        } else if ((type === 'breakStart' || type === 'breakEnd') && record) {
            let breaks = [];
            try { breaks = record.breaks ? (typeof record.breaks === 'string' ? JSON.parse(record.breaks) : record.breaks) : []; }
            catch { breaks = []; }

            if (type === 'breakStart') {
                breaks.push({ start: time });
            } else {
                const idx = breaks.findIndex(b => !b.end);
                if (idx !== -1) breaks[idx].end = time;
            }
            await Attendance.update({ breaks: JSON.stringify(breaks) }, { where: { id: record.id } });
            res.json({ success: true, breaks });
        } else {
            res.status(400).json({ error: `Cannot perform "${type}" — no matching record found or invalid type` });
        }
    } catch (e) {
        addError(e, 'POST /api/attendance/admin-punch');
        const h = getErrorHint(e);
        res.status(500).json({ error: e.message, why: h.why, fix: h.fix });
    }
});

// ── PRODUCTION ROUTES ─────────────────────────────────────────────────────────
app.get('/api/production', async (req, res) => {
    const { companyId, employeeId } = req.query;
    try {
        const where = {};
        if (companyId) where.companyId = companyId;
        if (employeeId) where.employeeId = employeeId;
        res.json(await Production.findAll({ where }));
    } catch (e) { addError(e, 'GET /api/production'); const h = getErrorHint(e); res.status(500).json({ error: e.message, why: h.why, fix: h.fix }); }
});
app.post('/api/production', async (req, res) => {
    try { res.json(await Production.create(req.body)); }
    catch (e) { addError(e, 'POST /api/production'); const h = getErrorHint(e); res.status(500).json({ error: e.message, why: h.why, fix: h.fix }); }
});
app.put('/api/production/:id', async (req, res) => {
    try { await Production.update(req.body, { where: { id: req.params.id } }); res.json({ success: true }); }
    catch (e) { addError(e, 'PUT /api/production/:id'); const h = getErrorHint(e); res.status(500).json({ error: e.message, why: h.why, fix: h.fix }); }
});
app.delete('/api/production/:id', async (req, res) => {
    try { await Production.destroy({ where: { id: req.params.id } }); res.json({ success: true }); }
    catch (e) { addError(e, 'DELETE /api/production/:id'); const h = getErrorHint(e); res.status(500).json({ error: e.message, why: h.why, fix: h.fix }); }
});

// ── LOAN ROUTES ───────────────────────────────────────────────────────────────
app.get('/api/loans', async (req, res) => {
    const { companyId, employeeId, status } = req.query;
    try {
        const where = {};
        if (companyId) where.companyId = companyId;
        if (employeeId) where.employeeId = employeeId;
        if (status) where.status = status;
        res.json(await Loan.findAll({ where }));
    } catch (e) { addError(e, 'GET /api/loans'); const h = getErrorHint(e); res.status(500).json({ error: e.message, why: h.why, fix: h.fix }); }
});
app.post('/api/loans', async (req, res) => {
    try { res.json(await Loan.create(req.body)); }
    catch (e) { addError(e, 'POST /api/loans'); const h = getErrorHint(e); res.status(500).json({ error: e.message, why: h.why, fix: h.fix }); }
});
app.put('/api/loans/:id', async (req, res) => {
    try { await Loan.update(req.body, { where: { id: req.params.id } }); res.json({ success: true }); }
    catch (e) { addError(e, 'PUT /api/loans/:id'); const h = getErrorHint(e); res.status(500).json({ error: e.message, why: h.why, fix: h.fix }); }
});

// ── LEAVE ROUTES ──────────────────────────────────────────────────────────────
app.get('/api/leaves', async (req, res) => {
    const { companyId, employeeId, status } = req.query;
    try {
        const where = {};
        if (companyId) where.companyId = companyId;
        if (employeeId) where.employeeId = employeeId;
        if (status) where.status = status;
        res.json(await Leave.findAll({ where, order: [['appliedOn', 'DESC']] }));
    } catch (e) { addError(e, 'GET /api/leaves'); const h = getErrorHint(e); res.status(500).json({ error: e.message, why: h.why, fix: h.fix }); }
});
app.post('/api/leaves', async (req, res) => {
    try { res.json(await Leave.create(req.body)); }
    catch (e) { addError(e, 'POST /api/leaves'); const h = getErrorHint(e); res.status(500).json({ error: e.message, why: h.why, fix: h.fix }); }
});
app.put('/api/leaves/:id', async (req, res) => {
    try {
        await Leave.update(req.body, { where: { id: req.params.id } });
        const updated = await Leave.findOne({ where: { id: req.params.id } });
        res.json(updated);
    } catch (e) { addError(e, 'PUT /api/leaves/:id'); const h = getErrorHint(e); res.status(500).json({ error: e.message, why: h.why, fix: h.fix }); }
});
app.delete('/api/leaves/:id', async (req, res) => {
    try { await Leave.destroy({ where: { id: req.params.id } }); res.json({ success: true }); }
    catch (e) { addError(e, 'DELETE /api/leaves/:id'); const h = getErrorHint(e); res.status(500).json({ error: e.message, why: h.why, fix: h.fix }); }
});

// ── PAYROLL ROUTES ────────────────────────────────────────────────────────────
app.get('/api/payroll', async (req, res) => {
    const { companyId, month, employeeId } = req.query;
    try {
        const where = {};
        if (companyId) where.companyId = companyId;
        if (month) where.month = month;
        if (employeeId) where.employeeId = employeeId;
        res.json(await SalarySlip.findAll({ where }));
    } catch (e) { addError(e, 'GET /api/payroll'); const h = getErrorHint(e); res.status(500).json({ error: e.message, why: h.why, fix: h.fix }); }
});
app.post('/api/payroll', async (req, res) => {
    try { const slip = await SalarySlip.upsert(req.body); res.json(slip); }
    catch (e) { addError(e, 'POST /api/payroll'); const h = getErrorHint(e); res.status(500).json({ error: e.message, why: h.why, fix: h.fix }); }
});
app.get('/api/payroll/:id', async (req, res) => {
    try {
        const slip = await SalarySlip.findOne({ where: { id: req.params.id } });
        if (!slip) return res.status(404).json({ error: 'Salary slip not found' });
        res.json(slip);
    } catch (e) { addError(e, 'GET /api/payroll/:id'); const h = getErrorHint(e); res.status(500).json({ error: e.message, why: h.why, fix: h.fix }); }
});
app.put('/api/payroll/:id', async (req, res) => {
    try { await SalarySlip.update(req.body, { where: { id: req.params.id } }); res.json({ success: true }); }
    catch (e) { addError(e, 'PUT /api/payroll/:id'); const h = getErrorHint(e); res.status(500).json({ error: e.message, why: h.why, fix: h.fix }); }
});

// ── BIOMETRIC ROUTES ──────────────────────────────────────────────────────────

// GET /api/biometrics/:employeeId — fetch biometric record
app.get('/api/biometrics/:employeeId', async (req, res) => {
    try {
        const record = await Biometric.findByPk(req.params.employeeId);
        if (!record) return res.status(404).json({ error: 'Not found' });
        res.json(record);
    } catch (e) { addError(e, 'GET /api/biometrics/:id'); const h = getErrorHint(e); res.status(500).json({ error: e.message, why: h.why, fix: h.fix }); }
});

// POST /api/biometrics/:employeeId — upsert face descriptor and/or thumb credential
app.post('/api/biometrics/:employeeId', async (req, res) => {
    try {
        const { employeeId } = req.params;
        const { faceDescriptor, thumbCredential } = req.body;
        const [record] = await Biometric.upsert({
            employeeId,
            ...(faceDescriptor !== undefined ? { faceDescriptor } : {}),
            ...(thumbCredential !== undefined ? { thumbCredential } : {}),
            registeredAt: new Date().toISOString(),
        });
        res.json(record);
    } catch (e) { addError(e, 'POST /api/biometrics/:id'); const h = getErrorHint(e); res.status(500).json({ error: e.message, why: h.why, fix: h.fix }); }
});

// DELETE /api/biometrics/:employeeId/face — clear only face descriptor
app.delete('/api/biometrics/:employeeId/face', async (req, res) => {
    try {
        const record = await Biometric.findByPk(req.params.employeeId);
        if (record) await record.update({ faceDescriptor: null });
        res.json({ success: true });
    } catch (e) { addError(e, 'DELETE /api/biometrics/:id/face'); const h = getErrorHint(e); res.status(500).json({ error: e.message, why: h.why, fix: h.fix }); }
});

// DELETE /api/biometrics/:employeeId/thumb — clear only thumb credential
app.delete('/api/biometrics/:employeeId/thumb', async (req, res) => {
    try {
        const record = await Biometric.findByPk(req.params.employeeId);
        if (record) await record.update({ thumbCredential: null });
        res.json({ success: true });
    } catch (e) { addError(e, 'DELETE /api/biometrics/:id/thumb'); const h = getErrorHint(e); res.status(500).json({ error: e.message, why: h.why, fix: h.fix }); }
});

// DELETE /api/biometrics/:employeeId — clear everything
app.delete('/api/biometrics/:employeeId', async (req, res) => {
    try {
        await Biometric.destroy({ where: { employeeId: req.params.employeeId } });
        res.json({ success: true });
    } catch (e) { addError(e, 'DELETE /api/biometrics/:id'); const h = getErrorHint(e); res.status(500).json({ error: e.message, why: h.why, fix: h.fix }); }
});

// ── EXPENSE ROUTES ────────────────────────────────────────────────────────────

// GET /api/expenses — list expenses (optional ?companyId=&month=)
app.get('/api/expenses', async (req, res) => {
    try {
        const { companyId, month } = req.query;
        const where = {};
        if (companyId) where.companyId = companyId;
        if (month) where.date = { [Op.like]: `${month}%` };
        const expenses = await Expense.findAll({ where, order: [['date', 'DESC']] });
        res.json(expenses);
    } catch (e) { addError(e, 'GET /api/expenses'); const h = getErrorHint(e); res.status(500).json({ error: e.message, why: h.why, fix: h.fix }); }
});

// POST /api/expenses — create new expense
app.post('/api/expenses', async (req, res) => {
    try {
        const { id, companyId, date, category, amount, description, paidTo, addedBy } = req.body;
        if (!date || !amount) return res.status(400).json({ error: 'date and amount are required' });
        const expense = await Expense.create({
            id: id || `exp_${Date.now()}`,
            companyId, date, category: category || 'OTHER',
            amount, description, paidTo, addedBy,
            status: 'PENDING',
            auditTrail: [{ id: Date.now().toString(), date: new Date().toISOString(), action: 'CREATED', performedBy: addedBy || 'system' }]
        });
        res.status(201).json(expense);
    } catch (e) { addError(e, 'POST /api/expenses'); const h = getErrorHint(e); res.status(500).json({ error: e.message, why: h.why, fix: h.fix }); }
});

// PATCH /api/expenses/:id — update status (APPROVED / REJECTED / PAID)
app.patch('/api/expenses/:id', async (req, res) => {
    try {
        const expense = await Expense.findByPk(req.params.id);
        if (!expense) return res.status(404).json({ error: 'Expense not found' });

        const { status, performedBy, remarks } = req.body;
        const trail = Array.isArray(expense.auditTrail) ? [...expense.auditTrail] : [];
        trail.push({ id: Date.now().toString(), date: new Date().toISOString(), action: status, performedBy: performedBy || 'system', details: remarks });

        await expense.update({ status, auditTrail: trail });
        res.json(expense);
    } catch (e) { addError(e, `PATCH /api/expenses/${req.params.id}`); const h = getErrorHint(e); res.status(500).json({ error: e.message, why: h.why, fix: h.fix }); }
});

// DELETE /api/expenses/:id
app.delete('/api/expenses/:id', async (req, res) => {
    try {
        const expense = await Expense.findByPk(req.params.id);
        if (!expense) return res.status(404).json({ error: 'Expense not found' });
        await expense.destroy();
        res.json({ success: true });
    } catch (e) { addError(e, `DELETE /api/expenses/${req.params.id}`); const h = getErrorHint(e); res.status(500).json({ error: e.message, why: h.why, fix: h.fix }); }
});


// ── ADVANCE SALARY ROUTES ─────────────────────────────────────────────────────────────
// GET /api/advance-salary — list all (filter by companyId, employeeId, status)
app.get('/api/advance-salary', async (req, res) => {
    try {
        const where = {};
        if (req.query.companyId) where.companyId = req.query.companyId;
        if (req.query.employeeId) where.employeeId = req.query.employeeId;
        if (req.query.status) where.status = req.query.status;
        const rows = await AdvanceSalary.findAll({ where, order: [['requestDate', 'DESC']] });
        res.json(rows);
    } catch (e) { addError(e, 'GET /api/advance-salary'); res.status(500).json({ error: e.message }); }
});

// POST /api/advance-salary — create new request
app.post('/api/advance-salary', async (req, res) => {
    try {
        const { id, employeeId, employeeName, companyId, amount, reason, installments } = req.body;
        if (!employeeId || !amount) return res.status(400).json({ error: 'employeeId and amount required' });
        const monthlyDeduction = Math.round(amount / (installments || 3));
        const record = await AdvanceSalary.create({
            id: id || `adv-${Date.now()}`,
            companyId, employeeId, employeeName,
            amount, reason, installments: installments || 3, monthlyDeduction,
            remainingBalance: amount,
            requestDate: new Date().toISOString(),
            status: 'pending',
        });
        res.status(201).json(record);
    } catch (e) { addError(e, 'POST /api/advance-salary'); res.status(500).json({ error: e.message }); }
});

// PATCH /api/advance-salary/:id/status — approve or reject
app.patch('/api/advance-salary/:id/status', async (req, res) => {
    try {
        const record = await AdvanceSalary.findByPk(req.params.id);
        if (!record) return res.status(404).json({ error: 'Request not found' });
        const { status, approvedBy } = req.body;
        if (!['approved', 'rejected'].includes(status)) return res.status(400).json({ error: 'status must be approved or rejected' });
        await record.update({
            status,
            approvedBy: approvedBy || 'Admin',
            approvedDate: new Date().toISOString(),
            // If rejecting, zero out balance so it won't deduct from payroll
            remainingBalance: status === 'rejected' ? 0 : record.remainingBalance,
        });
        res.json(record);
    } catch (e) { addError(e, `PATCH /api/advance-salary/${req.params.id}/status`); res.status(500).json({ error: e.message }); }
});

// PATCH /api/advance-salary/:id/deduct — reduce remainingBalance by monthlyDeduction (called on payroll markAsPaid)
app.patch('/api/advance-salary/:id/deduct', async (req, res) => {
    try {
        const record = await AdvanceSalary.findByPk(req.params.id);
        if (!record) return res.status(404).json({ error: 'Request not found' });
        const deduction = Math.min(record.monthlyDeduction, record.remainingBalance);
        const newBalance = Math.max(0, record.remainingBalance - deduction);
        await record.update({ remainingBalance: newBalance });
        res.json({ success: true, deducted: deduction, remainingBalance: newBalance });
    } catch (e) { addError(e, `PATCH /api/advance-salary/${req.params.id}/deduct`); res.status(500).json({ error: e.message }); }
});

// DELETE /api/advance-salary/:id
app.delete('/api/advance-salary/:id', async (req, res) => {
    try {
        const record = await AdvanceSalary.findByPk(req.params.id);
        if (!record) return res.status(404).json({ error: 'Request not found' });
        await record.destroy();
        res.json({ success: true });
    } catch (e) { addError(e, `DELETE /api/advance-salary/${req.params.id}`); res.status(500).json({ error: e.message }); }
});

// ── HOLIDAY ROUTES ────────────────────────────────────────────────────────────
// GET /api/holidays?companyId=&year=
app.get('/api/holidays', async (req, res) => {
    try {
        const where = {};
        if (req.query.companyId) where.companyId = req.query.companyId;
        if (req.query.year) where.date = { [Op.like]: `${req.query.year}%` };
        const rows = await Holiday.findAll({ where, order: [['date', 'ASC']] });
        res.json(rows);
    } catch (e) { addError(e, 'GET /api/holidays'); res.status(500).json({ error: e.message }); }
});

// POST /api/holidays
app.post('/api/holidays', async (req, res) => {
    try {
        const { id, name, date, type, description, companyId } = req.body;
        if (!name || !date) return res.status(400).json({ error: 'name and date required' });
        const record = await Holiday.create({
            id: id || `hol-${Date.now()}`,
            name, date, type: type || 'FESTIVAL', description, companyId
        });
        res.status(201).json(record);
    } catch (e) { addError(e, 'POST /api/holidays'); res.status(500).json({ error: e.message }); }
});

// POST /api/holidays/bulk — import many at once
app.post('/api/holidays/bulk', async (req, res) => {
    try {
        const { holidays, companyId } = req.body;
        if (!Array.isArray(holidays)) return res.status(400).json({ error: 'holidays array required' });
        await Promise.all(
            holidays.map(h => Holiday.upsert({
                id: h.id || `hol-${h.date}-${Date.now()}`,
                name: h.name, date: h.date, type: h.type || 'FESTIVAL',
                description: h.description, companyId
            }))
        );
        res.status(201).json({ inserted: holidays.length });
    } catch (e) { addError(e, 'POST /api/holidays/bulk'); res.status(500).json({ error: e.message }); }
});

// PUT /api/holidays/:id
app.put('/api/holidays/:id', async (req, res) => {
    try {
        const record = await Holiday.findByPk(req.params.id);
        if (!record) return res.status(404).json({ error: 'Holiday not found' });
        await record.update(req.body);
        res.json(record);
    } catch (e) { addError(e, `PUT /api/holidays/${req.params.id}`); res.status(500).json({ error: e.message }); }
});

// DELETE /api/holidays/:id
app.delete('/api/holidays/:id', async (req, res) => {
    try {
        const record = await Holiday.findByPk(req.params.id);
        if (!record) return res.status(404).json({ error: 'Holiday not found' });
        await record.destroy();
        res.json({ success: true });
    } catch (e) { addError(e, `DELETE /api/holidays/${req.params.id}`); res.status(500).json({ error: e.message }); }
});

// ── WHATSAPP ROUTES ───────────────────────────────────────────────────────────
const fs = require('fs');
const path = require('path');
const WA_CONFIG_FILE = path.join(__dirname, 'whatsapp_config.json');

function loadWAConfig() {
    try { return JSON.parse(fs.readFileSync(WA_CONFIG_FILE, 'utf-8')); }
    catch { return { enabled: false, phoneNumberId: '', wabaToken: '', businessName: '' }; }
}
function saveWAConfig(cfg) {
    fs.writeFileSync(WA_CONFIG_FILE, JSON.stringify(cfg, null, 2));
}

// GET /api/whatsapp/config — return config (token masked)
app.get('/api/whatsapp/config', (req, res) => {
    const cfg = loadWAConfig();
    res.json({ ...cfg, wabaToken: cfg.wabaToken ? '••••••••' : '' }); // mask token
});

// PATCH /api/whatsapp/config — save config
app.patch('/api/whatsapp/config', (req, res) => {
    const existing = loadWAConfig();
    const { enabled, phoneNumberId, wabaToken, businessName } = req.body;
    const updated = {
        enabled: enabled ?? existing.enabled,
        phoneNumberId: phoneNumberId ?? existing.phoneNumberId,
        wabaToken: wabaToken && wabaToken !== '••••••••' ? wabaToken : existing.wabaToken,
        businessName: businessName ?? existing.businessName,
    };
    saveWAConfig(updated);
    res.json({ success: true, message: 'WhatsApp config saved.' });
});

// POST /api/whatsapp/send — proxy to Meta Cloud API
app.post('/api/whatsapp/send', async (req, res) => {
    const cfg = loadWAConfig();
    if (!cfg.enabled) return res.status(403).json({ error: 'WhatsApp notifications are disabled. Enable in Settings.' });
    if (!cfg.phoneNumberId || !cfg.wabaToken) return res.status(400).json({ error: 'WhatsApp not configured. Set Phone Number ID and Token in Settings.' });

    const { to, type, text, template } = req.body;
    if (!to) return res.status(400).json({ error: '"to" phone number is required' });

    const body = { messaging_product: 'whatsapp', recipient_type: 'individual', to };
    if (type === 'text') {
        body.type = 'text';
        body.text = { preview_url: false, body: text };
    } else if (type === 'template') {
        body.type = 'template';
        body.template = template;
    } else {
        return res.status(400).json({ error: 'type must be "text" or "template"' });
    }

    try {
        const metaRes = await fetch(
            `https://graph.facebook.com/v19.0/${cfg.phoneNumberId}/messages`,
            {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${cfg.wabaToken}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            }
        );
        const data = await metaRes.json();
        if (!metaRes.ok) {
            addError(new Error(data?.error?.message || 'Meta API error'), 'POST /api/whatsapp/send');
            return res.status(metaRes.status).json({ error: data?.error?.message || 'Meta API error', details: data });
        }
        res.json({ success: true, messageId: data?.messages?.[0]?.id });
    } catch (e) {
        addError(e, 'POST /api/whatsapp/send');
        const h = getErrorHint(e);
        res.status(500).json({ error: e.message, why: h.why, fix: h.fix });
    }
});

// POST /api/whatsapp/test — send a test message to verify config
app.post('/api/whatsapp/test', async (req, res) => {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ error: 'phone is required' });
    // Re-use send route logic
    req.body = { to: phone, type: 'text', text: '✅ SM PAYROLL — WhatsApp integration is working correctly! This is a test message.' };
    // Forward to send handler by calling directly
    const cfg = loadWAConfig();
    if (!cfg.enabled || !cfg.phoneNumberId || !cfg.wabaToken)
        return res.status(400).json({ error: 'WhatsApp not enabled/configured.' });
    try {
        const metaRes = await fetch(`https://graph.facebook.com/v19.0/${cfg.phoneNumberId}/messages`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${cfg.wabaToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ messaging_product: 'whatsapp', recipient_type: 'individual', to: req.body.to, type: 'text', text: { preview_url: false, body: req.body.text } }),
        });
        const data = await metaRes.json();
        if (!metaRes.ok) return res.status(metaRes.status).json({ error: data?.error?.message, details: data });
        res.json({ success: true, message: `Test message sent to ${phone}`, messageId: data?.messages?.[0]?.id });
    } catch (e) { res.status(500).json({ error: e.message }); }
});


// ── AUDIT LOG ROUTES ──────────────────────────────────────────────────────────

// GET /api/audit-logs — list with filters & pagination
app.get('/api/audit-logs', async (req, res) => {
    try {
        const { companyId, action, userId, entityType, status, startDate, endDate, page = 1, limit = 100 } = req.query;
        const where = {};
        if (companyId) where.companyId = companyId;
        if (action) where.action = action;
        if (userId) where.userId = userId;
        if (entityType) where.entityType = entityType;
        if (status) where.status = status;
        if (startDate || endDate) {
            where.timestamp = {};
            if (startDate) where.timestamp[Op.gte] = startDate;
            if (endDate) where.timestamp[Op.lte] = endDate + 'T23:59:59.999Z';
        }
        const offset = (Number(page) - 1) * Number(limit);
        const { count, rows } = await AuditLog.findAndCountAll({
            where, order: [['timestamp', 'DESC']], limit: Number(limit), offset
        });
        res.json({ total: count, page: Number(page), limit: Number(limit), logs: rows });
    } catch (e) {
        addError(e, 'GET /api/audit-logs');
        res.status(500).json({ error: e.message });
    }
});

// POST /api/audit-logs — create a log entry
app.post('/api/audit-logs', async (req, res) => {
    try {
        const log = req.body;
        if (!log.userId || !log.userName || !log.action) {
            return res.status(400).json({ error: 'userId, userName, action are required' });
        }
        const created = await AuditLog.create({
            ...log,
            id: log.id || `audit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            timestamp: log.timestamp || new Date().toISOString(),
        });
        res.status(201).json(created);
    } catch (e) {
        addError(e, 'POST /api/audit-logs');
        res.status(500).json({ error: e.message });
    }
});

// DELETE /api/audit-logs/clear?days=30 — delete logs older than N days
app.delete('/api/audit-logs/clear', async (req, res) => {
    try {
        const days = Number(req.query.days) || 90;
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - days);
        const cutoffISO = cutoff.toISOString();
        const deleted = await AuditLog.destroy({ where: { timestamp: { [Op.lt]: cutoffISO } } });
        res.json({ deleted, cutoff: cutoffISO });
    } catch (e) {
        addError(e, 'DELETE /api/audit-logs/clear');
        res.status(500).json({ error: e.message });
    }
});

// ── BACKUP ROUTES ─────────────────────────────────────────────────────────────
const { getBackupStatus: _getBackupStatus, doBackup: _doBackup, setAutoBackupEnabled: _setAutoBackupEnabled } = require('./backup');
const _fs = require('fs');
const _path = require('path');
const _BACKUP_DIR = _path.join(__dirname, 'backups');

// GET /api/backup/status — backup info + file list
app.get('/api/backup/status', (req, res) => {
    try {
        res.json(_getBackupStatus());
    } catch (e) {
        addError(e, 'GET /api/backup/status');
        res.status(500).json({ error: e.message });
    }
});

// POST /api/backup/now — trigger immediate manual backup
app.post('/api/backup/now', (req, res) => {
    try {
        const result = _doBackup('manual');
        res.json(result);
    } catch (e) {
        addError(e, 'POST /api/backup/now');
        res.status(500).json({ error: e.message });
    }
});

// DELETE /api/backup/:filename — delete a specific backup file
app.delete('/api/backup/:filename', (req, res) => {
    try {
        const { filename } = req.params;
        // Security: only allow backup files (prevent path traversal)
        if (!filename.startsWith('database_backup_') || !filename.endsWith('.sqlite')) {
            return res.status(400).json({ error: 'Invalid backup filename' });
        }
        const filePath = _path.join(_BACKUP_DIR, filename);
        if (!_fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'Backup file not found' });
        }
        _fs.unlinkSync(filePath);
        res.json({ success: true, deleted: filename });
    } catch (e) {
        addError(e, `DELETE /api/backup/${req.params.filename}`);
        res.status(500).json({ error: e.message });
    }
});

// PATCH /api/backup/config — enable/disable auto-backup at runtime
app.patch('/api/backup/config', (req, res) => {
    try {
        const { enabled } = req.body;
        if (typeof enabled === 'boolean') {
            _setAutoBackupEnabled(enabled);
        }
        res.json({
            success: true,
            enabled: typeof enabled === 'boolean' ? enabled : true,
            message: `Auto-backup ${enabled ? 'enabled' : 'paused'} successfully`,
        });
    } catch (e) {
        addError(e, 'PATCH /api/backup/config');
        res.status(500).json({ error: e.message });
    }
});


// ── CLIENT CSV EXPORT (server-side for reliable filename on HTTPS) ─────────────
// Helper: build CSV
function buildCSV(headers, rows) {
    const escape = v => {
        const s = String(v ?? '');
        return (s.includes(',') || s.includes('\n') || s.includes('"'))
            ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const toRow = arr => arr.map(escape).join(',');
    return '\uFEFF' + [toRow(headers), ...rows.map(toRow)].join('\r\n');
}

// GET /api/clients/export?companyId=&assignedTo=&status=
app.get('/api/clients/export', async (req, res) => {
    try {
        const where = {};
        if (req.query.companyId) where.companyId = req.query.companyId;
        if (req.query.assignedTo) where.assignedTo = req.query.assignedTo;
        if (req.query.status && req.query.status !== 'ALL') where.status = req.query.status;

        const clients = await Client.findAll({ where, order: [['name', 'ASC']] });

        const headers = [
            'Code', 'Party Name', 'Shop Name', 'Owner Name',
            'Mobile', 'Alt Mobile', 'Email', 'Category', 'Type', 'Status',
            'Address', 'City', 'State', 'Pincode',
            'Assigned To', 'Total Visits', 'Last Visit', 'Next Visit',
            'Avg Visit (mins)', 'GPS Latitude', 'GPS Longitude',
            'Credit Limit (Rs)', 'Outstanding (Rs)', 'Notes'
        ];

        const rows = clients.map(c => [
            c.code, c.name, c.shopName, c.ownerName,
            c.phone, c.phone2, c.email, c.category, c.type, c.status,
            c.address, c.city, c.state, c.pincode,
            c.assignedToName, c.totalVisits || 0,
            c.lastVisitAt ? new Date(c.lastVisitAt).toLocaleDateString('en-IN') : '',
            c.nextVisitDate || '',
            c.avgVisitMins || 0, c.latitude || '', c.longitude || '',
            c.creditLimit || 0, c.outstandingAmount || 0, c.notes || ''
        ]);

        const date = new Date().toISOString().split('T')[0];
        const filename = `clients_${date}.csv`;

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Cache-Control', 'no-cache');
        res.send(buildCSV(headers, rows));
    } catch (e) { addError(e, 'GET /api/clients/export'); res.status(500).json({ error: e.message }); }
});

// GET /api/clients/demo-export — sample CSV template
app.get('/api/clients/demo-export', (req, res) => {
    const headers = ['name', 'shopName', 'ownerName', 'phone', 'phone2', 'address', 'city', 'state', 'pincode', 'type', 'category', 'notes'];
    const demo = [
        ['Sharma Traders', 'Sharma General Store', 'Ramesh Sharma', '9876543210', '9876543211', 'Shop 12, Gandhi Nagar', 'Ahmedabad', 'Gujarat', '380009', 'RETAIL', 'Grocery', 'Regular customer'],
        ['Patel Wholesale', 'Patel Mart', 'Suresh Patel', '9988776655', '', 'Plot 5, GIDC', 'Surat', 'Gujarat', '395004', 'WHOLESALE', 'FMCG', 'Big order monthly'],
        ['Verma Medicals', 'Verma Pharmacy', 'Anil Verma', '9911223344', '9911223345', 'Near Bus Stand', 'Vadodara', 'Gujarat', '390001', 'RETAIL', 'Pharmacy', 'Cash buyer'],
        ['Singh Distributors', 'Singh & Co.', 'Harjeet Singh', '9877665544', '', 'Warehouse No 8, Phase 2', 'Rajkot', 'Gujarat', '360001', 'DISTRIBUTOR', 'Electronics', ''],
        ['Mehta Institutions', 'St. Mary School', 'Prakash Mehta', '9800011122', '', 'School Road, Sector 4', 'Gandhinagar', 'Gujarat', '382010', 'INSTITUTION', 'Education', 'Annual contract'],
    ];
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="demo_clients_import.csv"');
    res.setHeader('Cache-Control', 'no-cache');
    res.send(buildCSV(headers, demo));
});


// ══════════════════════════════════════════════════════════════════════════════
// ── CLIENT / PARTY MANAGEMENT ─────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════


// Helper: haversine distance in metres between two GPS points
function gpsDistance(lat1, lng1, lat2, lng2) {
    if (!lat1 || !lat2) return null;
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

// GET /api/clients — list clients (filter by ?assignedTo=, ?status=, ?companyId=)
app.get('/api/clients', async (req, res) => {
    try {
        const where = {};
        if (req.query.companyId) where.companyId = req.query.companyId;
        if (req.query.assignedTo) where.assignedTo = req.query.assignedTo;
        if (req.query.status) where.status = req.query.status;
        const clients = await Client.findAll({ where, order: [['name', 'ASC']] });
        res.json(clients);
    } catch (e) { addError(e, 'GET /api/clients'); res.status(500).json({ error: e.message }); }
});

// POST /api/clients — create a new client/party
app.post('/api/clients', async (req, res) => {
    try {
        const data = req.body;
        // auto-generate code if not provided
        if (!data.code) {
            const count = await Client.count({ where: { companyId: data.companyId } });
            data.code = `C-${String(count + 1).padStart(4, '0')}`;
        }
        const client = await Client.create({ id: data.id || uuidv4(), ...data });
        res.status(201).json(client);
    } catch (e) { addError(e, 'POST /api/clients'); res.status(500).json({ error: e.message }); }
});

// POST /api/clients/bulk — bulk import 1000+ clients
app.post('/api/clients/bulk', async (req, res) => {
    try {
        const { clients, companyId } = req.body;
        if (!Array.isArray(clients) || !companyId) return res.status(400).json({ error: 'clients[] and companyId required' });
        const rows = clients.map((c, i) => ({
            id: c.id || uuidv4(),
            companyId,
            code: c.code || `C-${String(i + 1).padStart(4, '0')}`,
            ...c
        }));
        const result = await Client.bulkCreate(rows, { ignoreDuplicates: true });
        res.json({ inserted: result.length, total: rows.length });
    } catch (e) { addError(e, 'POST /api/clients/bulk'); res.status(500).json({ error: e.message }); }
});

// PUT /api/clients/:id — update client (including location set)
app.put('/api/clients/:id', async (req, res) => {
    try {
        const client = await Client.findByPk(req.params.id);
        if (!client) return res.status(404).json({ error: 'Client not found' });
        await client.update(req.body);
        res.json(client);
    } catch (e) { addError(e, 'PUT /api/clients/:id'); res.status(500).json({ error: e.message }); }
});

// PATCH /api/clients/:id/location — salesman sets GPS location for client
app.patch('/api/clients/:id/location', async (req, res) => {
    try {
        const { latitude, longitude, setBy } = req.body;
        if (!latitude || !longitude) return res.status(400).json({ error: 'latitude and longitude required' });
        const client = await Client.findByPk(req.params.id);
        if (!client) return res.status(404).json({ error: 'Client not found' });
        await client.update({ latitude, longitude, locationSetAt: new Date().toISOString(), locationSetBy: setBy });
        res.json({ success: true, client });
    } catch (e) { addError(e, 'PATCH /api/clients/:id/location'); res.status(500).json({ error: e.message }); }
});

// DELETE /api/clients/:id
app.delete('/api/clients/:id', async (req, res) => {
    try {
        const client = await Client.findByPk(req.params.id);
        if (!client) return res.status(404).json({ error: 'Client not found' });
        await client.destroy();
        res.json({ success: true });
    } catch (e) { addError(e, 'DELETE /api/clients/:id'); res.status(500).json({ error: e.message }); }
});

// ── CLIENT VISITS ──────────────────────────────────────────────────────────────

// GET /api/visits — list visits (filter by ?clientId=, ?salesmanId=, ?companyId=, ?date=)
app.get('/api/visits', async (req, res) => {
    try {
        const where = {};
        if (req.query.companyId) where.companyId = req.query.companyId;
        if (req.query.clientId) where.clientId = req.query.clientId;
        if (req.query.salesmanId) where.salesmanId = req.query.salesmanId;
        if (req.query.date) where.checkInAt = { [Op.like]: `${req.query.date}%` };
        const visits = await ClientVisit.findAll({ where, order: [['checkInAt', 'DESC']] });
        res.json(visits);
    } catch (e) { addError(e, 'GET /api/visits'); res.status(500).json({ error: e.message }); }
});

// POST /api/visits/checkin — salesman checks in at client
app.post('/api/visits/checkin', async (req, res) => {
    try {
        const { companyId, clientId, salesmanId, salesmanName, checkInLat, checkInLng, purpose, notes } = req.body;
        if (!companyId || !clientId || !salesmanId) return res.status(400).json({ error: 'companyId, clientId, salesmanId required' });

        // Check if salesman already has an open check-in
        const open = await ClientVisit.findOne({ where: { salesmanId, checkOutAt: null } });
        if (open) return res.status(400).json({ error: 'Already checked in at another client. Please check-out first.', openVisit: open });

        const client = await Client.findByPk(clientId);
        const visitCount = await ClientVisit.count({ where: { clientId, salesmanId } });
        const distanceFromClient = client ? gpsDistance(checkInLat, checkInLng, client.latitude, client.longitude) : null;

        const visit = await ClientVisit.create({
            id: uuidv4(),
            companyId, clientId, salesmanId, salesmanName,
            checkInAt: new Date().toISOString(),
            checkInLat, checkInLng,
            distanceFromClient,
            purpose: purpose || 'SALES',
            notes,
            visitNumber: visitCount + 1,
        });

        // Update client lastVisitAt
        if (client) await client.update({ lastVisitAt: new Date().toISOString() });

        res.status(201).json({ success: true, visit, distanceFromClient });
    } catch (e) { addError(e, 'POST /api/visits/checkin'); res.status(500).json({ error: e.message }); }
});

// POST /api/visits/:id/checkout — salesman checks out
app.post('/api/visits/:id/checkout', async (req, res) => {
    try {
        const { checkOutLat, checkOutLng, outcome, orderAmount, collectionAmount, notes, nextVisitDate } = req.body;
        const visit = await ClientVisit.findByPk(req.params.id);
        if (!visit) return res.status(404).json({ error: 'Visit not found' });
        if (visit.checkOutAt) return res.status(400).json({ error: 'Already checked out' });

        const checkOutAt = new Date().toISOString();
        const durationMins = (new Date(checkOutAt) - new Date(visit.checkInAt)) / 60000;

        await visit.update({ checkOutAt, checkOutLat, checkOutLng, durationMins: Math.round(durationMins), outcome, orderAmount: orderAmount || 0, collectionAmount: collectionAmount || 0, notes: notes || visit.notes, nextVisitDate });

        // Update client stats
        const client = await Client.findByPk(visit.clientId);
        if (client) {
            const allVisits = await ClientVisit.findAll({ where: { clientId: visit.clientId }, attributes: ['durationMins'] });
            const avg = allVisits.reduce((s, v) => s + (v.durationMins || 0), 0) / allVisits.length;
            await client.update({
                totalVisits: allVisits.length,
                avgVisitMins: Math.round(avg),
                nextVisitDate: nextVisitDate || client.nextVisitDate,
            });
        }

        res.json({ success: true, visit, durationMins: Math.round(durationMins) });
    } catch (e) { addError(e, 'POST /api/visits/:id/checkout'); res.status(500).json({ error: e.message }); }
});

// GET /api/visits/active/:salesmanId — get current open check-in for salesman
app.get('/api/visits/active/:salesmanId', async (req, res) => {
    try {
        const visit = await ClientVisit.findOne({ where: { salesmanId: req.params.salesmanId, checkOutAt: null } });
        if (!visit) return res.json(null);
        const client = await Client.findByPk(visit.clientId);
        res.json({ visit, client });
    } catch (e) { addError(e, 'GET /api/visits/active/:salesmanId'); res.status(500).json({ error: e.message }); }
});

// GET /api/visits/stats/:salesmanId — salesman analytics
app.get('/api/visits/stats/:salesmanId', async (req, res) => {
    try {
        const today = new Date().toISOString().split('T')[0];
        const todayVisits = await ClientVisit.count({ where: { salesmanId: req.params.salesmanId, checkInAt: { [Op.like]: `${today}%` } } });
        const totalVisits = await ClientVisit.count({ where: { salesmanId: req.params.salesmanId } });
        const totalClients = await Client.count({ where: { assignedTo: req.params.salesmanId } });
        const totalOrders = await ClientVisit.sum('orderAmount', { where: { salesmanId: req.params.salesmanId } });
        const totalCollection = await ClientVisit.sum('collectionAmount', { where: { salesmanId: req.params.salesmanId } });
        const avgDuration = await ClientVisit.findOne({ where: { salesmanId: req.params.salesmanId }, attributes: [[sequelize.fn('AVG', sequelize.col('durationMins')), 'avg']] });
        // Overdue clients (nextVisitDate < today and status=ACTIVE)
        const overdueClients = await Client.count({ where: { assignedTo: req.params.salesmanId, nextVisitDate: { [Op.lt]: today }, status: 'ACTIVE' } });
        res.json({ todayVisits, totalVisits, totalClients, totalOrders: totalOrders || 0, totalCollection: totalCollection || 0, avgDurationMins: Math.round(avgDuration?.dataValues?.avg || 0), overdueClients });
    } catch (e) { addError(e, 'GET /api/visits/stats/:salesmanId'); res.status(500).json({ error: e.message }); }
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

// HTTP server (backward compat)
app.listen(PORT, HOST, () => {
    console.log(`\n✅ SM Payroll Backend (HTTP)  → http://${HOST}:${PORT}`);
    console.log(`📊 Health:  http://localhost:${PORT}/api/health`);
    // Start auto-backup scheduler (backup on start + daily at midnight)
    startBackupScheduler();
});

// ── HTTPS Server (self-signed cert, persistent) ─────────
try {
    const https = require('https');
    const fs = require('fs');
    const { generateAndSaveCert, KEY_PATH, CERT_PATH } = require('./generate-ssl');

    let key, cert;

    if (fs.existsSync(KEY_PATH) && fs.existsSync(CERT_PATH)) {
        // console.log('✅ Found existing SSL certificates in:', KEY_PATH);
        key = fs.readFileSync(KEY_PATH, 'utf8');
        cert = fs.readFileSync(CERT_PATH, 'utf8');
    } else {
        console.log('⚠️  No SSL certificates found. Generating new ones...');
        const generated = generateAndSaveCert();
        key = generated.key;
        cert = generated.cert;
    }

    const httpsServer = https.createServer({ key, cert }, app);

    httpsServer.listen(HTTPS_PORT, HOST, () => {
        console.log(`🔒 SM Payroll Backend (HTTPS) → https://0.0.0.0:${HTTPS_PORT}`);
        console.log(`📡 Phone access:  https://<your-pc-ip>:${HTTPS_PORT}/api/health`);
        console.log(`📋 Routes:  https://localhost:${HTTPS_PORT}/api/status/routes\n`);
    });

} catch (e) {
    console.warn('⚠️  HTTPS server not started:', e.message);
}
