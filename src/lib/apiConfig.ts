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

// ── Production base URL ───────────────────────────────────────────────────────
const rawEnv = (effectiveEnvUrl || 'https://sm-payroll-system.onrender.com')
    .replace(/\/api\/?$/, '')   // strip accidental trailing /api
    .replace(/\/$/, '');        // strip trailing slash

const PROD_API = `${rawEnv}/api`;

// ── Use production URL when: native app, valid env override, or prod build ────
const useProductionUrl =
    isNative ||
    !!effectiveEnvUrl ||
    import.meta.env.PROD === true;  // Vite sets PROD=true on all production builds

export const API_URL: string = useProductionUrl ? PROD_API : '/api';

export const getApiUrl = () => API_URL;

export const getEnvironmentMode = (): 'production' | 'local' =>
    useProductionUrl ? 'production' : 'local';

export const getServerBaseUrl = (): string =>
    useProductionUrl ? rawEnv : 'http://localhost:3000';
