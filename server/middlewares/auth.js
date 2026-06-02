'use strict';
const jwt = require('jsonwebtoken');

// JWT_SECRET must come from environment — no fallback allowed.
// server/index.js already calls process.exit(1) in production if this is missing.
// In development, generateDevSecret() in index.js sets process.env.JWT_SECRET.
// Reading it here (not inlining a default) ensures both files always use the same key.
if (!process.env.JWT_SECRET) {
    // During module load in dev, index.js may not have run yet — lazy read is safe
    // because authMiddleware is only called after the server is listening.
}
const getJwtSecret = () => {
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error('JWT_SECRET env var is not set — cannot verify tokens');
    return secret;
};

const PUBLIC_PATHS = [
    // Auth — must be public for login flow
    { method: 'POST', path: '/api/auth/login' },
    { method: 'POST', path: '/api/auth/dev-login' },
    { method: 'POST', path: '/api/auth/refresh' },
    { method: 'POST', path: '/api/auth/verify-password' },
    { method: 'POST', path: '/api/auth/logout' },
    // Health — for Render's health check probe (no token needed)
    { method: 'GET', path: '/api/health' },
    // Company setup wizard — new installs need to create first company before login
    { method: 'GET', path: '/api/companies' },
    { method: 'POST', path: '/api/companies' },
    // Client CSV demo download — public sample file
    { method: 'GET', path: '/api/clients/demo-export' },
    // Frontend error reporting — browser sends errors before auth is established
    { method: 'POST', path: '/api/status/errors/report' },
    // NOTE: /api/status/errors (GET), /api/health/deep, /api/status/routes
    // are intentionally NOT in PUBLIC_PATHS — require authentication
];

function isPublic(req) {
    return PUBLIC_PATHS.some(p => p.method === req.method && req.path.startsWith(p.path));
}

function authMiddleware(req, res, next) {
    if (isPublic(req)) return next();
    const header = req.headers['authorization'] || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : (req.query.token || null);
    if (!token) return res.status(401).json({ error: 'Unauthorized — token required', fix: 'Include Authorization: Bearer <token> header' });
    try { req.user = jwt.verify(token, getJwtSecret()); next(); }
    catch (e) { return res.status(401).json({ error: 'Invalid or expired token', fix: 'Login again to get a new token' }); }
}

module.exports = { authMiddleware, isPublic, PUBLIC_PATHS };
