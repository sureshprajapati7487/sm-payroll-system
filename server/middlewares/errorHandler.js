'use strict';
const fs = require('fs');
const path = require('path');

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

// __dirname here is server/middlewares — resolve up one level to server/
const ERROR_LOG_PATH = path.join(__dirname, '..', 'errors.log');

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

// Returns the live array reference — callers may read or mutate (e.g. .length = 0 to clear)
function getErrorLog() { return errorLog; }

function errorHandlerMiddleware(err, req, res, _next) {
    addError(err, `${req.method} ${req.path}`);
    const h = getErrorHint(err);
    res.status(500).json({ error: err.message, why: h.why, fix: h.fix });
}

// Convenience: build a standardized error response object
function formatError(err) {
    const h = getErrorHint(err);
    return { error: (err && err.message) ? err.message : String(err), why: h.why, fix: h.fix };
}

module.exports = { addError, getErrorHint, getErrorLog, ERROR_LOG_PATH, errorHandlerMiddleware, formatError };
