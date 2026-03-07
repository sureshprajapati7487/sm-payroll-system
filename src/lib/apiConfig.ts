/**
 * apiConfig.ts — Central API URL resolver
 *
 * TWO usage patterns exist in this codebase:
 *  - authStore.ts:   ${API_URL}/auth/login          (no extra /api)
 *  - clientStore.ts: ${API_URL}/api/clients          (has extra /api)
 *
 * Therefore API_URL must always end with /api:
 *  - Dev:  '/api'                  → Vite proxy forwards to http://localhost:3000
 *  - Prod: 'https://....com/api'   → Direct call to Render backend
 *
 * IMPORTANT: Set VITE_API_URL in Vercel to: https://sm-payroll-system.onrender.com
 * Do NOT include /api at the end — this file adds it automatically.
 */

const rawEnv = (import.meta.env.VITE_API_URL || '').replace(/\/api\/?$/, '').replace(/\/$/, '');

// In dev (no VITE_API_URL): '/api'  → Vite proxy
// In prod (VITE_API_URL set): 'https://sm-payroll-system.onrender.com/api'
export const API_URL: string = rawEnv ? `${rawEnv}/api` : '/api';

export const getApiUrl = () => API_URL;
