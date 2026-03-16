/**
 * apiConfig.ts — Central API URL resolver
 *
 * ═══════════════════════════════════════════════════════════════
 *  ENVIRONMENT MODES  (controlled via .env.local)
 * ═══════════════════════════════════════════════════════════════
 *
 *  MODE A — Production Server (ALL devices sync to same DB) ✅ ACTIVE
 *  ─ Set VITE_API_URL=https://sm-payroll-system.onrender.com in .env.local
 *  ─ Local Web  → Render (production)
 *  ─ Website    → Render (production)
 *  ─ Android    → Render (production)
 *  ─ Result: Permissions, data — sab ek hi DB mein ✅
 *
 *  MODE B — Local Server (offline / local dev)
 *  ─ Comment out VITE_API_URL in .env.local (or delete it)
 *  ─ Also run: cd server && npm start
 *  ─ Local Web → localhost:3000 (Vite proxy)
 *  ─ Android   → still uses Render (native always uses PROD_API)
 *
 * ═══════════════════════════════════════════════════════════════
 */

import { Capacitor } from '@capacitor/core';

// ── Detect if running inside native Android/iOS app ──────────────────────────
const isNative = Capacitor.isNativePlatform();

// ── Production base URL (from .env.local or default Render URL) ──────────────
const rawEnv = (import.meta.env.VITE_API_URL || 'https://sm-payroll-system.onrender.com')
    .replace(/\/api\/?$/, '')  // trailing /api remove
    .replace(/\/$/, '');       // trailing slash remove

const PROD_API = `${rawEnv}/api`;

// ── API URL Resolution ────────────────────────────────────────────────────────
// Android (native)     → always production (Render)
// Web with VITE_API_URL → production (Render)  ← .env.local set hai toh
// Web without VITE_API_URL → '/api' (Vite proxy → localhost:3000)
export const API_URL: string = isNative
    ? PROD_API
    : (import.meta.env.VITE_API_URL ? PROD_API : '/api');

export const getApiUrl = () => API_URL;

// ── Current Mode (for debugging in Server Status page) ───────────────────────
export const getEnvironmentMode = (): 'production' | 'local' => {
    if (isNative || import.meta.env.VITE_API_URL) return 'production';
    return 'local';
};

// ── Helper: base URL (without /api) for direct fetch calls ───────────────────
export const getServerBaseUrl = (): string => {
    if (isNative || import.meta.env.VITE_API_URL) return rawEnv;
    return 'http://localhost:3000';
};
