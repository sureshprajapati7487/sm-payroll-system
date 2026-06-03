'use strict';
const nodemailer = require('nodemailer');

const {
    EMAIL_SMTP_HOST,
    EMAIL_SMTP_PORT,
    EMAIL_SMTP_USER,
    EMAIL_SMTP_PASS,
    EMAIL_FROM,
} = process.env;

const smtpConfigured = !!(EMAIL_SMTP_HOST && EMAIL_SMTP_USER && EMAIL_SMTP_PASS);

// Transporter is created once and reused across calls
const transporter = smtpConfigured
    ? nodemailer.createTransport({
        host: EMAIL_SMTP_HOST,
        port: parseInt(EMAIL_SMTP_PORT || '587', 10),
        secure: false,   // STARTTLS — upgrades connection on port 587
        auth: { user: EMAIL_SMTP_USER, pass: EMAIL_SMTP_PASS },
    })
    : null;

/**
 * Send an HTML email.
 * Falls back to console.log when SMTP env vars are not configured (safe for dev).
 */
async function sendEmail(to, subject, html) {
    if (!smtpConfigured) {
        console.log('[emailService] SMTP not configured — logging email instead of sending.');
        console.log(`  To:      ${to}`);
        console.log(`  Subject: ${subject}`);
        console.log(`  Body:    ${html}`);
        return { simulated: true, to, subject };
    }

    const info = await transporter.sendMail({
        from: EMAIL_FROM || EMAIL_SMTP_USER,
        to,
        subject,
        html,
    });

    return info;
}

module.exports = { sendEmail };
