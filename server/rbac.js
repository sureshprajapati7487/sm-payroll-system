const requireRole = (allowedRoles) => {
    return (req, res, next) => {
        if (!req.user || !req.user.role) {
            return res.status(401).json({ error: 'Unauthorized', fix: 'Login REQUIRED' });
        }
        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({
                error: 'Access denied. Insufficient permissions.',
                fix: `Requires one of these roles: ${allowedRoles.join(', ')}`
            });
        }
        next();
    };
};

/**
 * requireCompanyScope
 *
 * Enforces cross-tenant isolation by setting req.companyId from the JWT token.
 *
 * - For non-SUPER_ADMIN: companyId is ALWAYS from JWT. Client-supplied param is ignored.
 * - For SUPER_ADMIN targeting a DIFFERENT company: must supply the x-company-id header
 *   AND a valid x-cross-company-token header. The token is HMAC-SHA256 of
 *   "CROSS_COMPANY:<targetCompanyId>:<userId>:<date YYYY-MM-DD>" signed with JWT_SECRET.
 *   This prevents casual header injection and requires the client to compute a fresh
 *   token each day — impossible without knowing JWT_SECRET.
 */
const crypto = require('crypto');

const requireCompanyScope = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized — no session', fix: 'Please login again.' });
    }

    const isSuperAdmin = req.user.role === 'SUPER_ADMIN';
    const targetCompanyId = req.headers['x-company-id'] || req.query.companyId;
    const IS_PRODUCTION = process.env.NODE_ENV === 'production';

    if (isSuperAdmin && targetCompanyId && targetCompanyId !== req.user.companyId) {
        // SUPER_ADMIN cross-company access: bypass token check in dev mode
        if (!IS_PRODUCTION) {
            req.companyId = targetCompanyId;
            return next();
        }

        // Production: require and verify HMAC token
        const crossCompanyToken = req.headers['x-cross-company-token'];
        if (!crossCompanyToken) {
            return res.status(403).json({
                error: 'Cross-company access requires x-cross-company-token header.',
                fix: 'Request a fresh token via POST /api/auth/cross-company-token',
            });
        }

        // Verify HMAC — token must match CROSS_COMPANY:<target>:<userId>:<YYYY-MM-DD>
        const today = new Date().toISOString().slice(0, 10);
        const expected = crypto
            .createHmac('sha256', process.env.JWT_SECRET)
            .update(`CROSS_COMPANY:${targetCompanyId}:${req.user.id}:${today}`)
            .digest('hex');
        if (crossCompanyToken !== expected) {
            return res.status(403).json({
                error: 'Invalid or expired cross-company token.',
                fix: 'Request a fresh token via POST /api/auth/cross-company-token',
            });
        }

        req.companyId = targetCompanyId;
        return next();
    } else if (isSuperAdmin && targetCompanyId && targetCompanyId === req.user.companyId) {
        req.companyId = req.user.companyId;
    } else if (isSuperAdmin && !targetCompanyId) {
        req.companyId = req.user.companyId || null;
    } else {
        // All other roles: company always from JWT
        req.companyId = req.user.companyId || null;
    }

    next();
};

module.exports = { requireRole, requireCompanyScope };

