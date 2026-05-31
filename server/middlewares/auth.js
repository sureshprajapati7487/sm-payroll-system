'use strict';
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'sm-payroll-super-secret-jwt-key-2026';

const PUBLIC_PATHS = [
    { method: 'POST', path: '/api/auth/login' },
    { method: 'POST', path: '/api/auth/dev-login' },
    { method: 'POST', path: '/api/auth/refresh' },
    { method: 'POST', path: '/api/auth/verify-password' },
    { method: 'POST', path: '/api/auth/logout' },
    { method: 'GET', path: '/api/health' },
    { method: 'GET', path: '/api/status/routes' },
    { method: 'GET', path: '/api/status/errors' },
    { method: 'DELETE', path: '/api/health/errors' },
    { method: 'GET', path: '/api/health/deep' },
    { method: 'POST', path: '/api/status/errors/report' },
    { method: 'POST', path: '/api/companies' },
    { method: 'GET', path: '/api/clients/export' },
    { method: 'GET', path: '/api/clients/demo-export' },
];

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

module.exports = { authMiddleware, isPublic, PUBLIC_PATHS };
