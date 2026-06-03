'use strict';
const rateLimit = require('express-rate-limit');

// ── IP-level rate limiter for login endpoint ─────────────────────────────────
const loginRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    message: { error: 'Too many login attempts from this device.', fix: 'Please wait 15 minutes before trying again.', retryAfter: 15 * 60 },
});

// ── Global Write-API Rate Limiter ─────────────────────────────────────────────
// Protects ALL mutation endpoints (POST, PUT, PATCH, DELETE) from abuse/DoS.
// GET requests are skipped — reads are always unrestricted.
// 100 write-mutations per 15 minutes per IP is very generous for legitimate use
// (normal payroll admin makes ~10-20 mutations per hour).
const writeRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minute window
    max: 100,                  // max 100 write requests per IP per window
    standardHeaders: true,     // Return rate limit info in RateLimit-* headers
    legacyHeaders: false,      // Disable X-RateLimit-* headers (deprecated)
    skip: (req) => req.method === 'GET', // GET requests bypass this limiter entirely
    message: {
        error: 'Too many requests from this IP. Please slow down.',
        fix: 'Wait 15 minutes before sending more write requests.',
        retryAfter: 15 * 60,
    },
});

module.exports = { loginRateLimiter, writeRateLimiter };
