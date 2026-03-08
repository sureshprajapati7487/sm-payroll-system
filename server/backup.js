/**
 * backup.js — Advanced SQLite Database Backup System
 *
 * Features:
 *  - Backup on server start
 *  - Multiple custom time schedules per day (configurable via API/UI)
 *  - Keep last N backups (default: 7), auto-prune old ones
 *  - Manual backup via API
 *  - Auto-delivery via Email (via SMTP/nodemailer) and WhatsApp (Meta Cloud API)
 *  - Backup status & history API
 */

const fs = require('fs');
const path = require('path');
const cron = require('node-cron');
const nodemailer = require('nodemailer');

// ── Paths ─────────────────────────────────────────────────────────────────────
const DB_PATH = path.join(__dirname, 'database.sqlite');
const BACKUP_DIR = path.join(__dirname, 'backups');
const CONFIG_FILE = path.join(__dirname, 'backup_config.json');
const MAX_BACKUPS = 7;

// ── Default Config ─────────────────────────────────────────────────────────────
const DEFAULT_CONFIG = {
    enabled: true,
    schedules: ['00:00'],          // HH:mm strings — default midnight
    email: {
        enabled: false,
        smtpHost: 'smtp.gmail.com',
        smtpPort: 587,
        user: '',
        pass: '',                  // Gmail App Password
        to: '',                    // Destination email(s), comma separated
    },
    whatsapp: {
        enabled: false,
        phoneNumberId: '',         // Meta WhatsApp Business Phone Number ID
        wabaToken: '',             // Meta WABA Bearer Token
        to: '',                    // Destination phone number (e.g. 919876543210)
    }
};

// ── State ─────────────────────────────────────────────────────────────────────
let lastBackupTime = null;
let lastBackupFile = null;
let lastBackupError = null;
let nextBackupTimes = [];          // Array of upcoming HH:mm times
let cronJobs = [];                 // Active node-cron jobs
let config = { ...DEFAULT_CONFIG };

// ── Config Persistence ────────────────────────────────────────────────────────

function loadConfig() {
    try {
        if (fs.existsSync(CONFIG_FILE)) {
            const raw = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
            config = { ...DEFAULT_CONFIG, ...raw };
            if (!Array.isArray(config.schedules) || config.schedules.length === 0) {
                config.schedules = ['00:00'];
            }
        }
    } catch (err) {
        console.warn('⚠️  Could not load backup config, using defaults:', err.message);
        config = { ...DEFAULT_CONFIG };
    }
}

function saveConfig() {
    try {
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
    } catch (err) {
        console.error('❌ Failed to save backup config:', err.message);
    }
}

function getConfig() {
    return config;
}

function updateConfig(updates) {
    config = {
        ...config,
        ...updates,
        email: { ...config.email, ...(updates.email || {}) },
        whatsapp: { ...config.whatsapp, ...(updates.whatsapp || {}) },
    };
    saveConfig();
    // Restart scheduler to apply new schedules
    stopAllCronJobs();
    if (config.enabled) setupCronJobs();
    return config;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function ensureBackupDir() {
    if (!fs.existsSync(BACKUP_DIR)) {
        fs.mkdirSync(BACKUP_DIR, { recursive: true });
        console.log('📁 Created backups directory:', BACKUP_DIR);
    }
}

function getBackupFilename() {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const ts = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
    return `database_backup_${ts}.sqlite`;
}

function pruneOldBackups() {
    try {
        const files = fs.readdirSync(BACKUP_DIR)
            .filter(f => f.startsWith('database_backup_') && f.endsWith('.sqlite'))
            .map(f => ({ name: f, time: fs.statSync(path.join(BACKUP_DIR, f)).mtimeMs }))
            .sort((a, b) => b.time - a.time);

        if (files.length > MAX_BACKUPS) {
            files.slice(MAX_BACKUPS).forEach(f => {
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
 * Returns { success, file, sizeBytes, error }
 */
function doBackup(label = 'scheduled') {
    try {
        ensureBackupDir();

        if (!fs.existsSync(DB_PATH)) {
            throw new Error('database.sqlite not found — no data to backup yet');
        }

        const filename = getBackupFilename();
        const destPath = path.join(BACKUP_DIR, filename);

        fs.copyFileSync(DB_PATH, destPath);

        const stats = fs.statSync(destPath);
        lastBackupTime = new Date().toISOString();
        lastBackupFile = filename;
        lastBackupError = null;

        pruneOldBackups();

        const sizeKB = (stats.size / 1024).toFixed(1);
        console.log(`✅ Database backup [${label}]: ${filename} (${sizeKB} KB)`);

        // Fire deliveries asynchronously (don't block backup return)
        sendDeliveries(destPath, filename, sizeKB, label).catch(err => {
            console.error('❌ Delivery error:', err.message);
        });

        return { success: true, file: filename, sizeBytes: stats.size, timestamp: lastBackupTime };

    } catch (err) {
        lastBackupError = err.message;
        console.error('❌ Backup failed:', err.message);
        return { success: false, error: err.message };
    }
}

// ── Delivery: Email ───────────────────────────────────────────────────────────

async function sendEmailDelivery(filePath, filename, sizeKB) {
    const ec = config.email;
    if (!ec.enabled || !ec.user || !ec.pass || !ec.to) {
        return;
    }

    const transporter = nodemailer.createTransport({
        host: ec.smtpHost || 'smtp.gmail.com',
        port: ec.smtpPort || 587,
        secure: (ec.smtpPort === 465),
        auth: { user: ec.user, pass: ec.pass },
    });

    const dateStr = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
    await transporter.sendMail({
        from: `"SM Payroll Backup" <${ec.user}>`,
        to: ec.to,
        subject: `📦 SM Payroll Backup — ${dateStr}`,
        text: `Auto backup completed successfully!\n\nFile: ${filename}\nSize: ${sizeKB} KB\nTime: ${dateStr}\n\nPlease save this file securely.`,
        attachments: [{ filename, path: filePath }],
    });

    console.log(`📧 Backup emailed to: ${ec.to}`);
}

// ── Delivery: WhatsApp ────────────────────────────────────────────────────────

async function sendWhatsAppDelivery(filePath, filename, sizeKB) {
    const wa = config.whatsapp;
    if (!wa.enabled || !wa.phoneNumberId || !wa.wabaToken || !wa.to) {
        return;
    }

    // Step 1: Upload file to Meta media endpoint using proper multipart binary buffer
    let mediaId;
    try {
        const fileBuffer = fs.readFileSync(filePath);
        const boundary = '----SMPayrollBoundary' + Date.now();

        // Build multipart body as proper binary Buffer (not string concat which corrupts binary)
        const part1 = Buffer.from(
            `--${boundary}\r\nContent-Disposition: form-data; name="messaging_product"\r\n\r\nwhatsapp\r\n` +
            `--${boundary}\r\nContent-Disposition: form-data; name="type"\r\n\r\napplication/octet-stream\r\n` +
            `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: application/octet-stream\r\n\r\n`,
            'utf-8'
        );
        const part2 = Buffer.from(`\r\n--${boundary}--\r\n`, 'utf-8');
        const body = Buffer.concat([part1, fileBuffer, part2]);

        const uploadRes = await fetch(
            `https://graph.facebook.com/v19.0/${wa.phoneNumberId}/media`,
            {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${wa.wabaToken}`,
                    'Content-Type': `multipart/form-data; boundary=${boundary}`,
                    'Content-Length': body.length.toString(),
                },
                body,
            }
        );
        const uploadData = await uploadRes.json();
        if (!uploadRes.ok || !uploadData.id) {
            console.warn('\u26a0\ufe0f  WhatsApp media upload failed:', JSON.stringify(uploadData));
            await sendWhatsAppTextFallback(wa, filename, sizeKB);
            return;
        }
        mediaId = uploadData.id;
    } catch (err) {
        console.warn('\u26a0\ufe0f  WhatsApp upload error:', err.message);
        // If media upload fails, just send a text notification
        await sendWhatsAppTextFallback(wa, filename, sizeKB);
        return;
    }

    // Step 2: Send the document via WhatsApp
    const dateStr = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
    const msgRes = await fetch(
        `https://graph.facebook.com/v19.0/${wa.phoneNumberId}/messages`,
        {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${wa.wabaToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                messaging_product: 'whatsapp',
                recipient_type: 'individual',
                to: wa.to,
                type: 'document',
                document: {
                    id: mediaId,
                    filename,
                    caption: `📦 SM Payroll Auto Backup\n📅 ${dateStr}\n💾 Size: ${sizeKB} KB`,
                }
            })
        }
    );

    if (msgRes.ok) {
        console.log(`📱 Backup sent via WhatsApp to: ${wa.to}`);
    } else {
        const err = await msgRes.json();
        console.warn('⚠️  WhatsApp document send failed:', JSON.stringify(err));
        await sendWhatsAppTextFallback(wa, filename, sizeKB);
    }
}

async function sendWhatsAppTextFallback(wa, filename, sizeKB) {
    const dateStr = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
    try {
        await fetch(`https://graph.facebook.com/v19.0/${wa.phoneNumberId}/messages`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${wa.wabaToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                messaging_product: 'whatsapp',
                recipient_type: 'individual',
                to: wa.to,
                type: 'text',
                text: {
                    body: `📦 SM Payroll Backup completed!\n📅 ${dateStr}\n💾 File: ${filename} (${sizeKB} KB)\n\nBackup saved on server. Download it from the Admin - Database Backup page.`
                }
            })
        });
        console.log(`📱 WhatsApp backup notification (text) sent to: ${wa.to}`);
    } catch (e) {
        console.error('❌ WhatsApp text fallback also failed:', e.message);
    }
}

async function sendDeliveries(filePath, filename, sizeKB, label) {
    if (label === 'startup') return; // Don't spam on startup

    const tasks = [];
    if (config.email?.enabled) tasks.push(sendEmailDelivery(filePath, filename, sizeKB));
    if (config.whatsapp?.enabled) tasks.push(sendWhatsAppDelivery(filePath, filename, sizeKB));

    if (tasks.length > 0) {
        await Promise.allSettled(tasks);
    }
}

// ── Scheduler (node-cron) ────────────────────────────────────────────────────

function stopAllCronJobs() {
    cronJobs.forEach(job => { try { job.stop(); } catch { /* noop */ } });
    cronJobs = [];
    nextBackupTimes = [];
    console.log('🔄 Backup cron jobs cleared');
}

/**
 * Parse an array of HH:mm strings into active cron jobs.
 */
function setupCronJobs() {
    if (!config.enabled) return;

    const schedules = config.schedules || ['00:00'];
    const validSchedules = schedules.filter(s => /^\d{2}:\d{2}$/.test(s));

    validSchedules.forEach(timeStr => {
        const [hours, minutes] = timeStr.split(':');
        const cronExpr = `${parseInt(minutes)} ${parseInt(hours)} * * *`;

        try {
            const job = cron.schedule(cronExpr, () => {
                console.log(`⏰ Scheduled backup at ${timeStr}`);
                doBackup(`scheduled-${timeStr}`);
            });
            cronJobs.push(job);
            nextBackupTimes.push(timeStr);
            console.log(`✅ Backup scheduled at ${timeStr} (cron: ${cronExpr})`);
        } catch (err) {
            console.error(`❌ Could not create cron for '${timeStr}':`, err.message);
        }
    });
}

/**
 * Start the backup system.
 */
function startBackupScheduler() {
    loadConfig();
    console.log('🔄 Backup scheduler starting...');
    doBackup('startup');
    setupCronJobs();
}

// ── Status & History ──────────────────────────────────────────────────────────

function getBackupStatus() {
    ensureBackupDir();

    const files = fs.existsSync(BACKUP_DIR)
        ? fs.readdirSync(BACKUP_DIR)
            .filter(f => f.startsWith('database_backup_') && f.endsWith('.sqlite'))
            .map(f => {
                const stat = fs.statSync(path.join(BACKUP_DIR, f));
                return { filename: f, sizeBytes: stat.size, sizeKB: (stat.size / 1024).toFixed(1), createdAt: stat.mtime.toISOString() };
            })
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        : [];

    const dbSize = fs.existsSync(DB_PATH) ? fs.statSync(DB_PATH).size : 0;

    return {
        enabled: config.enabled,
        schedules: config.schedules,
        maxBackups: MAX_BACKUPS,
        backupDir: BACKUP_DIR,
        lastBackupTime,
        lastBackupFile,
        lastBackupError,
        nextBackupTimes,
        dbSizeBytes: dbSize,
        dbSizeKB: (dbSize / 1024).toFixed(1),
        totalBackups: files.length,
        backups: files,
        emailEnabled: !!config.email?.enabled,
        whatsappEnabled: !!config.whatsapp?.enabled,
    };
}

// ── Exports ───────────────────────────────────────────────────────────────────
module.exports = {
    startBackupScheduler,
    stopAllCronJobs,
    doBackup,
    getBackupStatus,
    getConfig,
    updateConfig,
};
