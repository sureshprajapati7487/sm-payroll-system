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
 * Enforces Cross-Tenant isolation by setting req.companyId from the JWT token.
 *
 * - For SUPER_ADMIN: allow targeting any company via ?companyId query param.
 *   If no companyId is supplied, they still get their own from JWT.
 * - For all others: companyId is ALWAYS taken from JWT. The client-supplied
 *   ?companyId query param is IGNORED to prevent cross-tenant data bleed.
 *
 * After this middleware runs, route handlers should use req.companyId,
 * NOT req.query.companyId.
 */
const requireCompanyScope = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized — no session', fix: 'Please login again.' });
    }

    const isSuperAdmin = req.user.role === 'SUPER_ADMIN';

    if (isSuperAdmin) {
        // SUPER_ADMIN can target any company explicitly, or fall back to own companyId
        req.companyId = req.headers['x-company-id'] || req.query.companyId || req.body?.companyId || req.user.companyId || null;
    } else {
        // All other roles: company MUST come from JWT — ignore client-supplied param
        req.companyId = req.user.companyId || null;
    }

    next();
};

module.exports = { requireRole, requireCompanyScope };

