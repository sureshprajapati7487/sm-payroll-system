/**
 * sw-custom.js — Custom Service Worker
 *
 * Features:
 * 1. Background Sync — offline mein data store karo, internet aane pe send karo
 * 2. Push Notifications — server se push receive karo
 * 3. Keep-alive ping — app "alive" rahega background mein
 * 4. Periodic Background Sync — regular intervals pe GPS data save karo
 */

// ── Install & Activate ────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
    console.log('[SW] Installing SM Payroll Service Worker...');
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    console.log('[SW] SM Payroll Service Worker activated');
    event.waitUntil(self.clients.claim());
});

// ── Background GPS Sync Queue ─────────────────────────────────────────────────
// App se GPS data SW ko bheja jata hai, SW background mein server pe POST karta hai
const GPS_SYNC_TAG = 'gps-location-sync';
const ATTENDANCE_SYNC_TAG = 'attendance-sync';

// ── Message Handler (App → SW communication) ─────────────────────────────────
self.addEventListener('message', async (event) => {
    const { type, payload } = event.data || {};

    switch (type) {
        case 'GPS_UPDATE':
            // Store latest GPS position in SW cache for background sync
            await storeGPSData(payload);
            break;

        case 'QUEUE_ATTENDANCE':
            // Queue attendance record for background sync
            await queueForSync(ATTENDANCE_SYNC_TAG, payload);
            break;

        case 'SKIP_WAITING':
            self.skipWaiting();
            break;

        case 'GET_QUEUED_COUNT': {
            const queue = await getQueue(ATTENDANCE_SYNC_TAG);
            event.source?.postMessage({ type: 'QUEUED_COUNT', count: queue.length });
            break;
        }
    }
});

// ── Background Sync ───────────────────────────────────────────────────────────
self.addEventListener('sync', async (event) => {
    console.log('[SW] Background sync triggered:', event.tag);

    if (event.tag === GPS_SYNC_TAG) {
        event.waitUntil(syncGPSData());
    }

    if (event.tag === ATTENDANCE_SYNC_TAG) {
        event.waitUntil(syncAttendance());
    }
});

// ── Periodic Background Sync (Chrome Android) ─────────────────────────────────
// Registered from the app with: registration.periodicSync.register(...)
self.addEventListener('periodicsync', async (event) => {
    console.log('[SW] Periodic sync:', event.tag);
    if (event.tag === 'sm-keepalive') {
        event.waitUntil(keepAlive());
    }
});

// ── Push Notifications ────────────────────────────────────────────────────────
self.addEventListener('push', (event) => {
    if (!event.data) return;
    let data = {};
    try { data = event.data.json(); } catch { data = { title: 'SM Payroll', body: event.data.text() }; }

    const { title = 'SM Payroll', body = '', icon = '/pwa-192x192.png', badge = '/pwa-192x192.png', url = '/' } = data;

    event.waitUntil(
        self.registration.showNotification(title, {
            body,
            icon,
            badge,
            tag: 'sm-payroll-notification',
            renotify: true,
            data: { url },
            actions: [
                { action: 'open', title: 'Open App' },
                { action: 'dismiss', title: 'Dismiss' },
            ],
            vibrate: [100, 50, 100],
        })
    );
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    if (event.action === 'dismiss') return;

    const url = event.notification.data?.url || '/';
    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
            for (const client of clients) {
                if (client.url.includes(self.location.origin) && 'focus' in client) {
                    client.focus();
                    if ('navigate' in client) client.navigate(url);
                    return;
                }
            }
            return self.clients.openWindow(url);
        })
    );
});

// ── IndexedDB Helpers ─────────────────────────────────────────────────────────
const DB_NAME = 'sm-payroll-sw-db';
const DB_VERSION = 1;

function openDB() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains('gps')) {
                db.createObjectStore('gps', { keyPath: 'id', autoIncrement: true });
            }
            if (!db.objectStoreNames.contains('queue')) {
                db.createObjectStore('queue', { keyPath: 'id', autoIncrement: true });
            }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

async function storeGPSData(data) {
    try {
        const db = await openDB();
        const tx = db.transaction('gps', 'readwrite');
        tx.objectStore('gps').put({ ...data, timestamp: Date.now() });
        // Keep only last 100 entries
        const all = await getAll(db, 'gps');
        if (all.length > 100) {
            const toDelete = all.slice(0, all.length - 100);
            for (const item of toDelete) {
                tx.objectStore('gps').delete(item.id);
            }
        }
        await txComplete(tx);
    } catch (e) {
        console.warn('[SW] storeGPSData error:', e);
    }
}

async function queueForSync(tag, data) {
    try {
        const db = await openDB();
        const tx = db.transaction('queue', 'readwrite');
        tx.objectStore('queue').add({ tag, data, timestamp: Date.now() });
        await txComplete(tx);
        // Register background sync
        await self.registration.sync.register(tag);
    } catch (e) {
        console.warn('[SW] queueForSync error:', e);
    }
}

async function getQueue(tag) {
    try {
        const db = await openDB();
        const all = await getAll(db, 'queue');
        return all.filter(item => item.tag === tag);
    } catch {
        return [];
    }
}

function getAll(db, storeName) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readonly');
        const req = tx.objectStore(storeName).getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
    });
}

function txComplete(tx) {
    return new Promise((resolve, reject) => {
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(new Error('Transaction aborted'));
    });
}

async function syncGPSData() {
    console.log('[SW] GPS sync — nothing to push (GPS data is local only)');
}

async function syncAttendance() {
    try {
        const queue = await getQueue(ATTENDANCE_SYNC_TAG);
        if (!queue.length) return;

        const db = await openDB();
        for (const item of queue) {
            try {
                // Attempt sync with server
                const r = await fetch('/api/attendance', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(item.data),
                });
                if (r.ok) {
                    // Remove from queue
                    const tx = db.transaction('queue', 'readwrite');
                    tx.objectStore('queue').delete(item.id);
                    await txComplete(tx);
                }
            } catch {
                // Keep in queue for next sync attempt
            }
        }
    } catch (e) {
        console.warn('[SW] syncAttendance error:', e);
    }
}

async function keepAlive() {
    console.log('[SW] Keep-alive ping at', new Date().toISOString());
    // Notify all open clients that SW is alive
    const clients = await self.clients.matchAll({ type: 'window' });
    for (const client of clients) {
        client.postMessage({ type: 'SW_ALIVE', timestamp: Date.now() });
    }
}
