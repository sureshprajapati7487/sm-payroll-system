import { useState, useEffect, useMemo, useRef } from 'react';
import { useClientStore, SalesClient, ClientVisitRecord, VisitOutcome } from '@/store/clientStore';
import { useEmployeeStore } from '@/store/employeeStore';
import { useAuthStore } from '@/store/authStore';
import { useMultiCompanyStore } from '@/store/multiCompanyStore';
import { useGeofence, GeofenceEvent } from '@/hooks/useGeofence';
import * as XLSX from 'xlsx';
import {
    MapPin, Phone, Clock, CheckSquare, LogIn, LogOut, Plus, Search,
    Upload, Trash2, Edit3, X, Check, AlertTriangle, TrendingUp,
    Eye, Navigation, Building2, User, Calendar, RefreshCw, Map, FileDown,
    ChevronDown, IndianRupee, Radar, Zap, History
} from 'lucide-react';

// ── Excel Download helper — Blob approach (works on HTTPS + LAN IP) ──────────
function downloadExcel(headers: string[], rows: (string | number | undefined | null | boolean)[][], filename: string, sheetName = 'Sheet1') {
    const wsData = [headers, ...rows.map(r => r.map(v => v ?? ''))];
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Auto column widths
    ws['!cols'] = headers.map((h, i) => {
        const maxLen = Math.max(h.length, ...rows.map(r => String(r[i] ?? '').length));
        return { wch: Math.min(maxLen + 4, 40) };
    });

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);

    // Write to binary array, then use Blob + anchor to force correct filename on HTTPS
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;          // ← correct .xlsx filename always set
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
}

// ── Demo File Download — proper .xlsx with sample rows ────────────────────────
function downloadDemoExcel() {
    const headers = ['name', 'shopName', 'ownerName', 'phone', 'phone2', 'address', 'city', 'state', 'pincode', 'type', 'category', 'notes'];
    const demo: string[][] = [
        ['Sharma Traders', 'Sharma General Store', 'Ramesh Sharma', '9876543210', '9876543211', 'Shop 12, Gandhi Nagar', 'Ahmedabad', 'Gujarat', '380009', 'RETAIL', 'Grocery', 'Regular customer'],
        ['Patel Wholesale', 'Patel Mart', 'Suresh Patel', '9988776655', '', 'Plot 5, GIDC', 'Surat', 'Gujarat', '395004', 'WHOLESALE', 'FMCG', 'Big order monthly'],
        ['Verma Medicals', 'Verma Pharmacy', 'Anil Verma', '9911223344', '9911223345', 'Near Bus Stand', 'Vadodara', 'Gujarat', '390001', 'RETAIL', 'Pharmacy', 'Cash buyer'],
        ['Singh Distributors', 'Singh & Co.', 'Harjeet Singh', '9877665544', '', 'Warehouse No 8, Phase 2', 'Rajkot', 'Gujarat', '360001', 'DISTRIBUTOR', 'Electronics', ''],
        ['Mehta Institutions', 'St. Mary School', 'Prakash Mehta', '9800011122', '', 'School Road, Sector 4', 'Gandhinagar', 'Gujarat', '382010', 'INSTITUTION', 'Education', 'Annual contract'],
    ];
    downloadExcel(headers, demo, 'demo_clients_import.xlsx', 'Sample Data');
}

// ── Export Clients to Excel (.xlsx) ──────────────────────────────────────────
function exportClientsToExcel(clients: SalesClient[], params: { companyId?: string; assignedTo?: string; status?: string }) {
    const filtered = clients.filter(c => {
        if (params.status && params.status !== 'ALL' && c.status !== params.status) return false;
        if (params.assignedTo && c.assignedTo !== params.assignedTo) return false;
        if (params.companyId && c.companyId !== params.companyId) return false;
        return true;
    });
    const headers = ['Code', 'Party Name', 'Shop Name', 'Owner Name', 'Mobile', 'Alt Mobile', 'Email', 'Category', 'Type', 'Status', 'Address', 'City', 'State', 'Pincode', 'Assigned To', 'Total Visits', 'Last Visit', 'Next Visit', 'Avg Visit (mins)', 'GPS Lat', 'GPS Lng', 'Credit Limit (Rs)', 'Outstanding (Rs)', 'Notes'];
    const rows = filtered.map(c => [
        c.code, c.name, c.shopName, c.ownerName,
        c.phone, c.phone2, c.email, c.category, c.type, c.status,
        c.address, c.city, c.state, c.pincode,
        c.assignedToName, c.totalVisits || 0,
        c.lastVisitAt ? new Date(c.lastVisitAt).toLocaleDateString('en-IN') : '',
        c.nextVisitDate || '',
        c.avgVisitMins || 0, c.latitude || '', c.longitude || '',
        c.creditLimit || 0, c.outstandingAmount || 0, c.notes || ''
    ]);
    const date = new Date().toISOString().split('T')[0];
    downloadExcel(headers, rows, `clients_${date}.xlsx`, 'Clients');
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtDuration(mins?: number) {
    if (!mins) return '—';
    if (mins < 60) return `${mins}m`;
    return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}
function fmtDate(iso?: string) {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' });
}
function fmtTime(iso?: string) {
    if (!iso) return '—';
    return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}
function daysSince(iso?: string) {
    if (!iso) return null;
    return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

const PURPOSE_META: Record<string, { label: string; color: string }> = {
    SALES: { label: 'Sales', color: 'text-blue-400' },
    COLLECTION: { label: 'Collection', color: 'text-green-400' },
    DEMO: { label: 'Demo', color: 'text-purple-400' },
    COMPLAINT: { label: 'Complaint', color: 'text-red-400' },
    FOLLOWUP: { label: 'Follow-up', color: 'text-yellow-400' },
    OTHER: { label: 'Other', color: 'text-gray-400' },
};
const OUTCOME_META: Record<string, { label: string; color: string }> = {
    ORDER_PLACED: { label: '✅ Order Placed', color: 'text-green-400' },
    NO_ORDER: { label: '⬜ No Order', color: 'text-slate-400' },
    FOLLOW_UP: { label: '🔄 Follow Up', color: 'text-yellow-400' },
    CLOSED: { label: '🔒 Closed', color: 'text-red-400' },
    COMPLAINT_RESOLVED: { label: '✅ Resolved', color: 'text-green-400' },
};

// ── GPS helper ────────────────────────────────────────────────────────────────
function getCurrentLocation(): Promise<{ lat: number; lng: number }> {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) return reject(new Error('GPS not available on this device'));
        navigator.geolocation.getCurrentPosition(
            p => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
            e => reject(new Error('GPS error: ' + e.message)),
            { enableHighAccuracy: true, timeout: 10000 }
        );
    });
}

// ── Delete Confirm Modal ──────────────────────────────────────────────────────
const DeleteConfirmModal = ({ client, onCancel, onConfirm, deleting }: {
    client: SalesClient;
    onCancel: () => void;
    onConfirm: () => void;
    deleting: boolean;
}) => (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onCancel} />
        <div className="relative glass rounded-2xl border border-red-500/30 w-full max-w-sm shadow-2xl shadow-red-500/10 overflow-hidden">
            {/* Red top bar */}
            <div className="h-1.5 w-full bg-gradient-to-r from-red-500 to-rose-600" />
            <div className="p-6 space-y-5">
                {/* Icon + Title */}
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-red-500/20 border border-red-500/30 flex items-center justify-center shrink-0">
                        <Trash2 className="w-6 h-6 text-red-400" />
                    </div>
                    <div>
                        <h2 className="text-white font-bold text-base">Party Delete Karein?</h2>
                        <p className="text-dark-muted text-xs mt-0.5">Ye action wapas nahi ho sakta</p>
                    </div>
                </div>

                {/* Party info box */}
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
                    <p className="text-red-300 font-bold text-sm">{client.name}</p>
                    {client.shopName && <p className="text-red-200/60 text-xs mt-0.5">{client.shopName}</p>}
                    {client.phone && <p className="text-red-200/60 text-xs">📞 {client.phone}</p>}
                    {client.totalVisits > 0 && (
                        <p className="text-yellow-400 text-xs mt-1">
                            ⚠️ Is party ki {client.totalVisits} visit record bhi delete ho jaayegi
                        </p>
                    )}
                </div>

                {/* Buttons */}
                <div className="flex gap-3">
                    <button
                        onClick={onCancel}
                        className="flex-1 py-2.5 rounded-xl border border-dark-border text-dark-muted hover:text-white hover:border-white/20 text-sm font-semibold transition-all"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={deleting}
                        className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-400 disabled:opacity-60 text-white text-sm font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-red-500/30"
                    >
                        {deleting
                            ? <><RefreshCw className="w-4 h-4 animate-spin" /> Deleting...</>
                            : <><Trash2 className="w-4 h-4" /> Haan, Delete Karo</>
                        }
                    </button>
                </div>
            </div>
        </div>
    </div>
);

// ── Add/Edit Client Modal ─────────────────────────────────────────────────────

const ClientModal = ({ client, salesEmployees, onClose, onSave }: {
    client?: SalesClient | null;
    salesEmployees: { id: string; name: string }[];
    onClose: () => void;
    onSave: (data: Partial<SalesClient>) => Promise<void>;
}) => {
    const [form, setForm] = useState<Partial<SalesClient>>(client || { type: 'RETAIL', status: 'ACTIVE' });
    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState('');

    const handleSave = async () => {
        if (!form.name?.trim()) return setErr('Party/Client name required');
        setSaving(true);
        try { await onSave(form); onClose(); } catch (e: any) { setErr(e.message); }
        setSaving(false);
    };

    const inp = 'w-full rounded-lg px-3 py-2 text-sm';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative glass rounded-2xl border border-dark-border w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
                <div className="flex items-center justify-between px-6 py-4 border-b border-dark-border sticky top-0 glass z-10">
                    <h2 className="text-white font-bold text-base">{client ? 'Edit Client/Party' : 'Add New Client/Party'}</h2>
                    <button onClick={onClose} className="text-dark-muted hover:text-white"><X className="w-5 h-5" /></button>
                </div>
                <div className="p-6 space-y-4">
                    {err && <div className="bg-red-500/15 border border-red-500/30 rounded-lg px-3 py-2 text-red-300 text-sm">{err}</div>}

                    <div className="grid grid-cols-2 gap-4">
                        <div><label className="text-xs text-dark-muted uppercase block mb-1">Party/Client Name *</label>
                            <input value={form.name || ''} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className={inp} placeholder="e.g. Sharma Traders" /></div>
                        <div><label className="text-xs text-dark-muted uppercase block mb-1">Shop Name</label>
                            <input value={form.shopName || ''} onChange={e => setForm(p => ({ ...p, shopName: e.target.value }))} className={inp} placeholder="Dukan ka naam" /></div>
                        <div><label className="text-xs text-dark-muted uppercase block mb-1">Owner Name</label>
                            <input value={form.ownerName || ''} onChange={e => setForm(p => ({ ...p, ownerName: e.target.value }))} className={inp} placeholder="Malik ka naam" /></div>
                        <div><label className="text-xs text-dark-muted uppercase block mb-1">Mobile Number</label>
                            <input value={form.phone || ''} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} className={inp} placeholder="+91 98765..." /></div>
                        <div><label className="text-xs text-dark-muted uppercase block mb-1">Alt. Mobile</label>
                            <input value={form.phone2 || ''} onChange={e => setForm(p => ({ ...p, phone2: e.target.value }))} className={inp} /></div>
                        <div><label className="text-xs text-dark-muted uppercase block mb-1">Category</label>
                            <input value={form.category || ''} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} className={inp} placeholder="e.g. Grocery, Pharmacy" /></div>
                        <div><label className="text-xs text-dark-muted uppercase block mb-1">Party Type</label>
                            <select value={form.type || 'RETAIL'} onChange={e => setForm(p => ({ ...p, type: e.target.value as any }))} className={inp}>
                                <option value="RETAIL">🏪 Retail</option>
                                <option value="WHOLESALE">📦 Wholesale</option>
                                <option value="DISTRIBUTOR">🚚 Distributor</option>
                                <option value="INSTITUTION">🏢 Institution</option>
                            </select></div>
                        <div><label className="text-xs text-dark-muted uppercase block mb-1">Status</label>
                            <select value={form.status || 'ACTIVE'} onChange={e => setForm(p => ({ ...p, status: e.target.value as any }))} className={inp}>
                                <option value="ACTIVE">🟢 Active</option>
                                <option value="PROSPECT">🟡 Prospect</option>
                                <option value="INACTIVE">⚫ Inactive</option>
                                <option value="BLOCKED">🔴 Blocked</option>
                            </select></div>
                        <div><label className="text-xs text-dark-muted uppercase block mb-1">Assign To Salesman</label>
                            <select value={form.assignedTo || ''} onChange={e => setForm(p => ({ ...p, assignedTo: e.target.value || undefined, assignedToName: salesEmployees.find(s => s.id === e.target.value)?.name }))} className={inp}>
                                <option value="">-- Unassigned --</option>
                                {salesEmployees.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select></div>
                        <div><label className="text-xs text-dark-muted uppercase block mb-1">Credit Limit (₹)</label>
                            <input type="number" value={form.creditLimit || 0} onChange={e => setForm(p => ({ ...p, creditLimit: +e.target.value }))} className={inp} /></div>
                        <div><label className="text-xs text-dark-muted uppercase block mb-1">Outstanding Amount (₹)</label>
                            <input type="number" value={form.outstandingAmount || 0} onChange={e => setForm(p => ({ ...p, outstandingAmount: +e.target.value }))} className={inp} /></div>
                        <div><label className="text-xs text-dark-muted uppercase block mb-1">City</label>
                            <input value={form.city || ''} onChange={e => setForm(p => ({ ...p, city: e.target.value }))} className={inp} /></div>
                        <div><label className="text-xs text-dark-muted uppercase block mb-1">State</label>
                            <input value={form.state || ''} onChange={e => setForm(p => ({ ...p, state: e.target.value }))} className={inp} /></div>
                    </div>
                    <div><label className="text-xs text-dark-muted uppercase block mb-1">Full Address</label>
                        <textarea value={form.address || ''} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} rows={2} className={`${inp} resize-none`} placeholder="Shop no, street, area..." /></div>
                    <div><label className="text-xs text-dark-muted uppercase block mb-1">Notes</label>
                        <textarea value={form.notes || ''} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={2} className={`${inp} resize-none`} /></div>

                    <div className="flex gap-3 pt-2">
                        <button onClick={onClose} className="flex-1 py-2 rounded-lg border border-dark-border text-dark-muted hover:text-white text-sm transition-colors">Cancel</button>
                        <button onClick={handleSave} disabled={saving} className="flex-1 py-2 rounded-lg bg-orange-500 hover:bg-orange-400 disabled:opacity-50 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors">
                            {saving ? <><RefreshCw className="w-4 h-4 animate-spin" /> Saving...</> : <><Check className="w-4 h-4" /> Save Party</>}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ── CheckOut Modal ────────────────────────────────────────────────────────────
const CheckOutModal = ({ visit, onClose, onCheckOut }: { visit: ClientVisitRecord; onClose: () => void; onCheckOut: (p: any) => Promise<void> }) => {
    const [form, setForm] = useState({ outcome: 'NO_ORDER' as VisitOutcome, orderAmount: 0, collectionAmount: 0, notes: '', nextVisitDate: '' });
    const [saving, setSaving] = useState(false);
    const inp = 'w-full rounded-lg px-3 py-2 text-sm';
    const handleCheckOut = async () => {
        setSaving(true);
        try {
            let lat, lng;
            try { const p = await getCurrentLocation(); lat = p.lat; lng = p.lng; } catch { }
            await onCheckOut({ ...form, lat, lng });
            onClose();
        } catch (e: any) { alert(e.message); }
        setSaving(false);
    };
    const elapsed = Math.round((Date.now() - new Date(visit.checkInAt).getTime()) / 60000);
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
            <div className="relative glass rounded-2xl border border-green-500/30 w-full max-w-md shadow-2xl">
                <div className="flex items-center justify-between px-6 py-4 border-b border-dark-border">
                    <h2 className="text-white font-bold flex items-center gap-2"><LogOut className="w-4 h-4 text-green-400" /> Check-Out</h2>
                    <button onClick={onClose} className="text-dark-muted hover:text-white"><X className="w-5 h-5" /></button>
                </div>
                <div className="p-6 space-y-4">
                    <div className="bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-3 text-center">
                        <p className="text-dark-muted text-xs">Time Elapsed</p>
                        <p className="text-2xl font-bold text-green-400">{fmtDuration(elapsed)}</p>
                        <p className="text-xs text-dark-muted">Check-in: {fmtTime(visit.checkInAt)}</p>
                    </div>
                    <div><label className="text-xs text-dark-muted uppercase block mb-1">Visit Outcome</label>
                        <select value={form.outcome} onChange={e => setForm(p => ({ ...p, outcome: e.target.value as VisitOutcome }))} className={inp}>
                            <option value="ORDER_PLACED">✅ Order Placed</option>
                            <option value="NO_ORDER">⬜ No Order</option>
                            <option value="FOLLOW_UP">🔄 Follow Up Needed</option>
                            <option value="CLOSED">🔒 Closed Lead</option>
                            <option value="COMPLAINT_RESOLVED">✅ Complaint Resolved</option>
                        </select></div>
                    <div className="grid grid-cols-2 gap-3">
                        <div><label className="text-xs text-dark-muted uppercase block mb-1">Order Amount (₹)</label>
                            <input type="number" value={form.orderAmount} onChange={e => setForm(p => ({ ...p, orderAmount: +e.target.value }))} className={inp} /></div>
                        <div><label className="text-xs text-dark-muted uppercase block mb-1">Collection (₹)</label>
                            <input type="number" value={form.collectionAmount} onChange={e => setForm(p => ({ ...p, collectionAmount: +e.target.value }))} className={inp} /></div>
                    </div>
                    <div><label className="text-xs text-dark-muted uppercase block mb-1">Next Visit Date</label>
                        <input type="date" value={form.nextVisitDate} onChange={e => setForm(p => ({ ...p, nextVisitDate: e.target.value }))} className={inp} /></div>
                    <div><label className="text-xs text-dark-muted uppercase block mb-1">Notes / Remarks</label>
                        <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={2} className={`${inp} resize-none`} placeholder="Visit ke baare mein..." /></div>
                    <button onClick={handleCheckOut} disabled={saving} className="w-full py-2.5 rounded-xl bg-green-500 hover:bg-green-400 disabled:opacity-50 text-white font-semibold flex items-center justify-center gap-2 transition-colors">
                        {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />} Check Out & Save
                    </button>
                </div>
            </div>
        </div>
    );
};

// ── Visit History Modal ───────────────────────────────────────────────────────
const VisitHistoryModal = ({ client, onClose }: { client: SalesClient; onClose: () => void }) => {
    const { visits, fetchVisits, loading } = useClientStore();
    useEffect(() => { fetchVisits({ clientId: client.id }); }, [client.id]);
    const clientVisits = visits.filter(v => v.clientId === client.id);
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative glass rounded-2xl border border-dark-border w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl">
                <div className="flex items-center justify-between px-6 py-4 border-b border-dark-border">
                    <div>
                        <h2 className="text-white font-bold">{client.name}</h2>
                        <p className="text-xs text-dark-muted">{client.shopName} — {clientVisits.length} total visits</p>
                    </div>
                    <button onClick={onClose} className="text-dark-muted hover:text-white"><X className="w-5 h-5" /></button>
                </div>
                {/* Stats row */}
                <div className="grid grid-cols-4 gap-3 px-5 py-3 border-b border-dark-border/50">
                    {[
                        { label: 'Total Visits', value: clientVisits.length, icon: '🔁' },
                        { label: 'Avg Duration', value: fmtDuration(client.avgVisitMins), icon: '⏱' },
                        { label: 'Last Visit', value: fmtDate(client.lastVisitAt), icon: '📅' },
                        { label: 'Next Visit', value: fmtDate(client.nextVisitDate), icon: '🗓' },
                    ].map(({ label, value, icon }) => (
                        <div key={label} className="text-center">
                            <p className="text-xl">{icon}</p>
                            <p className="text-white font-bold text-sm">{value}</p>
                            <p className="text-dark-muted text-[10px]">{label}</p>
                        </div>
                    ))}
                </div>
                {/* Visit list */}
                <div className="flex-1 overflow-y-auto divide-y divide-dark-border/30">
                    {loading && <div className="p-8 text-center text-dark-muted">Loading...</div>}
                    {!loading && clientVisits.length === 0 && (
                        <div className="p-12 text-center text-dark-muted">
                            <Clock className="w-10 h-10 mx-auto mb-3 opacity-30" />
                            <p>Abhi tak koi visit nahi hua</p>
                        </div>
                    )}
                    {clientVisits.map((v, i) => (
                        <div key={v.id} className="px-5 py-3.5 hover:bg-white/5 transition-colors">
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-primary-500/20 flex items-center justify-center text-primary-400 text-xs font-bold shrink-0">
                                        #{v.visitNumber || (clientVisits.length - i)}
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <p className="text-white text-sm font-semibold">{fmtDate(v.checkInAt)}</p>
                                            <span className={`text-xs ${PURPOSE_META[v.purpose || 'OTHER']?.color}`}>{PURPOSE_META[v.purpose || 'OTHER']?.label}</span>
                                            {v.outcome && <span className={`text-xs ${OUTCOME_META[v.outcome]?.color}`}>{OUTCOME_META[v.outcome]?.label}</span>}
                                        </div>
                                        <p className="text-xs text-dark-muted mt-0.5">
                                            {fmtTime(v.checkInAt)} — {v.checkOutAt ? fmtTime(v.checkOutAt) : '⏳ Active'} ({fmtDuration(v.durationMins)})
                                            {v.salesmanName && ` • ${v.salesmanName}`}
                                        </p>
                                        {v.notes && <p className="text-xs text-dark-muted mt-0.5 italic">"{v.notes}"</p>}
                                    </div>
                                </div>
                                <div className="text-right shrink-0">
                                    {(v.orderAmount || 0) > 0 && <p className="text-green-400 text-xs font-semibold">₹{v.orderAmount?.toLocaleString()}</p>}
                                    {(v.collectionAmount || 0) > 0 && <p className="text-blue-400 text-xs">₹{v.collectionAmount?.toLocaleString()} coll.</p>}
                                    {v.distanceFromClient != null && (
                                        <p className={`text-[10px] ${v.distanceFromClient < 200 ? 'text-green-400' : v.distanceFromClient < 500 ? 'text-yellow-400' : 'text-red-400'}`}>
                                            📍 {v.distanceFromClient}m
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

// ── Bulk Import Modal ─────────────────────────────────────────────────────────
const BulkImportModal = ({
    companyId, salesEmployees, onClose, onImport
}: {
    companyId: string;
    salesEmployees: { id: string; name: string }[];
    onClose: () => void;
    onImport: (data: any[], cid: string) => Promise<void>;
}) => {
    const [assignTo, setAssignTo] = useState('');
    const [parsed, setParsed] = useState<any[]>([]);
    const [preview, setPreview] = useState<any[]>([]);
    const [importing, setImporting] = useState(false);
    const [tab, setTab] = useState<'file' | 'paste'>('file');
    const [csv, setCsv] = useState('');
    const [fileName, setFileName] = useState('');
    const [dragOver, setDragOver] = useState(false);
    const [errMsg, setErrMsg] = useState('');
    const fileRef = useRef<HTMLInputElement>(null);

    const normalise = (rows: any[]) => {
        setErrMsg('');
        const result = rows.map(row => {
            const obj: any = {};
            Object.keys(row).forEach(k => { obj[k.trim().toLowerCase()] = String(row[k] ?? '').trim(); });
            return { ...obj, companyId, assignedTo: assignTo || undefined, assignedToName: salesEmployees.find(s => s.id === assignTo)?.name };
        }).filter(r => r.name);
        if (!result.length) { setErrMsg('⚠️ Koi valid row nahi mili. "name" column zaroor hona chahiye.'); return; }
        setParsed(result); setPreview(result.slice(0, 5));
    };

    const readFile = (file: File) => {
        setFileName(file.name);
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target!.result as ArrayBuffer);
                const wb = XLSX.read(data, { type: 'array' });
                const ws = wb.Sheets[wb.SheetNames[0]];
                const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
                normalise(rows);
            } catch { setErrMsg('❌ File read error. Valid .xlsx ya .csv file select karo.'); }
        };
        reader.readAsArrayBuffer(file);
    };

    const parseCSVText = (text: string) => {
        setCsv(text);
        const lines = text.trim().split('\n').filter(Boolean);
        if (lines.length < 2) return;
        const header = lines[0].split(',').map(h => h.trim().toLowerCase());
        const rows = lines.slice(1).map(line => {
            const vals = line.split(','); const obj: any = {};
            header.forEach((h, i) => { obj[h] = (vals[i] || '').trim(); });
            return obj;
        });
        normalise(rows);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault(); setDragOver(false);
        const file = e.dataTransfer.files[0]; if (file) readFile(file);
    };

    const doImport = async () => {
        if (!parsed.length) return;
        setImporting(true);
        try { await onImport(parsed, companyId); onClose(); }
        catch (e: any) { alert(e.message); }
        setImporting(false);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
            <div className="relative glass rounded-2xl border border-dark-border w-full max-w-2xl max-h-[85vh] overflow-y-auto shadow-2xl">
                <div className="flex items-center justify-between px-6 py-4 border-b border-dark-border">
                    <h2 className="text-white font-bold flex items-center gap-2"><Upload className="w-4 h-4 text-blue-400" /> Bulk Import Clients</h2>
                    <button onClick={onClose} className="text-dark-muted hover:text-white"><X className="w-5 h-5" /></button>
                </div>
                <div className="p-6 space-y-4">
                    {/* Steps guide */}
                    <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 text-xs text-blue-300 space-y-1">
                        <p className="font-bold text-blue-200">📌 Import karne ke steps:</p>
                        <p>1️⃣  <strong>"Demo File"</strong> button se sample Excel download karo</p>
                        <p>2️⃣  Us file mein apna data fill karo (header row mat hatao)</p>
                        <p>3️⃣  Neeche green box mein <strong>woh file select karo</strong></p>
                        <p>4️⃣  Preview check karo → <strong>"Import" button</strong> dabao ✅</p>
                    </div>
                    {/* Tab bar */}
                    <div className="flex gap-1 bg-dark-border/20 rounded-xl p-1 w-fit border border-dark-border">
                        {[
                            { key: 'file', label: '📂 File Upload (.xlsx / .csv)' },
                            { key: 'paste', label: '📋 CSV Paste' },
                        ].map(({ key, label }) => (
                            <button key={key} onClick={() => setTab(key as 'file' | 'paste')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${tab === key ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'text-dark-muted hover:text-white'
                                    }`}>{label}</button>
                        ))}
                    </div>

                    {/* FILE UPLOAD ZONE */}
                    {tab === 'file' && (
                        <div
                            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                            onDragLeave={() => setDragOver(false)}
                            onDrop={handleDrop}
                            onClick={() => fileRef.current?.click()}
                            className={`cursor-pointer rounded-2xl border-2 border-dashed p-10 flex flex-col items-center justify-center gap-3 transition-all select-none ${dragOver ? 'border-blue-400 bg-blue-500/10'
                                : parsed.length ? 'border-green-500/50 bg-green-500/5'
                                    : 'border-dark-border hover:border-green-500/40 hover:bg-green-500/5'
                                }`}>
                            <div className="w-14 h-14 rounded-2xl bg-green-500/15 flex items-center justify-center">
                                <FileDown className="w-7 h-7 text-green-400" />
                            </div>
                            {parsed.length > 0 ? (
                                <>
                                    <p className="text-green-400 font-bold text-sm">✅ {fileName}</p>
                                    <p className="text-green-300 text-xs font-medium">{parsed.length} clients ready to import</p>
                                    <p className="text-xs text-dark-muted underline">Doosri file select karo</p>
                                </>
                            ) : (
                                <>
                                    <p className="text-white font-semibold text-sm">Excel / CSV file yahan click karke select karo</p>
                                    <p className="text-dark-muted text-xs">Ya file ko yahan drag &amp; drop karo</p>
                                    <div className="flex items-center gap-3 mt-1">
                                        <span className="px-2 py-1 rounded bg-green-500/15 text-green-400 text-[11px] font-bold">.xlsx Excel</span>
                                        <span className="px-2 py-1 rounded bg-blue-500/15 text-blue-400 text-[11px] font-bold">.csv</span>
                                    </div>
                                </>
                            )}
                            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
                                onChange={e => { const f = e.target.files?.[0]; if (f) readFile(f); e.target.value = ''; }}
                            />
                        </div>
                    )}

                    {/* CSV PASTE ZONE */}
                    {tab === 'paste' && (
                        <div>
                            <label className="text-xs text-dark-muted uppercase block mb-1">CSV Data Paste Karo</label>
                            <p className="text-[10px] text-dark-muted font-mono mb-2">name,shopName,ownerName,phone,phone2,address,city,state,pincode,type,category,notes</p>
                            <textarea value={csv} onChange={e => parseCSVText(e.target.value)} rows={8}
                                className="w-full rounded-lg px-3 py-2 text-sm font-mono resize-none"
                                placeholder={'name,shopName,phone,...\nSharma Traders,Sharma Store,9876543210,...'}
                            />
                        </div>
                    )}

                    {/* Error */}
                    {errMsg && <p className="text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{errMsg}</p>}
                    {/* Assign To */}
                    <div>
                        <label className="text-xs text-dark-muted uppercase block mb-1">Assign All to Salesman (Optional)</label>
                        <select value={assignTo} onChange={e => setAssignTo(e.target.value)} className="w-full rounded-lg px-3 py-2 text-sm">
                            <option value="">-- Unassigned --</option>
                            {salesEmployees.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                    </div>
                    {/* Preview Table */}
                    {preview.length > 0 && (
                        <div>
                            <p className="text-xs text-dark-muted mb-2">👀 Preview (first 5 of <strong className="text-white">{parsed.length}</strong> clients)</p>
                            <div className="overflow-x-auto rounded-xl border border-dark-border">
                                <table className="text-xs w-full">
                                    <thead className="bg-dark-border/30">
                                        <tr>{['name', 'shopname', 'phone', 'city', 'type'].map(k => <th key={k} className="px-3 py-2 text-dark-muted text-left capitalize">{k}</th>)}</tr>
                                    </thead>
                                    <tbody>
                                        {preview.map((r, i) => (
                                            <tr key={i} className="border-t border-dark-border/20">
                                                {['name', 'shopname', 'phone', 'city', 'type'].map(k => <td key={k} className="px-3 py-2 text-white truncate max-w-[120px]">{r[k] || '—'}</td>)}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Buttons */}
                    <div className="flex gap-3 pt-1">
                        <button onClick={onClose} className="flex-1 py-2 rounded-lg border border-dark-border text-dark-muted hover:text-white text-sm transition-colors">Cancel</button>
                        <button onClick={doImport} disabled={importing || !parsed.length}
                            className="flex-1 py-2.5 rounded-xl bg-blue-500 hover:bg-blue-400 disabled:opacity-40 text-white text-sm font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-500/20">
                            {importing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                            {parsed.length > 0 ? `🚀 Import ${parsed.length} Clients` : 'Pehle File Select Karo'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ── Geofence Event Log ────────────────────────────────────────────────────────
const GeofenceEventLog = ({ events, onClear }: { events: GeofenceEvent[]; onClear: () => void }) => {
    if (!events.length) return null;
    return (
        <div className="glass rounded-2xl border border-purple-500/20 overflow-hidden">
            <div className="px-5 py-3 border-b border-purple-500/20 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <History className="w-4 h-4 text-purple-400" />
                    <h3 className="text-white font-bold text-sm">Geofence Events</h3>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400 font-semibold">{events.length}</span>
                </div>
                <button onClick={onClear} className="text-xs text-dark-muted hover:text-white transition-colors">Clear</button>
            </div>
            <div className="divide-y divide-dark-border/30 max-h-[260px] overflow-y-auto">
                {events.map(ev => (
                    <div key={ev.id} className={`px-5 py-3 flex items-start gap-3 ${ev.type === 'ENTERED' ? 'hover:bg-green-500/5' : 'hover:bg-red-500/5'}`}>
                        <div className={`mt-0.5 w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${ev.type === 'ENTERED' ? 'bg-green-500/20' : 'bg-red-500/20'
                            }`}>
                            {ev.type === 'ENTERED'
                                ? <LogIn className="w-3.5 h-3.5 text-green-400" />
                                : <LogOut className="w-3.5 h-3.5 text-red-400" />
                            }
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                                <p className="text-white font-semibold text-sm">{ev.clientName}</p>
                                {ev.shopName && <span className="text-xs text-dark-muted">• {ev.shopName}</span>}
                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold border ${ev.type === 'ENTERED'
                                    ? 'bg-green-500/20 text-green-400 border-green-500/30'
                                    : 'bg-red-500/20 text-red-400 border-red-500/30'
                                    }`}>
                                    {ev.type === 'ENTERED' ? '🟢 Entered' : '🔴 Exited'}
                                </span>
                            </div>
                            <div className="flex items-center gap-3 mt-0.5 text-xs text-dark-muted flex-wrap">
                                {ev.distanceMetres != null && <span>📍 {ev.distanceMetres}m</span>}
                                {ev.durationMins != null && (
                                    <span className="font-semibold text-orange-400">⏱ {ev.durationMins} min ruke</span>
                                )}
                                <span>{new Date(ev.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

// ── Main Component ────────────────────────────────────────────────────────────
export const ClientListPage = () => {
    const { clients, fetchClients, addClient, updateClient, deleteClient, bulkImportClients, setClientLocation, checkIn, checkOut, fetchActiveVisit, activeVisit, loading } = useClientStore();
    const { employees } = useEmployeeStore();
    const { user } = useAuthStore();
    const { currentCompanyId } = useMultiCompanyStore();

    const [search, setSearch] = useState('');
    const [filterStatus, setFilterStatus] = useState('ALL');
    const [filterAssigned, setFilterAssigned] = useState('');
    const [modalClient, setModalClient] = useState<SalesClient | null | false>(false); // false=closed, null=new
    const [historyClient, setHistoryClient] = useState<SalesClient | null>(null);
    const [checkOutVisit, setCheckOutVisit] = useState<ClientVisitRecord | null>(null);
    const [showBulk, setShowBulk] = useState(false);
    const [gpsLoading, setGpsLoading] = useState<string | null>(null);
    // Update 3 — Purpose Chooser: tracks { clientId, purpose } during check-in flow
    const [checkingIn, setCheckingIn] = useState<{ clientId: string; purpose: string } | null>(null);
    // purposePickerFor: clientId for which the purpose dropdown is open
    const [purposePickerFor, setPurposePickerFor] = useState<string | null>(null);
    // deleteConfirm: client to delete (null = no dialog open)
    const [deleteConfirm, setDeleteConfirm] = useState<SalesClient | null>(null);
    const [deleting, setDeleting] = useState(false);

    const salesEmployees = useMemo(() => employees.filter(e => {
        const d = (e.department || '').toUpperCase();
        return d.includes('SALES') || d.includes('SALESMAN');
    }), [employees]);

    useEffect(() => {
        if (currentCompanyId) {
            fetchClients({ companyId: currentCompanyId });
            if (user?.id) fetchActiveVisit(user.id);
        }
        // fetchClients + fetchActiveVisit — Zustand stable actions (safe)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentCompanyId, user?.id]);

    const filtered = useMemo(() => {
        let list = clients;
        if (filterStatus !== 'ALL') list = list.filter(c => c.status === filterStatus);
        if (filterAssigned) list = list.filter(c => c.assignedTo === filterAssigned);
        if (search.trim()) {
            const q = search.toLowerCase();
            list = list.filter(c => c.name.toLowerCase().includes(q) || c.shopName?.toLowerCase().includes(q) || c.phone?.includes(q) || c.city?.toLowerCase().includes(q) || c.code?.toLowerCase().includes(q));
        }
        return list;
    }, [clients, filterStatus, filterAssigned, search]);

    const handleSetLocation = async (clientId: string) => {
        setGpsLoading(clientId);
        try {
            const { lat, lng } = await getCurrentLocation();
            await setClientLocation(clientId, lat, lng, user?.id || '');
            alert(`✅ Location set!\nLat: ${lat.toFixed(6)}\nLng: ${lng.toFixed(6)}`);
        } catch (e: any) { alert('GPS Error: ' + e.message); }
        setGpsLoading(null);
    };

    const handleCheckIn = async (client: SalesClient, purpose: string = 'SALES') => {
        if (!user?.id) return;
        setCheckingIn({ clientId: client.id, purpose });
        setPurposePickerFor(null);
        try {
            let lat, lng;
            try { const p = await getCurrentLocation(); lat = p.lat; lng = p.lng; } catch { }
            await checkIn({ companyId: currentCompanyId!, clientId: client.id, salesmanId: user.id, salesmanName: user.name, lat, lng, purpose: purpose as any });
        } catch (e: any) { alert('Check-in Error: ' + e.message); }
        setCheckingIn(null);
    };

    const activeClientId = activeVisit?.visit?.clientId;
    const isActiveVisit = !!activeVisit;

    // ── Geofence Hook ─────────────────────────────────────────────────────────
    const [geofenceEnabled, setGeofenceEnabled] = useState(true);
    const { isTracking, nearbyClient, nearbyDistanceM, events: geoEvents, clearEvents, gpsError } = useGeofence({
        salesmanId: user?.id,
        salesmanName: user?.name,
        companyId: currentCompanyId || undefined,
        clients,
        // radiusMetres: not passed — useGeofence will auto-read from System Settings → Salesman Config
        enabled: geofenceEnabled,
    });

    // Stats for top KPIs
    const totalClients = clients.length;
    const activeClients = clients.filter(c => c.status === 'ACTIVE').length;
    const noLocation = clients.filter(c => !c.latitude).length;
    const today = new Date().toISOString().split('T')[0];
    const overdue = clients.filter(c => c.nextVisitDate && c.nextVisitDate < today && c.status === 'ACTIVE').length;

    return (
        <div className="space-y-6">

            {/* ── Geofence Status Banner ── */}
            <div className={`rounded-2xl border px-5 py-3.5 flex items-center gap-3 flex-wrap ${isTracking
                ? nearbyClient
                    ? 'bg-green-500/10 border-green-500/40'
                    : 'bg-purple-500/10 border-purple-500/30'
                : 'bg-dark-surface/50 border-dark-border'
                }`}>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isTracking ? (nearbyClient ? 'bg-green-500/20' : 'bg-purple-500/20') : 'bg-dark-border/30'
                    }`}>
                    <Radar className={`w-4 h-4 ${isTracking ? (nearbyClient ? 'text-green-400 animate-pulse' : 'text-purple-400 animate-pulse') : 'text-dark-muted'
                        }`} />
                </div>
                <div className="flex-1 min-w-0">
                    {isTracking ? (
                        nearbyClient ? (
                            <>
                                <p className="text-green-300 font-bold text-sm flex items-center gap-2">
                                    <Zap className="w-3.5 h-3.5" />
                                    Auto: {nearbyClient.name}
                                    {nearbyDistanceM != null && <span className="text-green-400/70 font-normal text-xs">({nearbyDistanceM}m)</span>}
                                </p>
                                <p className="text-green-200/70 text-xs">{nearbyClient.shopName || nearbyClient.city || ''} — 50m radius mein ho</p>
                            </>
                        ) : (
                            <>
                                <p className="text-purple-300 font-semibold text-sm">🛰️ Geofence Active — Koi client paas nahi</p>
                                <p className="text-purple-200/60 text-xs">50m radius mein aate hi auto check-in ho jayega</p>
                            </>
                        )
                    ) : (
                        <>
                            <p className="text-dark-muted font-semibold text-sm">Geofence: Off</p>
                            {gpsError && <p className="text-red-400 text-xs">{gpsError}</p>}
                        </>
                    )}
                </div>
                {/* Toggle */}
                <button
                    onClick={() => setGeofenceEnabled(p => !p)}
                    className={`relative w-11 h-6 rounded-full transition-all duration-300 shrink-0 ${geofenceEnabled ? 'bg-purple-500' : 'bg-dark-border'
                        }`}
                    title={geofenceEnabled ? 'Geofence band karo' : 'Geofence chalu karo'}
                >
                    <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all duration-300 ${geofenceEnabled ? 'left-5' : 'left-0.5'
                        }`} />
                </button>
            </div>

            {/* ── Geofence Event Log ── */}
            {geoEvents.length > 0 && <GeofenceEventLog events={geoEvents} onClear={clearEvents} />}

            {/* Active visit banner */}
            {isActiveVisit && activeVisit?.visit && (
                <div className="bg-green-500/15 border border-green-500/40 rounded-2xl px-5 py-4 flex items-center gap-4 flex-wrap">
                    <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center shrink-0">
                        <LogIn className="w-5 h-5 text-green-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-green-300 font-bold text-sm">✅ Currently Checked-In</p>
                        <p className="text-green-200 text-xs">{activeVisit.client?.name} • {activeVisit.client?.shopName} • Since {fmtTime(activeVisit.visit?.checkInAt)}</p>
                    </div>
                    <button onClick={() => setCheckOutVisit(activeVisit.visit)} className="px-4 py-2 bg-green-500 hover:bg-green-400 text-white rounded-xl text-sm font-semibold flex items-center gap-2 transition-colors">
                        <LogOut className="w-4 h-4" /> Check-Out Now
                    </button>
                </div>
            )}

            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center"><Building2 className="w-5 h-5 text-blue-400" /></div>
                        Client / Party List
                    </h1>
                    <p className="text-dark-muted mt-1">Salesman-wise client tracking with GPS & visit history</p>
                </div>
                <div className="flex gap-2 flex-wrap">
                    {/* Demo Download */}
                    <button onClick={downloadDemoExcel} title="Demo Excel file download karo — isi format mein data bharo aur import karo" className="flex items-center gap-2 px-3 py-2 bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 rounded-xl text-sm font-semibold border border-purple-500/30 transition-all">
                        <FileDown className="w-4 h-4" /> Demo File
                    </button>
                    {/* Export Excel */}
                    <button onClick={() => exportClientsToExcel(clients, { companyId: currentCompanyId || undefined, assignedTo: filterAssigned || undefined, status: filterStatus })} disabled={filtered.length === 0} title="Current filtered clients ko Excel mein export karo" className="flex items-center gap-2 px-3 py-2 bg-green-500/20 hover:bg-green-500/30 disabled:opacity-40 text-green-400 rounded-xl text-sm font-semibold border border-green-500/30 transition-all">
                        <FileDown className="w-4 h-4" /> Export Excel
                    </button>
                    {/* Bulk Import */}
                    <button onClick={() => setShowBulk(true)} className="flex items-center gap-2 px-3 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-xl text-sm font-semibold border border-blue-500/30 transition-all">
                        <Upload className="w-4 h-4" /> Bulk Import
                    </button>
                    <button onClick={() => setModalClient(null)} className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-400 text-white rounded-xl text-sm font-semibold transition-all shadow-lg shadow-orange-500/20">
                        <Plus className="w-4 h-4" /> Add Client
                    </button>
                </div>
            </div>

            {/* KPI Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                    { label: 'Total Clients', value: totalClients, icon: Building2, color: 'text-blue-400', bg: 'bg-blue-500/10' },
                    { label: 'Active', value: activeClients, icon: CheckSquare, color: 'text-green-400', bg: 'bg-green-500/10' },
                    { label: 'No GPS Yet', value: noLocation, icon: MapPin, color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
                    { label: 'Overdue Visits', value: overdue, icon: AlertTriangle, color: 'text-red-400', bg: 'bg-red-500/10' },
                ].map(({ label, value, icon: Icon, color, bg }) => (
                    <div key={label} className="glass rounded-xl border border-dark-border p-4 flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg ${bg} flex items-center justify-center shrink-0`}><Icon className={`w-5 h-5 ${color}`} /></div>
                        <div><p className="text-dark-muted text-xs">{label}</p><p className={`text-2xl font-bold ${color}`}>{value}</p></div>
                    </div>
                ))}
            </div>

            {/* Search + Filters */}
            <div className="glass rounded-xl border border-dark-border p-4 flex gap-3 flex-wrap">
                <div className="flex-1 min-w-[200px] relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-muted" />
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search client, shop, phone, city..." className="w-full pl-9 pr-3 py-2 rounded-lg text-sm" />
                </div>
                <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="rounded-lg px-3 py-2 text-sm">
                    <option value="ALL">All Status</option>
                    <option value="ACTIVE">Active</option>
                    <option value="PROSPECT">Prospect</option>
                    <option value="INACTIVE">Inactive</option>
                    <option value="BLOCKED">Blocked</option>
                </select>
                <select value={filterAssigned} onChange={e => setFilterAssigned(e.target.value)} className="rounded-lg px-3 py-2 text-sm">
                    <option value="">All Salesmen</option>
                    {salesEmployees.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <button onClick={() => fetchClients({ companyId: currentCompanyId! })} className="px-3 py-2 rounded-lg bg-dark-border/30 hover:bg-dark-border/50 text-dark-muted hover:text-white transition-colors">
                    <RefreshCw className="w-4 h-4" />
                </button>
            </div>

            {/* Client List */}
            <div className="glass rounded-2xl border border-dark-border overflow-hidden">
                <div className="px-5 py-3 border-b border-dark-border flex items-center justify-between">
                    <p className="text-white font-semibold text-sm">{filtered.length} Clients</p>
                    {filtered.length > 0 && (
                        <button onClick={() => exportClientsToExcel(clients, { companyId: currentCompanyId || undefined, assignedTo: filterAssigned || undefined, status: filterStatus })} className="flex items-center gap-1.5 text-xs text-green-400 hover:text-green-300 font-semibold transition-colors">
                            <FileDown className="w-3.5 h-3.5" /> Export {filtered.length} to Excel
                        </button>
                    )}
                </div>
                {loading && <div className="p-12 text-center text-dark-muted">Loading clients...</div>}
                {!loading && filtered.length === 0 && (
                    <div className="p-16 text-center space-y-3">
                        <Building2 className="w-12 h-12 mx-auto text-dark-muted opacity-30" />
                        <p className="text-dark-muted">Koi client nahi mila</p>
                        <button onClick={() => setModalClient(null)} className="px-4 py-2 bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 rounded-lg text-sm font-semibold transition-colors">+ Add First Client</button>
                    </div>
                )}
                <div className="divide-y divide-dark-border/30 max-h-[600px] overflow-y-auto">
                    {filtered.map(client => {
                        const isActive = client.id === activeClientId;
                        const ds = daysSince(client.lastVisitAt);
                        const isOverdue = client.nextVisitDate && client.nextVisitDate < today;
                        return (
                            <div key={client.id} className={`px-5 py-4 hover:bg-white/5 transition-colors group ${isActive ? 'bg-green-500/5 border-l-2 border-green-500' : ''}`}>
                                <div className="flex items-start gap-4">
                                    {/* Left: Info */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap mb-1">
                                            <p className="text-white font-semibold text-sm">{client.name}</p>
                                            {client.shopName && <span className="text-xs text-dark-muted">• {client.shopName}</span>}
                                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold border ${client.status === 'ACTIVE' ? 'bg-green-500/20 text-green-400 border-green-500/30' :
                                                client.status === 'PROSPECT' ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' :
                                                    client.status === 'BLOCKED' ? 'bg-red-500/20 text-red-400 border-red-500/30' :
                                                        'bg-slate-500/20 text-slate-400 border-slate-500/30'
                                                }`}>{client.status}</span>
                                            {isOverdue && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30 font-bold">⚠️ Overdue</span>}
                                            {isActive && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-500/20 text-green-400 border border-green-500/30 font-bold animate-pulse">🟢 Active Visit</span>}
                                        </div>
                                        <div className="flex items-center gap-3 text-xs text-dark-muted flex-wrap">
                                            {client.code && <span className="font-mono">{client.code}</span>}
                                            {client.type && <span className="capitalize">{client.type.toLowerCase()}</span>}
                                            {client.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{client.phone}</span>}
                                            {client.city && <span>📍 {client.city}</span>}
                                            {client.assignedToName && <span className="flex items-center gap-1"><User className="w-3 h-3" />{client.assignedToName}</span>}
                                        </div>
                                        <div className="flex items-center gap-3 text-[11px] mt-1.5 flex-wrap">
                                            <span className={`flex items-center gap-1 ${client.latitude ? 'text-green-400' : 'text-yellow-400'}`}>
                                                <MapPin className="w-3 h-3" />
                                                {client.latitude ? '✅ GPS Set' : '⚠️ GPS Pending'}
                                            </span>
                                            <span className="text-dark-muted flex items-center gap-1"><TrendingUp className="w-3 h-3" />{client.totalVisits || 0} visits</span>
                                            {client.avgVisitMins > 0 && <span className="text-dark-muted flex items-center gap-1"><Clock className="w-3 h-3" />avg {fmtDuration(client.avgVisitMins)}</span>}
                                            {ds != null && <span className={`flex items-center gap-1 ${ds > 30 ? 'text-red-400' : ds > 14 ? 'text-yellow-400' : 'text-dark-muted'}`}><Calendar className="w-3 h-3" />{ds === 0 ? 'Today' : `${ds}d ago`}</span>}
                                            {/* Update 4 — Outstanding Amount Color Warning */}
                                            {(client.outstandingAmount || 0) > 0 && (() => {
                                                const outstanding = client.outstandingAmount || 0;
                                                const limit = client.creditLimit || 0;
                                                const overLimit = limit > 0 && outstanding >= limit;
                                                const halfLimit = limit > 0 && outstanding >= limit * 0.5;
                                                const colorClass = overLimit ? 'text-red-400' : halfLimit ? 'text-yellow-400' : 'text-orange-400';
                                                return (
                                                    <span className={`flex items-center gap-1 font-semibold ${colorClass}`}>
                                                        <IndianRupee className="w-3 h-3" />
                                                        {outstanding.toLocaleString('en-IN')} due
                                                        {overLimit && (
                                                            <span className="text-[9px] px-1 py-0.5 rounded bg-red-500/20 border border-red-500/30 font-bold">⛔ Over Limit</span>
                                                        )}
                                                    </span>
                                                );
                                            })()}
                                        </div>
                                    </div>

                                    {/* Right: Action Buttons — always visible */}
                                    <div className="flex items-center gap-1 shrink-0">
                                        {/* View History */}
                                        <button onClick={() => setHistoryClient(client)} title="Visit History" className="p-1.5 rounded-lg hover:bg-dark-border/50 text-dark-muted hover:text-white transition-colors">
                                            <Eye className="w-3.5 h-3.5" />
                                        </button>
                                        {/* Set GPS */}
                                        <button onClick={() => handleSetLocation(client.id)} disabled={gpsLoading === client.id} title={client.latitude ? 'Update GPS Location' : 'Set GPS Location'} className={`p-1.5 rounded-lg transition-colors ${client.latitude ? 'hover:bg-dark-border/50 text-dark-muted hover:text-green-400' : 'bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30'}`}>
                                            {gpsLoading === client.id ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Navigation className="w-3.5 h-3.5" />}
                                        </button>
                                        {/* Check In / Google Maps */}
                                        {client.latitude && (
                                            <a href={`https://maps.google.com/?q=${client.latitude},${client.longitude}`} target="_blank" rel="noreferrer" title="Open in Google Maps" className="p-1.5 rounded-lg hover:bg-dark-border/50 text-dark-muted hover:text-blue-400 transition-colors">
                                                <Map className="w-3.5 h-3.5" />
                                            </a>
                                        )}
                                        {/* Update 3 — Check In with Purpose Chooser */}
                                        {!isActiveVisit && (
                                            <div className="relative">
                                                {checkingIn?.clientId === client.id ? (
                                                    <button disabled className="px-2 py-1 rounded-lg bg-primary-500/20 text-primary-400 text-xs font-semibold flex items-center gap-1">
                                                        <RefreshCw className="w-3 h-3 animate-spin" /> Checking in...
                                                    </button>
                                                ) : purposePickerFor === client.id ? (
                                                    <div className="absolute right-0 bottom-full mb-1 z-20 glass rounded-xl border border-dark-border shadow-2xl p-2 min-w-[160px]">
                                                        <p className="text-[10px] text-dark-muted font-semibold uppercase px-2 mb-1">Visit Purpose</p>
                                                        {[
                                                            { key: 'SALES', label: '🛒 Sales' },
                                                            { key: 'COLLECTION', label: '💰 Collection' },
                                                            { key: 'DEMO', label: '🎯 Demo' },
                                                            { key: 'COMPLAINT', label: '⚠️ Complaint' },
                                                            { key: 'FOLLOWUP', label: '🔄 Follow-up' },
                                                            { key: 'OTHER', label: '📝 Other' },
                                                        ].map(({ key, label }) => (
                                                            <button
                                                                key={key}
                                                                onClick={() => handleCheckIn(client, key)}
                                                                className="w-full text-left px-3 py-1.5 rounded-lg hover:bg-primary-500/20 text-white text-xs transition-colors"
                                                            >
                                                                {label}
                                                            </button>
                                                        ))}
                                                        <button onClick={() => setPurposePickerFor(null)} className="w-full text-center text-[10px] text-dark-muted hover:text-white mt-1 transition-colors">Cancel</button>
                                                    </div>
                                                ) : null}
                                                {purposePickerFor !== client.id && checkingIn?.clientId !== client.id && (
                                                    <button
                                                        onClick={() => setPurposePickerFor(client.id)}
                                                        title="Select Purpose & Check In"
                                                        className="px-2 py-1 rounded-lg bg-primary-500/20 hover:bg-primary-500/30 text-primary-400 text-xs font-semibold transition-colors flex items-center gap-1"
                                                    >
                                                        <LogIn className="w-3 h-3" /> Visit <ChevronDown className="w-2.5 h-2.5" />
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                        {isActive && (
                                            <button onClick={() => setCheckOutVisit(activeVisit!.visit)} className="px-2 py-1 rounded-lg bg-green-500/20 hover:bg-green-500/30 text-green-400 text-xs font-semibold transition-colors flex items-center gap-1">
                                                <LogOut className="w-3 h-3" /> Out
                                            </button>
                                        )}
                                        {/* Edit */}
                                        <button onClick={() => setModalClient(client)} className="p-1.5 rounded-lg hover:bg-dark-border/50 text-dark-muted hover:text-white transition-colors">
                                            <Edit3 className="w-3.5 h-3.5" />
                                        </button>
                                        {/* Delete */}
                                        <button
                                            onClick={() => setDeleteConfirm(client)}
                                            title="Party Delete Karo"
                                            className="p-1.5 rounded-lg bg-red-500/15 hover:bg-red-500/30 text-red-400 hover:text-red-300 transition-colors"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>

                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Modals */}
            {modalClient !== false && (
                <ClientModal client={modalClient} salesEmployees={salesEmployees.map(e => ({ id: e.id, name: e.name }))} onClose={() => setModalClient(false)}
                    onSave={async (data) => {
                        const payload = { ...data, companyId: currentCompanyId || undefined };
                        if (modalClient?.id) await updateClient(modalClient.id, payload);
                        else await addClient(payload);
                    }} />
            )}
            {historyClient && <VisitHistoryModal client={historyClient} onClose={() => setHistoryClient(null)} />}
            {checkOutVisit && <CheckOutModal visit={checkOutVisit} onClose={() => setCheckOutVisit(null)} onCheckOut={async (p) => { await checkOut(checkOutVisit.id, p); }} />}
            {showBulk && <BulkImportModal companyId={currentCompanyId!} salesEmployees={salesEmployees.map(e => ({ id: e.id, name: e.name }))} onClose={() => setShowBulk(false)} onImport={async (data, cid) => { await bulkImportClients(data, cid); }} />}

            {/* ── Custom Delete Confirm Modal ── */}
            {deleteConfirm && (
                <DeleteConfirmModal
                    client={deleteConfirm}
                    deleting={deleting}
                    onCancel={() => { if (!deleting) setDeleteConfirm(null); }}
                    onConfirm={async () => {
                        setDeleting(true);
                        try {
                            await deleteClient(deleteConfirm.id);
                            setDeleteConfirm(null);
                        } catch (e: any) {
                            alert('Delete failed: ' + e.message);
                        }
                        setDeleting(false);
                    }}
                />
            )}

        </div>
    );
};
