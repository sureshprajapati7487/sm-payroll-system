'use strict';

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;

const failedAttempts = new Map();

// Periodically purge expired lockout entries to prevent unbounded Map growth
setInterval(() => {
    const now = Date.now();
    for (const [key, val] of failedAttempts.entries()) {
        if (val.lockedUntil && now > val.lockedUntil) failedAttempts.delete(key);
    }
}, 30 * 60 * 1000);

// getAttemptKey — returns a consistent, unified key for brute-force tracking
// Employee code is stored as UPPERCASE (e.g. "ACLLP-01"), email as lowercase
// We normalize BOTH so lockout works regardless of what the user typed
function getAttemptKey(idOrEmail) {
    const clean = (idOrEmail || '').trim();
    return clean.includes('@') ? clean.toLowerCase() : clean.toUpperCase();
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
function clearFailedAttempts(key) { failedAttempts.delete(key); }

module.exports = { getAttemptKey, isLocked, lockoutRemainingSeconds, recordFailedAttempt, clearFailedAttempts, MAX_FAILED_ATTEMPTS, LOCKOUT_DURATION_MS };
