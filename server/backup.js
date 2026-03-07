/**
 * backup.js — Automatic SQLite Database Backup System
 *
 * Features:
 *  - Backup on server start
 *  - Daily backup at midnight (configurable)
 *  - Keep last N backups (default: 7)
 *  - Manual backup via API
 *  - Backup status & history API
 */

const fs = require('fs');
const path = require('path');

// ── Config ────────────────────────────────────────────────────────────────────
const DB_PATH = path.join(__dirname, 'database.sqlite');
const BACKUP_DIR = path.join(__dirname, 'backups');
const MAX_BACKUPS = 7;          // Keep last 7 daily backups
const BACKUP_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

// ── State ─────────────────────────────────────────────────────────────────────
let lastBackupTime = null;
let lastBackupFile = null;
let lastBackupError = null;
let backupTimer = null;
let autoBackupEnabled = true;      // ← can toggle via API
let nextBackupTime = null;         // ← ISO string for next scheduled backup

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Ensure backups directory exists */
function ensureBackupDir() {
    if (!fs.existsSync(BACKUP_DIR)) {
        fs.mkdirSync(BACKUP_DIR, { recursive: true });
        console.log('📁 Created backups directory:', BACKUP_DIR);
    }
}

/** Generate backup filename with timestamp */
function getBackupFilename() {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const ts = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
    return `database_backup_${ts}.sqlite`;
}

/** Delete oldest backups keeping only MAX_BACKUPS */
function pruneOldBackups() {
    try {
        const files = fs.readdirSync(BACKUP_DIR)
            .filter(f => f.startsWith('database_backup_') && f.endsWith('.sqlite'))
            .map(f => ({
                name: f,
                time: fs.statSync(path.join(BACKUP_DIR, f)).mtimeMs,
            }))
            .sort((a, b) => b.time - a.time); // newest first

        if (files.length > MAX_BACKUPS) {
            const toDelete = files.slice(MAX_BACKUPS);
            toDelete.forEach(f => {
                fs.unlinkSync(path.join(BACKUP_DIR, f.name));
                console.log('🗑️  Deleted old backup:', f.name);
            });
        }
    } catch (err) {
        console.warn('⚠️  Prune backup failed:', err.message);
    }
}

// ── Core Backup ───────────────────────────────────────────────────────────────

/**
 * Perform a backup right now.
 * Returns { success, file, size, error }
 */
function doBackup(label = 'scheduled') {
    try {
        ensureBackupDir();

        if (!fs.existsSync(DB_PATH)) {
            throw new Error('database.sqlite not found — no data to backup yet');
        }

        const filename = getBackupFilename();
        const destPath = path.join(BACKUP_DIR, filename);

        // Copy database file (safe even if Sequelize has it open — just copying file bytes)
        fs.copyFileSync(DB_PATH, destPath);

        const stats = fs.statSync(destPath);
        lastBackupTime = new Date().toISOString();
        lastBackupFile = filename;
        lastBackupError = null;

        pruneOldBackups();

        const sizeKB = (stats.size / 1024).toFixed(1);
        console.log(`✅ Database backup [${label}]: ${filename} (${sizeKB} KB)`);

        return { success: true, file: filename, sizeBytes: stats.size, timestamp: lastBackupTime };

    } catch (err) {
        lastBackupError = err.message;
        console.error('❌ Backup failed:', err.message);
        return { success: false, error: err.message };
    }
}

// ── Scheduler ─────────────────────────────────────────────────────────────────

/**
 * Start the backup scheduler.
 * - Runs a backup immediately on start
 * - Schedules daily backup precisely at midnight
 */
function startBackupScheduler() {
    console.log('🔄 Backup scheduler starting...');

    // 1. Immediate backup on start
    doBackup('startup');

    // Recursive precise scheduler
    function scheduleNext() {
        const now = new Date();
        const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1); // Exact next midnight
        const msUntilMidnight = tomorrow.getTime() - now.getTime();

        nextBackupTime = tomorrow.toISOString();

        console.log(`⏰ Next scheduled backup: ${tomorrow.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} (in ${Math.round(msUntilMidnight / 60000)} min)`);

        backupTimer = setTimeout(() => {
            if (autoBackupEnabled) {
                doBackup('daily-midnight');
            }
            scheduleNext(); // Re-schedule for next midnight to prevent timer drift
        }, msUntilMidnight);
    }

    scheduleNext();
}

/**
 * Enable or disable auto-backup at runtime (no restart needed)
 */
function setAutoBackupEnabled(enabled) {
    autoBackupEnabled = !!enabled;
    console.log(`${autoBackupEnabled ? '✅' : '⏸️ '} Auto-backup ${autoBackupEnabled ? 'enabled' : 'paused'} by user`);
    return autoBackupEnabled;
}

/** Stop the backup scheduler */
function stopBackupScheduler() {
    if (backupTimer) {
        clearInterval(backupTimer);
        backupTimer = null;
    }
}

// ── Status & History ──────────────────────────────────────────────────────────

/** Get current backup status */
function getBackupStatus() {
    ensureBackupDir();

    const files = fs.existsSync(BACKUP_DIR)
        ? fs.readdirSync(BACKUP_DIR)
            .filter(f => f.startsWith('database_backup_') && f.endsWith('.sqlite'))
            .map(f => {
                const stat = fs.statSync(path.join(BACKUP_DIR, f));
                return {
                    filename: f,
                    sizeBytes: stat.size,
                    sizeKB: (stat.size / 1024).toFixed(1),
                    createdAt: stat.mtime.toISOString(),
                };
            })
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        : [];

    const dbSize = fs.existsSync(DB_PATH) ? fs.statSync(DB_PATH).size : 0;

    return {
        enabled: autoBackupEnabled,
        maxBackups: MAX_BACKUPS,
        intervalHours: 24,
        backupDir: BACKUP_DIR,
        lastBackupTime,
        lastBackupFile,
        lastBackupError,
        nextBackupTime,
        dbSizeBytes: dbSize,
        dbSizeKB: (dbSize / 1024).toFixed(1),
        totalBackups: files.length,
        backups: files,
    };
}

// ── Exports ───────────────────────────────────────────────────────────────────
module.exports = { startBackupScheduler, stopBackupScheduler, doBackup, getBackupStatus, setAutoBackupEnabled };
