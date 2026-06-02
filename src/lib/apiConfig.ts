/**
 * apiConfig.ts — Central API URL resolver
 *
 * ═══════════════════════════════════════════════════════════════
 *  HOW URL IS RESOLVED (priority order)
 * ═══════════════════════════════════════════════════════════════
 *
 *  1. Native Android/iOS (Capacitor)   → ALWAYS Render public URL
 *  2. VITE_API_URL env var is set      → use that URL
 *     ⚠️  MUST be the web-service URL, e.g. https://sm-payroll-system.onrender.com
 *     ⚠️  NEVER set to a postgres:// or internal dpg-... hostname
 *  3. Production build (PROD = true)   → Render public URL (safe default)
 *  4. Local dev (npm run dev, no env)  → '/api' (Vite proxy → localhost:3000)
 *
 * ═══════════════════════════════════════════════════════════════
 *  VERCEL DASHBOARD → Settings → Environment Variables:
 *  Key:   VITE_API_URL
 *  Value: https://sm-payroll-system.onrender.com   ← web service URL only
 *
 *  RENDER DASHBOARD → sm-payroll-system → Environment:
 *  DATABASE_URL = postgres://user:pass@dpg-xxx.oregon-postgres.render.com:5432/db
 *                 ← External Database URL (full hostname with region + port)
 * ═══════════════════════════════════════════════════════════════
 */

import { Capacitor } from '@capacitor/core';

// Detect native Android/iOS
const isNative = Capacitor.isNativePlatform();

// ── Validate and sanitize VITE_API_URL ────────────────────────────────────────
// Guard: if someone accidentally set VITE_API_URL to a postgres:// or internal
// dpg-... hostname, fall back to the safe default to avoid ENOTFOUND errors.
const rawViteUrl = import.meta.env.VITE_API_URL as string | undefined;
const isValidHttpUrl = rawViteUrl
    ? rawViteUrl.startsWith('https://') || rawViteUrl.startsWith('http://')
    : false;
const effectiveEnvUrl = isValidHttpUrl ? rawViteUrl! : undefined;

// ── Production base URL (from .env.local or default Render URL) ──────────────
const defaultProdUrl = 'https://sm-payroll-system.onrender.com';
const rawEnv = (import.meta.env.VITE_API_URL || defaultProdUrl)
    .replace(/\/api\/?$/, '')  // trailing /api remove
    .replace(/\/$/, '');       // trailing slash remove

// 🚨 SAFETY CHECK: If the URL is a Render internal hostname (starts with dpg-), 
// it won't be reachable from the public internet (Vercel/Browser).
// We force the public URL in this case.
const isInternalHost = rawEnv.includes('dpg-') && !rawEnv.startsWith('https://');
const safeRawEnv = isInternalHost ? defaultProdUrl : rawEnv;

const PROD_API = `${safeRawEnv}/api`;

// ── API URL Resolution ────────────────────────────────────────────────────────
// Android (native)     → always production (Render)
// Web with VITE_API_URL → production (Render)  ← .env.local set hai toh
// Web without VITE_API_URL → '/api' (Vite proxy → localhost:3000)
export const API_URL: string = isNative
    ? PROD_API
    : (import.meta.env.VITE_API_URL && !isInternalHost ? PROD_API : '/api');

export const getApiUrl = () => API_URL;

export const getEnvironmentMode = (): 'production' | 'local' =>
    (isNative || !!effectiveEnvUrl || import.meta.env.PROD === true) ? 'production' : 'local';

export const getServerBaseUrl = (): string =>
    (isNative || !!effectiveEnvUrl || import.meta.env.PROD === true) ? rawEnv : 'http://localhost:3000';
