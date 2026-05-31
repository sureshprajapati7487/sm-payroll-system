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

    if (isSuperAdmin && targetCompanyId && targetCompanyId !== req.user.companyId) {
        // SUPER_ADMIN cross-company access requires a signed token
        const crossCompanyToken = req.headers['x-cross-company-token'];
        if (!crossCompanyToken) {
            return res.status(403).json({
                error: 'Cross-company access requires x-cross-company-token header.',
                fix: 'Generate: HMAC-SHA256("CROSS_COMPANY:<companyId>:<userId>:<YYYY-MM-DD>") with JWT_SECRET',
            });
        }

        const today = new Date().toISOString().split('T')[0];
        const payload = `CROSS_COMPANY:${targetCompanyId}:${req.user.id}:${today}`;
        const jwtSecret = process.env.JWT_SECRET || '';
        const expected = crypto.createHmac('sha256', jwtSecret).update(payload).digest('hex');

        if (crossCompanyToken !== expected) {
            return res.status(403).json({ error: 'Invalid x-cross-company-token — access denied.' });
        }

        req.companyId = targetCompanyId;
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

