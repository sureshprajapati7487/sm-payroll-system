import { useState, useMemo, useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useProductionStore } from '@/store/productionStore';
import { useEmployeeStore } from '@/store/employeeStore';
import { useMultiCompanyStore } from '@/store/multiCompanyStore';
import { apiFetch } from '@/lib/apiClient';
import { PERMISSIONS } from '@/config/permissions';
import { ProductionEntry } from '@/types';
import {
    Plus, CheckCircle, XCircle, Clock, Factory, Search,
    Download, Users, BarChart3, FileSpreadsheet, FileText,
    TrendingUp, Calendar, ChevronDown, RefreshCw, Trophy,
    Pencil, Trash2, Save, X, CheckCheck, Tag, PackageSearch
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer, Legend,
    BarChart, PieChart, Pie, Cell
} from 'recharts';
import { clsx } from 'clsx';
import { SearchableSelect as ItemSelect } from '@/components/ui/SearchableSelect';
import { EmployeeSearchableSelect } from '@/components/ui/EmployeeSearchableSelect';
import { InfoTip } from '@/components/ui/InfoTip';
import { useRateStore } from '@/store/rateStore';
import { RateManager } from './RateManager';
import { BulkEntryForm } from './BulkEntryForm';
import { exportToExcel } from '@/utils/exportUtils';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

// ── Date helpers ──────────────────────────────────────────────────────────────
const today = () => new Date().toISOString().split('T')[0];
const firstOfMonth = () => {
    const d = new Date(); d.setDate(1);
    return d.toISOString().split('T')[0];
};
const firstOfWeek = () => {
    const d = new Date();
    const day = d.getDay();
    d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
    return d.toISOString().split('T')[0];
};

const fmt = (d: string) => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' });

type ViewMode = 'daily' | 'summary' | 'items' | 'chart';
type QuickRange = 'today' | 'week' | 'month' | 'custom';

export const ProductionDashboard = () => {
    const { user, hasPermission } = useAuthStore();
    const { employees } = useEmployeeStore();
    const { entries, addEntry, approveEntry, rejectEntry, updateEntry, deleteEntry, fetchProductionEntries } = useProductionStore();
    const { fetchItems } = useRateStore();
    const currentCompanyId = useMultiCompanyStore(s => s.currentCompanyId);

    // Initial Fetch
    useEffect(() => {
        if (!currentCompanyId) return;
        fetchProductionEntries(currentCompanyId);
        fetchItems(currentCompanyId);
    }, [currentCompanyId, fetchProductionEntries, fetchItems]);

    // ── Edit / Delete State ────────────────────────────────────────────────────
    const [editEntry, setEditEntry] = useState<ProductionEntry | null>(null);
    const [editForm, setEditForm] = useState({ date: '', item: '', qty: '', rate: '' });
    const [editStatus, setEditStatus] = useState<'IDLE' | 'SAVING' | 'SUCCESS'>('IDLE');
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

    const openEdit = (entry: ProductionEntry) => {
        setEditEntry(entry);
        setEditForm({ date: entry.date, item: entry.item, qty: String(entry.qty), rate: String(entry.rate) });
        setEditStatus('IDLE');
    };

    const handleEditSave = async () => {
        if (!editEntry) return;
        if (!editForm.date || !editForm.item || !editForm.qty || !editForm.rate) return;
        setEditStatus('SAVING');
        const qty = Number(editForm.qty);
        const rate = Number(editForm.rate);
        await updateEntry(editEntry.id, {
            date: editForm.date,
            item: editForm.item,
            qty,
            rate,
            totalAmount: qty * rate,
        });
        setEditStatus('SUCCESS');
        setTimeout(() => { setEditEntry(null); setEditStatus('IDLE'); }, 900);
    };

    const handleDelete = async (id: string) => {
        await deleteEntry(id);
        setDeleteConfirmId(null);
    };

    // ── Bulk Approve State (only state + handlers here; useMemo after filteredEntries below)
    const [showBulkApproveConfirm, setShowBulkApproveConfirm] = useState(false);
    const [bulkApproveStatus, setBulkApproveStatus] = useState<'IDLE' | 'APPROVING' | 'DONE'>('IDLE');

    const [form, setForm] = useState({
        employeeId: user?.role === 'EMPLOYEE' ? user.id : '',
        date: today(),
        itemId: '',
        item: '',
        qty: '',
        rate: '',
    });

    // ── Date Range ─────────────────────────────────────────────────────────────
    const [quickRange, setQuickRange] = useState<QuickRange>('today');
    const [startDate, setStartDate] = useState(today());
    const [endDate, setEndDate] = useState(today());

    const applyQuick = (range: QuickRange) => {
        setQuickRange(range);
        if (range === 'today') { setStartDate(today()); setEndDate(today()); }
        else if (range === 'week') { setStartDate(firstOfWeek()); setEndDate(today()); }
        else if (range === 'month') { setStartDate(firstOfMonth()); setEndDate(today()); }
    };

    // ── Analytics State ───────────────────────────────────────────────────────
    const [analytics, setAnalytics] = useState({
        employeeSummary: [] as any[],
        itemSummary: [] as any[],
        chartData: [] as any[]
    });

    useEffect(() => {
        if (!currentCompanyId) return;
        const fetchAnalytics = async () => {
            try {
                const res = await apiFetch(`/production/analytics?companyId=${currentCompanyId}&startDate=${startDate}&endDate=${endDate}`);
                if (res.ok) setAnalytics(await res.json());
            } finally { }
        };
        fetchAnalytics();
    }, [currentCompanyId, startDate, endDate]);

    // ── View & Other state ────────────────────────────────────────────────────
    const [viewMode, setViewMode] = useState<ViewMode>('daily');
    const [searchTerm, setSearchTerm] = useState('');
    const [showRateManager, setShowRateManager] = useState(false);
    const [showBulkEntry, setShowBulkEntry] = useState(false);
    const [isManual, setIsManual] = useState(true);
    const [status, setStatus] = useState<'IDLE' | 'SUCCESS' | 'ERROR'>('IDLE');
    const [errors, setErrors] = useState<string[]>([]);
    const [showExportMenu, setShowExportMenu] = useState(false);
    const [deptFilter, setDeptFilter] = useState('All');
    const [chartType, setChartType] = useState<'date' | 'employee' | 'item'>('date');
    const [itemSort, setItemSort] = useState<'amount' | 'qty' | 'entries'>('amount');

    // Dept list for filter dropdown
    const departments = useMemo(() => {
        const depts = new Set<string>();
        employees.forEach(e => { if (e.department) depts.add(e.department); });
        return ['All', ...Array.from(depts).sort()];
    }, [employees]);

    const canAdd = hasPermission(PERMISSIONS.ADD_PRODUCTION);
    const canApprove = hasPermission(PERMISSIONS.APPROVE_PRODUCTION);
    const canBulkAdd = hasPermission(PERMISSIONS.BULK_PRODUCTION_ENTRY);
    const canManageRates = hasPermission(PERMISSIONS.MANAGE_PRODUCTION_RATES);
    const isEmployee = user?.role === 'EMPLOYEE';

    // ── Filtered entries (date range) ─────────────────────────────────────────
    const filteredEntries = useMemo(() => entries.filter(e => {
        const dateOk = e.date >= startDate && e.date <= endDate;
        const empOk = isEmployee ? e.employeeId === user?.id : true;
        const emp = employees.find(em => em.id === e.employeeId);
        const searchOk = !searchTerm ||
            e.item.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (emp?.name?.toLowerCase() || '').includes(searchTerm.toLowerCase());
        const deptOk = deptFilter === 'All' || (emp?.department || '') === deptFilter;
        return dateOk && empOk && searchOk && deptOk;
    }), [entries, startDate, endDate, searchTerm, isEmployee, user, employees, deptFilter]);

    // ── Stats ─────────────────────────────────────────────────────────────────
    const totalApproved = filteredEntries.reduce((s, e) => e.status === 'APPROVED' ? s + e.totalAmount : s, 0);
    const totalPending = filteredEntries.reduce((s, e) => e.status === 'PENDING' ? s + e.totalAmount : s, 0);
    const pendingCount = filteredEntries.filter(e => e.status === 'PENDING').length;

    // ── Bulk Approve (depends on filteredEntries) ─────────────────────────────
    const pendingEntries = useMemo(
        () => filteredEntries.filter(e => e.status === 'PENDING'),
        [filteredEntries]
    );

    const handleBulkApprove = async () => {
        setBulkApproveStatus('APPROVING');
        await Promise.all(pendingEntries.map(e => approveEntry(e.id)));
        setBulkApproveStatus('DONE');
        setTimeout(() => {
            setShowBulkApproveConfirm(false);
            setBulkApproveStatus('IDLE');
        }, 1200);
    };

    // ── Aggregation mappings to Analytics payload ─────────────────────────────
    const employeeSummary = analytics.employeeSummary;
    const itemSummary = analytics.itemSummary;
    const chartData = analytics.chartData.map(d => ({ ...d, label: fmt(d.date) }));

    // ── Form submit ───────────────────────────────────────────────────────────
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const missing: string[] = [];
        if (!form.employeeId) missing.push('employeeId');
        if (!form.item) missing.push('item');
        if (!form.qty) missing.push('qty');
        if (!form.rate) missing.push('rate');
        if (!form.date) missing.push('date');
        if (missing.length > 0) { setErrors(missing); setStatus('ERROR'); setTimeout(() => { setStatus('IDLE'); setErrors([]); }, 3000); return; }
        await addEntry({
            companyId: currentCompanyId || undefined,
            date: form.date,
            employeeId: form.employeeId,
            item: form.item,
            itemId: isManual ? undefined : form.itemId,
            qty: Number(form.qty),
            rate: Number(form.rate)
        });
        setForm(prev => ({ ...prev, item: '', itemId: '', qty: '', rate: '' }));
        setErrors([]); setStatus('SUCCESS');
        setTimeout(() => setStatus('IDLE'), 2000);
    };

    // ── Export ────────────────────────────────────────────────────────────────
    const handleExportExcel = () => {
        const data = filteredEntries.map(e => {
            const emp = employees.find(em => em.id === e.employeeId);
            return {
                Date: e.date, Employee: emp?.name || '-', Department: emp?.department || '-',
                Item: e.item, Qty: e.qty, 'Rate (₹)': e.rate,
                'Total (₹)': e.totalAmount, Status: e.status,
            };
        });
        exportToExcel(data, `Production_${startDate}_to_${endDate}`, user);
        setShowExportMenu(false);
    };

    const handleExportSummaryExcel = () => {
        const data = employeeSummary.map((s, i) => ({
            Rank: i + 1, Employee: s.name, Department: s.dept,
            'Total Qty': s.totalQty, Entries: s.entries,
            'Approved (₹)': s.approved, 'Pending (₹)': s.pending,
            'Rejected (₹)': s.rejected, 'Total Earned (₹)': s.approved + s.pending,
        }));
        exportToExcel(data, `Production_Summary_${startDate}_to_${endDate}`, user);
        setShowExportMenu(false);
    };

    const handleExportPDF = () => {
        const doc = new jsPDF({ orientation: 'landscape' });
        doc.setFontSize(16); doc.text('SM Payroll — Production Report', 14, 15);
        doc.setFontSize(10); doc.text(`Period: ${fmt(startDate)} → ${fmt(endDate)}`, 14, 23);
        doc.text(`Generated: ${new Date().toLocaleString('en-IN')}`, 14, 29);
        const rows = filteredEntries.map(e => {
            const emp = employees.find(em => em.id === e.employeeId);
            return [e.date, emp?.name || '-', e.item, e.qty, `₹${e.rate}`, `₹${e.totalAmount}`, e.status];
        });
        (doc as any).autoTable({
            head: [['Date', 'Employee', 'Item', 'Qty', 'Rate', 'Total', 'Status']],
            body: rows, startY: 35,
            styles: { fontSize: 8, cellPadding: 2 },
            headStyles: { fillColor: [37, 99, 235] },
        });
        const finalY = (doc as any).lastAutoTable.finalY + 8;
        doc.setFontSize(11);
        doc.text(`Total Approved: ₹${totalApproved.toLocaleString('en-IN')}`, 14, finalY);
        doc.text(`Total Pending: ₹${totalPending.toLocaleString('en-IN')}`, 80, finalY);
        if (user) {
            doc.setFontSize(7);
            doc.setTextColor(160, 160, 160);
            const ph = doc.internal.pageSize.height || doc.internal.pageSize.getHeight();
            doc.text(`CONFIDENTIAL — ${user.role} DATA | Downloaded by ${user.name} on ${new Date().toLocaleString()}`, 14, ph - 8);
            doc.setTextColor(0, 0, 0);
        }
        doc.save(`Production_Report_${startDate}_${endDate}.pdf`);
        setShowExportMenu(false);
    };

    const handleExportSummaryPDF = () => {
        const doc = new jsPDF();
        doc.setFontSize(16); doc.text('SM Payroll — Employee Production Summary', 14, 15);
        doc.setFontSize(10); doc.text(`Period: ${fmt(startDate)} → ${fmt(endDate)}`, 14, 23);
        const rows = employeeSummary.map((s, i) => [
            i + 1, s.name, s.dept, s.totalQty, s.entries,
            `₹${s.approved.toLocaleString('en-IN')}`, `₹${s.pending.toLocaleString('en-IN')}`,
            `₹${(s.approved + s.pending).toLocaleString('en-IN')}`,
        ]);
        (doc as any).autoTable({
            head: [['#', 'Employee', 'Dept', 'Qty', 'Entries', 'Approved', 'Pending', 'Total']],
            body: rows, startY: 30,
            styles: { fontSize: 9, cellPadding: 2 },
            headStyles: { fillColor: [5, 150, 105] },
        });
        if (user) {
            doc.setFontSize(7);
            doc.setTextColor(160, 160, 160);
            const ph = doc.internal.pageSize.height || doc.internal.pageSize.getHeight();
            doc.text(`CONFIDENTIAL — ${user.role} DATA | Downloaded by ${user.name} on ${new Date().toLocaleString()}`, 14, ph - 8);
        }
        doc.save(`Production_Summary_${startDate}_${endDate}.pdf`);
        setShowExportMenu(false);
    };

    return (
        <div className="space-y-5" onClick={() => showExportMenu && setShowExportMenu(false)}>

            {/* ── Header ── */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white mb-0.5">Production & Work</h1>
                    <p className="text-dark-muted text-sm">Track quantity, rates, and approval workflow</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    {canBulkAdd && (
                        <button onClick={() => setShowBulkEntry(true)}
                            className="bg-primary-600 hover:bg-primary-500 text-white px-3 py-2 rounded-lg border border-primary-500/50 transition-colors flex items-center gap-2 text-xs font-bold">
                            <Users className="w-4 h-4" /> Bulk Entry
                        </button>
                    )}
                    {canManageRates && (
                        <button onClick={() => setShowRateManager(true)}
                            className="bg-primary-600/20 hover:bg-primary-600/30 text-primary-400 p-2 rounded-lg border border-primary-500/30 transition-colors" title="Manage Rates">
                            <Factory className="w-4 h-4" />
                        </button>
                    )}

                    {/* Bulk Approve — only show when there are pending entries + canApprove */}
                    {canApprove && pendingEntries.length > 0 && (
                        <button
                            onClick={() => setShowBulkApproveConfirm(true)}
                            className="relative flex items-center gap-2 px-3 py-2 bg-success/20 hover:bg-success/30 text-success border border-success/40 rounded-lg text-xs font-bold transition-all animate-pulse hover:animate-none"
                        >
                            <CheckCheck className="w-4 h-4" />
                            Bulk Approve
                            <span className="absolute -top-1.5 -right-1.5 bg-success text-white text-[9px] font-black rounded-full w-4 h-4 flex items-center justify-center shadow">
                                {pendingEntries.length}
                            </span>
                        </button>
                    )}

                    {/* Search */}
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-muted" />
                        <input type="text" placeholder="Search item or employee..."
                            value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                            className="bg-dark-card border border-dark-border rounded-lg pl-9 pr-3 py-2 text-sm text-white focus:outline-none focus:border-primary-500 w-48" />
                    </div>

                    {/* Department Filter */}
                    {!isEmployee && departments.length > 2 && (
                        <div className="relative">
                            <select
                                value={deptFilter}
                                onChange={e => setDeptFilter(e.target.value)}
                                className={clsx(
                                    'bg-dark-card border rounded-lg px-3 py-2 text-xs text-white focus:outline-none transition-all appearance-none pr-7 cursor-pointer',
                                    deptFilter !== 'All'
                                        ? 'border-primary-500/70 text-primary-300 bg-primary-900/30'
                                        : 'border-dark-border hover:border-dark-muted'
                                )}
                            >
                                {departments.map(d => (
                                    <option key={d} value={d}>{d}</option>
                                ))}
                            </select>
                            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-dark-muted pointer-events-none" />
                            {deptFilter !== 'All' && (
                                <button
                                    onClick={() => setDeptFilter('All')}
                                    className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-primary-600 text-white text-[8px] flex items-center justify-center hover:bg-danger transition-colors"
                                    title="Clear filter"
                                >✕</button>
                            )}
                        </div>
                    )}

                    {/* Export dropdown */}
                    <div className="relative" onClick={e => e.stopPropagation()}>
                        <button onClick={() => setShowExportMenu(v => !v)}
                            className="flex items-center gap-2 px-3 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 rounded-lg text-xs font-bold transition-all">
                            <Download className="w-3.5 h-3.5" /> Export <ChevronDown className="w-3 h-3" />
                        </button>
                        {showExportMenu && (
                            <div className="absolute right-0 top-full mt-1.5 bg-dark-card border border-dark-border rounded-xl shadow-2xl z-50 min-w-[210px] overflow-hidden">
                                <div className="p-2 border-b border-dark-border">
                                    <p className="text-[10px] text-dark-muted uppercase tracking-wider font-bold px-2 py-1">Detailed Entries</p>
                                    <button onClick={handleExportExcel} className="w-full flex items-center gap-3 px-3 py-2 hover:bg-dark-bg rounded-lg text-sm text-white transition-colors">
                                        <FileSpreadsheet className="w-4 h-4 text-emerald-400" /> Excel (.xlsx)
                                    </button>
                                    <button onClick={handleExportPDF} className="w-full flex items-center gap-3 px-3 py-2 hover:bg-dark-bg rounded-lg text-sm text-white transition-colors">
                                        <FileText className="w-4 h-4 text-red-400" /> PDF Report
                                    </button>
                                </div>
                                <div className="p-2">
                                    <p className="text-[10px] text-dark-muted uppercase tracking-wider font-bold px-2 py-1">Employee Summary</p>
                                    <button onClick={handleExportSummaryExcel} className="w-full flex items-center gap-3 px-3 py-2 hover:bg-dark-bg rounded-lg text-sm text-white transition-colors">
                                        <FileSpreadsheet className="w-4 h-4 text-emerald-400" /> Summary Excel
                                    </button>
                                    <button onClick={handleExportSummaryPDF} className="w-full flex items-center gap-3 px-3 py-2 hover:bg-dark-bg rounded-lg text-sm text-white transition-colors">
                                        <FileText className="w-4 h-4 text-red-400" /> Summary PDF
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ── Date Range Filter ── */}
            <div className="glass p-3 rounded-xl flex flex-col sm:flex-row items-start sm:items-center gap-3">
                {/* Quick range buttons */}
                <div className="flex gap-1.5">
                    {([['today', 'Today'], ['week', 'This Week'], ['month', 'This Month'], ['custom', 'Custom']] as [QuickRange, string][]).map(([key, label]) => (
                        <button key={key} onClick={() => applyQuick(key)} className={clsx(
                            'px-3 py-1.5 rounded-lg text-xs font-bold transition-all',
                            quickRange === key
                                ? 'bg-primary-600 text-white shadow-lg shadow-primary-600/20'
                                : 'bg-dark-bg text-dark-muted hover:text-white hover:bg-dark-border'
                        )}>{label}</button>
                    ))}
                </div>

                {/* Date inputs */}
                <div className="flex items-center gap-2 ml-auto">
                    <Calendar className="w-3.5 h-3.5 text-dark-muted" />
                    <input type="date" value={startDate}
                        onChange={e => { setStartDate(e.target.value); setQuickRange('custom'); }}
                        className="bg-dark-bg border border-dark-border rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:border-primary-500" />
                    <span className="text-dark-muted text-xs">→</span>
                    <input type="date" value={endDate} min={startDate}
                        onChange={e => { setEndDate(e.target.value); setQuickRange('custom'); }}
                        className="bg-dark-bg border border-dark-border rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:border-primary-500" />
                    <span className="text-[10px] text-dark-muted border border-dark-border rounded px-2 py-1 bg-dark-bg whitespace-nowrap">
                        {filteredEntries.length} entries
                    </span>
                </div>
            </div>

            {/* ── KPI Cards ── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="glass p-3 rounded-xl border-l-4 border-emerald-500">
                    <p className="text-[10px] text-dark-muted font-bold uppercase tracking-wider">Approved Amount</p>
                    <p className="text-xl font-bold text-white mt-0.5">₹{totalApproved.toLocaleString('en-IN')}</p>
                    <p className="text-[10px] text-emerald-400 flex items-center gap-1 mt-0.5">
                        <CheckCircle className="w-3 h-3" /> {filteredEntries.filter(e => e.status === 'APPROVED').length} entries
                    </p>
                </div>
                <div className="glass p-3 rounded-xl border-l-4 border-yellow-500">
                    <p className="text-[10px] text-dark-muted font-bold uppercase tracking-wider">Pending Review</p>
                    <p className="text-xl font-bold text-white mt-0.5">₹{totalPending.toLocaleString('en-IN')}</p>
                    <p className="text-[10px] text-yellow-400 flex items-center gap-1 mt-0.5">
                        <Clock className="w-3 h-3" /> {pendingCount} entries
                    </p>
                </div>
                <div className="glass p-3 rounded-xl border-l-4 border-blue-500">
                    <p className="text-[10px] text-dark-muted font-bold uppercase tracking-wider">Total Entries</p>
                    <p className="text-xl font-bold text-white mt-0.5">{filteredEntries.length}</p>
                    <p className="text-[10px] text-blue-400 flex items-center gap-1 mt-0.5">
                        <Factory className="w-3 h-3" /> {employeeSummary.length} employees
                    </p>
                </div>
                <div className="glass p-3 rounded-xl border-l-4 border-purple-500">
                    <p className="text-[10px] text-dark-muted font-bold uppercase tracking-wider">Top Performer</p>
                    <p className="text-sm font-bold text-white mt-0.5 truncate">{employeeSummary[0]?.name || '—'}</p>
                    <p className="text-[10px] text-purple-400 flex items-center gap-1 mt-0.5">
                        <Trophy className="w-3 h-3" /> ₹{(employeeSummary[0]?.approved || 0).toLocaleString('en-IN')}
                    </p>
                </div>
            </div>

            {/* ── View Toggle ── */}
            <div className="flex items-center gap-2">
                <button onClick={() => setViewMode('daily')} className={clsx(
                    'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all',
                    viewMode === 'daily' ? 'bg-primary-600 text-white shadow-lg' : 'bg-dark-card text-dark-muted hover:text-white hover:bg-dark-border'
                )}><Factory className="w-3.5 h-3.5" /> Daily Entries</button>
                <button onClick={() => setViewMode('summary')} className={clsx(
                    'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all',
                    viewMode === 'summary' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20' : 'bg-dark-card text-dark-muted hover:text-white hover:bg-dark-border'
                )}><BarChart3 className="w-3.5 h-3.5" /> Monthly Summary</button>
                <button onClick={() => setViewMode('items')} className={clsx(
                    'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all',
                    viewMode === 'items' ? 'bg-violet-600 text-white shadow-lg shadow-violet-600/20' : 'bg-dark-card text-dark-muted hover:text-white hover:bg-dark-border'
                )}><Tag className="w-3.5 h-3.5" /> Item Summary</button>
                <button onClick={() => setViewMode('chart')} className={clsx(
                    'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all',
                    viewMode === 'chart' ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/20' : 'bg-dark-card text-dark-muted hover:text-white hover:bg-dark-border'
                )}><TrendingUp className="w-3.5 h-3.5" /> Chart</button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* ── LEFT: Entry Form ── */}
                {canAdd && viewMode === 'daily' && (
                    <div className="glass p-4 rounded-xl h-fit">
                        <h3 className="font-bold text-white mb-3 flex items-center gap-2 text-sm">
                            <Plus className="w-4 h-4 text-primary-500" /> New Entry
                        </h3>
                        <form onSubmit={handleSubmit} className="space-y-3">
                            <div>
                                <label className="block text-[10px] text-dark-muted mb-1 uppercase tracking-wider font-bold"><InfoTip id="productionDate" label="Work Date" /></label>
                                <input required type="date" value={form.date}
                                    onChange={e => setForm({ ...form, date: e.target.value })}
                                    className={clsx('w-full bg-dark-bg border rounded-md px-2 py-1.5 text-xs text-white focus:border-primary-500 outline-none',
                                        errors.includes('date') ? 'border-danger' : 'border-dark-border')} />
                            </div>
                            {!isEmployee && (
                                <div>
                                    <label className="block text-[10px] text-dark-muted mb-1 uppercase tracking-wider font-bold"><InfoTip id="productionWorker" label="Employee" /></label>
                                    <div className={clsx('rounded-md', errors.includes('employeeId') && 'border border-danger')}>
                                        <EmployeeSearchableSelect
                                            employees={employees.filter(e =>
                                                e.department?.toLowerCase().includes('production') ||
                                                e.department?.toLowerCase().includes('tailor') ||
                                                e.department?.toLowerCase().includes('karigar') ||
                                                e.designation?.toLowerCase().includes('operator')
                                            )}
                                            selectedId={form.employeeId}
                                            currentUserId={user?.id || ''}
                                            onSelect={id => setForm({ ...form, employeeId: id })}
                                        />
                                    </div>
                                </div>
                            )}
                            <div>
                                <div className="flex justify-between items-center mb-1">
                                    <label className="block text-[10px] text-dark-muted uppercase tracking-wider font-bold"><InfoTip id="productionUnits" label="Item / Work" /></label>
                                    <button type="button" onClick={() => { setIsManual(!isManual); setForm(p => ({ ...p, item: '', itemId: '', rate: '' })); }}
                                        className="text-[9px] text-primary-400 hover:text-primary-300 underline">
                                        {isManual ? 'Use Master List' : 'Manual Entry'}
                                    </button>
                                </div>
                                {isManual ? (
                                    <input type="text" placeholder="Type Item Name..."
                                        value={form.item} onChange={e => setForm({ ...form, item: e.target.value, itemId: '' })}
                                        className={clsx('w-full bg-dark-bg border rounded-md px-2 py-1.5 text-xs text-white focus:border-primary-500 outline-none',
                                            errors.includes('item') ? 'border-danger' : 'border-dark-border')} />
                                ) : (
                                    <ItemSelect options={useRateStore.getState().items.map(i => ({ value: i.id, label: i.name, subLabel: `₹${i.rate}` }))}
                                        value={form.itemId || form.item}
                                        onChange={val => {
                                            const item = useRateStore.getState().getItem(val);
                                            if (item) setForm(p => ({ ...p, item: item.name, itemId: item.id, rate: item.rate.toString() }));
                                        }} placeholder="Select from Master..." />
                                )}
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-[10px] text-dark-muted mb-1 uppercase tracking-wider font-bold"><InfoTip id="productionUnits" label="Quantity" /></label>
                                    <input type="number" placeholder="0" value={form.qty}
                                        onChange={e => setForm({ ...form, qty: e.target.value })}
                                        className={clsx('w-full bg-dark-bg border rounded-md px-2 py-1.5 text-xs text-white focus:border-primary-500 outline-none',
                                            errors.includes('qty') ? 'border-danger' : 'border-dark-border')} />
                                </div>
                                <div>
                                    <label className="block text-[10px] text-dark-muted mb-1 uppercase tracking-wider font-bold"><InfoTip id="ratePerUnit" label="Rate (₹)" /></label>
                                    <input type="number" placeholder="0" value={form.rate}
                                        onChange={e => setForm({ ...form, rate: e.target.value })}
                                        className={clsx('w-full bg-dark-bg border rounded-md px-2 py-1.5 text-xs text-white focus:border-primary-500 outline-none',
                                            errors.includes('rate') ? 'border-danger' : 'border-dark-border')} />
                                </div>
                            </div>
                            {form.qty && form.rate && (
                                <div className="p-2 bg-dark-bg/50 rounded-md flex justify-between items-center text-xs">
                                    <span className="text-dark-muted">Total Amount</span>
                                    <span className="text-success font-bold text-base">₹ {Number(form.qty) * Number(form.rate)}</span>
                                </div>
                            )}
                            <button type="submit" disabled={status === 'SUCCESS'}
                                className={clsx('w-full py-2 rounded-lg transition-all font-bold flex items-center justify-center gap-2 text-xs uppercase tracking-wider',
                                    status === 'SUCCESS' ? 'bg-success text-white' :
                                        status === 'ERROR' ? 'bg-danger text-white' :
                                            'bg-primary-600 hover:bg-primary-500 text-white shadow-lg shadow-primary-500/20 active:scale-[0.98]')}>
                                {status === 'SUCCESS' ? <><CheckCircle className="w-4 h-4" /> Entry Added!</> :
                                    status === 'ERROR' ? <><XCircle className="w-4 h-4" /> Missing Fields</> :
                                        <><Plus className="w-4 h-4" /> Add Entry</>}
                            </button>
                        </form>
                    </div>
                )}

                {/* ── RIGHT ── */}
                <div className={clsx('flex flex-col gap-4 min-w-0 max-w-full w-full', (canAdd && viewMode === 'daily') ? 'lg:col-span-2' : 'lg:col-span-3')}>

                    {/* ─── Daily Entries Table ─── */}
                    {viewMode === 'daily' && (
                        <div className="glass rounded-xl overflow-hidden flex flex-col flex-1 min-w-0 max-w-full w-full">
                            <div className="px-4 py-3 border-b border-dark-border/50 flex justify-between items-center">
                                <div>
                                    <h3 className="font-bold text-white text-sm">Production Entries</h3>
                                    <p className="text-[10px] text-dark-muted">{fmt(startDate)} → {fmt(endDate)} · {pendingCount} pending</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] text-dark-muted uppercase tracking-wider">Approved Total</p>
                                    <p className="text-lg font-bold text-success">₹ {totalApproved.toLocaleString('en-IN')}</p>
                                </div>
                            </div>
                            <div className="flex-1 overflow-x-auto overflow-y-auto max-h-[550px] w-full">
                                <table className="w-full text-left text-xs">
                                    <thead className="bg-dark-bg/50 text-dark-muted sticky top-0 backdrop-blur-md uppercase tracking-wider font-bold text-[10px]">
                                        <tr>
                                            <th className="px-4 py-2">Date</th>
                                            <th className="px-4 py-2">Employee & Item</th>
                                            <th className="px-4 py-2">Qty × Rate</th>
                                            <th className="px-4 py-2">Total</th>
                                            <th className="px-4 py-2">Status</th>
                                            <th className="px-4 py-2 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-dark-border/50 text-[11px]">
                                        {filteredEntries.map(entry => {
                                            const emp = employees.find(e => e.id === entry.employeeId);
                                            return (
                                                <tr key={entry.id} className="hover:bg-dark-card/50 transition-colors">
                                                    <td className="px-4 py-2 text-dark-muted font-mono whitespace-nowrap">{entry.date}</td>
                                                    <td className="px-4 py-2">
                                                        <p className="font-medium text-white">{entry.item}</p>
                                                        <p className="text-[10px] text-dark-muted">{emp?.name || 'Unknown'}</p>
                                                    </td>
                                                    <td className="px-4 py-2 font-mono">
                                                        <span className="text-white">{entry.qty}</span>
                                                        <span className="text-dark-muted text-[9px] mx-1">×</span>
                                                        <span className="text-white">₹{entry.rate}</span>
                                                    </td>
                                                    <td className="px-4 py-2 text-white font-bold font-mono">₹{entry.totalAmount}</td>
                                                    <td className="px-4 py-2">
                                                        <span className={clsx('flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold w-fit',
                                                            entry.status === 'APPROVED' && 'bg-success/10 text-success',
                                                            entry.status === 'REJECTED' && 'bg-danger/10 text-danger',
                                                            entry.status === 'PENDING' && 'bg-warning/10 text-warning')}>
                                                            {entry.status === 'PENDING' && <Clock className="w-2.5 h-2.5" />}
                                                            {entry.status === 'APPROVED' && <CheckCircle className="w-2.5 h-2.5" />}
                                                            {entry.status === 'REJECTED' && <XCircle className="w-2.5 h-2.5" />}
                                                            {entry.status}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-2 text-right">
                                                        <div className="flex items-center justify-end gap-1">
                                                            {canApprove && entry.status === 'PENDING' && (
                                                                <>
                                                                    <button onClick={() => approveEntry(entry.id)}
                                                                        className="p-1 hover:bg-success/20 text-success rounded" title="Approve">
                                                                        <CheckCircle className="w-4 h-4" />
                                                                    </button>
                                                                    <button onClick={() => rejectEntry(entry.id)}
                                                                        className="p-1 hover:bg-danger/20 text-danger rounded" title="Reject">
                                                                        <XCircle className="w-4 h-4" />
                                                                    </button>
                                                                </>
                                                            )}
                                                            {canAdd && (
                                                                <>
                                                                    <button onClick={() => openEdit(entry)}
                                                                        className="p-1 hover:bg-primary-500/20 text-primary-400 rounded transition-colors" title="Edit Entry">
                                                                        <Pencil className="w-3.5 h-3.5" />
                                                                    </button>
                                                                    <button onClick={() => setDeleteConfirmId(entry.id)}
                                                                        className="p-1 hover:bg-danger/20 text-danger/70 hover:text-danger rounded transition-colors" title="Delete Entry">
                                                                        <Trash2 className="w-3.5 h-3.5" />
                                                                    </button>
                                                                </>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                                {filteredEntries.length === 0 && (
                                    <div className="p-10 text-center text-dark-muted opacity-50 flex flex-col items-center">
                                        <Factory className="w-8 h-8 mb-2" />
                                        <p className="text-xs">Is range mein koi entries nahi</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* ─── Monthly Summary Table ─── */}
                    {viewMode === 'summary' && (
                        <div className="glass rounded-xl overflow-hidden min-w-0 max-w-full w-full">
                            <div className="px-4 py-3 border-b border-dark-border/50 flex justify-between items-center">
                                <div>
                                    <h3 className="font-bold text-white text-sm flex items-center gap-2">
                                        <TrendingUp className="w-4 h-4 text-emerald-400" /> Employee Production Summary
                                    </h3>
                                    <p className="text-[10px] text-dark-muted">{fmt(startDate)} → {fmt(endDate)} · {employeeSummary.length} employees</p>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={handleExportSummaryExcel}
                                        className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 rounded-lg hover:bg-emerald-500/25 transition-all font-bold">
                                        <FileSpreadsheet className="w-3.5 h-3.5" /> Excel
                                    </button>
                                    <button onClick={handleExportSummaryPDF}
                                        className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 bg-red-500/15 text-red-400 border border-red-500/30 rounded-lg hover:bg-red-500/25 transition-all font-bold">
                                        <FileText className="w-3.5 h-3.5" /> PDF
                                    </button>
                                </div>
                            </div>
                            <div className="overflow-x-auto overflow-y-auto max-h-[600px] w-full">
                                <table className="w-full text-left text-xs">
                                    <thead className="bg-dark-bg/50 text-dark-muted sticky top-0 backdrop-blur-md uppercase tracking-wider font-bold text-[10px]">
                                        <tr>
                                            <th className="px-4 py-2 w-8">#</th>
                                            <th className="px-4 py-2">Employee</th>
                                            <th className="px-4 py-2">Dept</th>
                                            <th className="px-4 py-2 text-right">Qty</th>
                                            <th className="px-4 py-2 text-right">Entries</th>
                                            <th className="px-4 py-2 text-right">Approved ✅</th>
                                            <th className="px-4 py-2 text-right">Pending ⏳</th>
                                            <th className="px-4 py-2 text-right">Total Earned</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-dark-border/40">
                                        {employeeSummary.map((s, i) => {
                                            const total = s.approved + s.pending;
                                            const maxTotal = (employeeSummary[0]?.approved + employeeSummary[0]?.pending) || 1;
                                            const pct = Math.round((total / maxTotal) * 100);
                                            return (
                                                <tr key={s.empId} className={clsx('hover:bg-dark-card/50 transition-colors', i === 0 && 'bg-yellow-500/5')}>
                                                    <td className="px-4 py-2.5 text-center">
                                                        {i === 0 ? <Trophy className="w-4 h-4 text-yellow-400 mx-auto" /> :
                                                            <span className="text-dark-muted font-mono">{i + 1}</span>}
                                                    </td>
                                                    <td className="px-4 py-2.5">
                                                        <p className={clsx('font-semibold', i === 0 ? 'text-yellow-300' : 'text-white')}>{s.name}</p>
                                                        {/* Mini progress bar */}
                                                        <div className="w-24 h-1 bg-dark-border rounded-full mt-1">
                                                            <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full"
                                                                style={{ width: `${pct}%` }} />
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-2.5 text-dark-muted">{s.dept}</td>
                                                    <td className="px-4 py-2.5 text-right font-mono text-white">{s.totalQty.toLocaleString()}</td>
                                                    <td className="px-4 py-2.5 text-right text-dark-muted">{s.entries}</td>
                                                    <td className="px-4 py-2.5 text-right font-mono font-bold text-success">
                                                        ₹{s.approved.toLocaleString('en-IN')}
                                                    </td>
                                                    <td className="px-4 py-2.5 text-right font-mono text-warning">
                                                        {s.pending > 0 ? `₹${s.pending.toLocaleString('en-IN')}` : '—'}
                                                    </td>
                                                    <td className="px-4 py-2.5 text-right font-mono font-bold text-white">
                                                        ₹{total.toLocaleString('en-IN')}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                    {employeeSummary.length > 0 && (
                                        <tfoot className="bg-dark-bg/70 text-[10px] font-bold uppercase tracking-wider sticky bottom-0">
                                            <tr>
                                                <td colSpan={3} className="px-4 py-2 text-dark-muted">TOTAL</td>
                                                <td className="px-4 py-2 text-right font-mono text-white">{employeeSummary.reduce((s, r) => s + r.totalQty, 0).toLocaleString()}</td>
                                                <td className="px-4 py-2 text-right text-dark-muted">{filteredEntries.length}</td>
                                                <td className="px-4 py-2 text-right font-mono text-success">₹{totalApproved.toLocaleString('en-IN')}</td>
                                                <td className="px-4 py-2 text-right font-mono text-warning">₹{totalPending.toLocaleString('en-IN')}</td>
                                                <td className="px-4 py-2 text-right font-mono text-white">₹{(totalApproved + totalPending).toLocaleString('en-IN')}</td>
                                            </tr>
                                        </tfoot>
                                    )}
                                </table>
                                {employeeSummary.length === 0 && (
                                    <div className="p-10 text-center text-dark-muted opacity-50">
                                        <RefreshCw className="w-8 h-8 mb-2 mx-auto" />
                                        <p className="text-xs">Is period mein koi data nahi</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
                {viewMode === 'items' && (() => {
                    const totalItemQty = itemSummary.reduce((s, r) => s + r.totalQty, 0);
                    const totalAmt = totalApproved + totalPending;
                    const approvalPct = totalAmt > 0 ? Math.round((totalApproved / totalAmt) * 100) : 0;
                    const bestItem = itemSummary[0];
                    return (
                        <div className="lg:col-span-3 space-y-4 min-w-0 max-w-full w-full">

                            {/* TOP STAT CARDS */}
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                                <div className="glass p-3.5 rounded-xl border-l-4 border-violet-500">
                                    <p className="text-[10px] text-dark-muted font-bold uppercase tracking-wider">Total Items</p>
                                    <p className="text-2xl font-black text-white mt-0.5">{itemSummary.length}</p>
                                    <p className="text-[10px] text-violet-400 mt-0.5">{filteredEntries.length} total entries</p>
                                </div>
                                <div className="glass p-3.5 rounded-xl border-l-4 border-amber-500">
                                    <p className="text-[10px] text-dark-muted font-bold uppercase tracking-wider">Total Qty</p>
                                    <p className="text-2xl font-black text-white mt-0.5">{totalItemQty.toLocaleString()}</p>
                                    <p className="text-[10px] text-amber-400 mt-0.5">units produced</p>
                                </div>
                                <div className="glass p-3.5 rounded-xl border-l-4 border-success">
                                    <p className="text-[10px] text-dark-muted font-bold uppercase tracking-wider">Best Item</p>
                                    <p className="text-sm font-black text-white mt-0.5 truncate">{bestItem?.item || '—'}</p>
                                    <p className="text-[10px] text-success mt-0.5">{bestItem ? `₹${(bestItem.approved + bestItem.pending).toLocaleString('en-IN')}` : '₹0'}</p>
                                </div>
                                <div className="glass p-3.5 rounded-xl border-l-4 border-blue-500">
                                    <p className="text-[10px] text-dark-muted font-bold uppercase tracking-wider">Approval %</p>
                                    <p className="text-2xl font-black text-white mt-0.5">{approvalPct}%</p>
                                    <div className="mt-1.5 h-1.5 bg-dark-bg rounded-full overflow-hidden">
                                        <div className="h-full bg-success rounded-full transition-all" style={{ width: `${approvalPct}%` }} />
                                    </div>
                                </div>
                            </div>

                            {/* TABLE PANEL */}
                            <div className="glass rounded-xl overflow-hidden min-w-0 max-w-full w-full">
                                {/* Header */}
                                <div className="flex items-center justify-between px-5 py-3.5 border-b border-dark-border bg-dark-bg/40 flex-wrap gap-2">
                                    <div>
                                        <p className="text-xs font-bold text-white flex items-center gap-2">
                                            <Tag className="w-3.5 h-3.5 text-violet-400" /> Item-wise Summary
                                        </p>
                                        <p className="text-[10px] text-dark-muted mt-0.5">{fmt(startDate)} → {fmt(endDate)} · {itemSummary.length} items</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] text-dark-muted">Sort:</span>
                                        {(['amount', 'qty', 'entries'] as const).map(s => (
                                            <button key={s} onClick={() => setItemSort(s)}
                                                className={clsx('px-2.5 py-1 rounded text-[10px] font-bold transition-all',
                                                    itemSort === s ? 'bg-violet-600 text-white' : 'bg-dark-bg text-dark-muted hover:text-white'
                                                )}>
                                                {s === 'amount' ? '₹ Amount' : s === 'qty' ? 'Qty' : 'Entries'}
                                            </button>
                                        ))}
                                        <div className="flex items-center gap-2 ml-2 text-[10px] text-dark-muted border-l border-dark-border pl-2">
                                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-success inline-block" /> Approved</span>
                                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-warning inline-block" /> Pending</span>
                                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-danger inline-block" /> Rejected</span>
                                        </div>
                                    </div>
                                </div>

                                {itemSummary.length === 0 ? (
                                    <div className="p-14 text-center text-dark-muted opacity-40">
                                        <PackageSearch className="w-10 h-10 mx-auto mb-2" />
                                        <p className="text-sm font-medium">Is period mein koi item nahi</p>
                                        <p className="text-xs mt-1">Date range change karo ya entries add karo</p>
                                    </div>
                                ) : (() => {
                                    const sorted = [...itemSummary].sort((a, b) => {
                                        if (itemSort === 'qty') return b.totalQty - a.totalQty;
                                        if (itemSort === 'entries') return b.entries - a.entries;
                                        return (b.approved + b.pending) - (a.approved + a.pending);
                                    });
                                    const grandTotal = sorted.reduce((s, r) => s + r.approved + r.pending + r.rejected, 0);
                                    const medals = ['🥇', '🥈', '🥉'];
                                    return (
                                        <div className="overflow-x-auto w-full">
                                            <table className="w-full text-[11px]">
                                                <thead className="bg-dark-bg/70 text-[10px] uppercase tracking-wider text-dark-muted sticky top-0">
                                                    <tr>
                                                        <th className="px-4 py-3 text-left w-8">#</th>
                                                        <th className="px-4 py-3 text-left">Item / Work</th>
                                                        <th className="px-4 py-3 text-right">Qty</th>
                                                        <th className="px-4 py-3 text-right">Avg Rate</th>
                                                        <th className="px-4 py-3 text-right">Entries</th>
                                                        <th className="px-4 py-3 text-left hidden md:table-cell">Top Performer</th>
                                                        <th className="px-4 py-3 text-right">Approved ₹</th>
                                                        <th className="px-4 py-3 text-right">Pending ₹</th>
                                                        <th className="px-4 py-3 text-right">Total ₹</th>
                                                        <th className="px-4 py-3 text-left hidden lg:table-cell" style={{ minWidth: 100 }}>Approval</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-dark-border/40">
                                                    {sorted.map((row, idx) => {
                                                        const total = row.approved + row.pending + row.rejected;
                                                        const appPct = total > 0 ? Math.round((row.approved / total) * 100) : 0;
                                                        const pendPct = total > 0 ? Math.round((row.pending / total) * 100) : 0;
                                                        const avgRate = row.totalQty > 0 ? (total / row.totalQty) : 0;
                                                        const sharePct = grandTotal > 0 ? Math.round((total / grandTotal) * 100) : 0;
                                                        return (
                                                            <motion.tr
                                                                key={row.item}
                                                                initial={{ opacity: 0, y: 6 }}
                                                                animate={{ opacity: 1, y: 0 }}
                                                                transition={{ delay: idx * 0.03 }}
                                                                className="hover:bg-dark-bg/40 transition-colors group"
                                                            >
                                                                <td className="px-4 py-3">
                                                                    {idx < 3 ? (
                                                                        <span className="text-base">{medals[idx]}</span>
                                                                    ) : (
                                                                        <span className="text-dark-muted font-medium">{idx + 1}</span>
                                                                    )}
                                                                </td>
                                                                <td className="px-4 py-3 min-w-[180px]">
                                                                    <p className="text-white font-semibold leading-tight">{row.item}</p>
                                                                    <div className="flex items-center gap-1 mt-1.5">
                                                                        <div className="h-1 rounded-full bg-dark-bg overflow-hidden flex-1 max-w-[80px]">
                                                                            <div className="h-full bg-success" style={{ width: `${appPct}%` }} />
                                                                        </div>
                                                                        <span className="text-[9px] text-dark-muted">{sharePct}% share</span>
                                                                    </div>
                                                                </td>
                                                                <td className="px-4 py-3 text-right font-mono font-bold text-white">{row.totalQty.toLocaleString()}</td>
                                                                <td className="px-4 py-3 text-right font-mono text-dark-muted">₹{avgRate.toFixed(1)}</td>
                                                                <td className="px-4 py-3 text-right text-dark-muted">{row.entries}</td>
                                                                <td className="px-4 py-3 hidden md:table-cell">
                                                                    {row.topEmp ? (
                                                                        <div className="flex items-center gap-1.5">
                                                                            <div className="w-5 h-5 rounded-full bg-violet-500/20 flex items-center justify-center text-[9px] font-bold text-violet-400 shrink-0">{row.topEmp[0]}</div>
                                                                            <div>
                                                                                <p className="text-white leading-tight">{row.topEmp}</p>
                                                                                <p className="text-dark-muted text-[9px]">{row.topEmpQty.toLocaleString()} units</p>
                                                                            </div>
                                                                        </div>
                                                                    ) : '—'}
                                                                </td>
                                                                <td className="px-4 py-3 text-right font-mono font-bold text-success">{row.approved > 0 ? `₹${row.approved.toLocaleString('en-IN')}` : '—'}</td>
                                                                <td className="px-4 py-3 text-right font-mono text-warning">{row.pending > 0 ? `₹${row.pending.toLocaleString('en-IN')}` : '—'}</td>
                                                                <td className="px-4 py-3 text-right font-mono font-bold text-white">₹{total.toLocaleString('en-IN')}</td>
                                                                <td className="px-4 py-3 hidden lg:table-cell">
                                                                    <div className="flex items-center gap-1.5">
                                                                        <div className="flex-1 h-1.5 bg-dark-bg rounded-full overflow-hidden flex">
                                                                            <div className="h-full bg-success" style={{ width: `${appPct}%` }} />
                                                                            <div className="h-full bg-warning" style={{ width: `${pendPct}%` }} />
                                                                        </div>
                                                                        <span className={clsx('text-[10px] font-bold', appPct >= 80 ? 'text-success' : appPct >= 50 ? 'text-warning' : 'text-danger')}>{appPct}%</span>
                                                                    </div>
                                                                </td>
                                                            </motion.tr>
                                                        );
                                                    })}
                                                </tbody>
                                                <tfoot className="bg-dark-bg/80 text-[10px] font-bold uppercase tracking-wider sticky bottom-0 border-t border-dark-border">
                                                    <tr>
                                                        <td colSpan={2} className="px-4 py-2.5 text-dark-muted">TOTAL — {sorted.length} Items</td>
                                                        <td className="px-4 py-2.5 text-right font-mono text-white">{totalItemQty.toLocaleString()}</td>
                                                        <td className="px-4 py-2.5 text-right font-mono text-dark-muted">
                                                            ₹{totalItemQty > 0 ? ((totalApproved + totalPending) / totalItemQty).toFixed(1) : '0'}
                                                        </td>
                                                        <td className="px-4 py-2.5 text-right text-dark-muted">{filteredEntries.length}</td>
                                                        <td className="hidden md:table-cell" />
                                                        <td className="px-4 py-2.5 text-right font-mono text-success">₹{totalApproved.toLocaleString('en-IN')}</td>
                                                        <td className="px-4 py-2.5 text-right font-mono text-warning">₹{totalPending.toLocaleString('en-IN')}</td>
                                                        <td className="px-4 py-2.5 text-right font-mono text-white">₹{(totalApproved + totalPending).toLocaleString('en-IN')}</td>
                                                        <td className="hidden lg:table-cell px-4 py-2.5">
                                                            <span className={clsx('font-bold', approvalPct >= 80 ? 'text-success' : approvalPct >= 50 ? 'text-warning' : 'text-danger')}>
                                                                {approvalPct}% approved
                                                            </span>
                                                        </td>
                                                    </tr>
                                                </tfoot>
                                            </table>
                                        </div>
                                    );
                                })()}
                            </div>
                        </div>
                    );
                })()}

                {/* ── Chart View ── */}
                {viewMode === 'chart' && (
                    <div className="lg:col-span-3">
                        <div className="glass rounded-xl overflow-hidden">

                            {/* Chart Type Switcher Header */}
                            <div className="flex items-center justify-between px-5 py-3.5 border-b border-dark-border bg-dark-bg/40 flex-wrap gap-3">
                                <div>
                                    <p className="text-xs font-bold text-white flex items-center gap-2">
                                        <TrendingUp className="w-3.5 h-3.5 text-amber-400" /> Production Analytics
                                    </p>
                                    <p className="text-[10px] text-dark-muted mt-0.5">{fmt(startDate)} → {fmt(endDate)}</p>
                                </div>
                                <div className="flex items-center gap-1 bg-dark-bg/70 rounded-lg p-1">
                                    {(['date', 'employee', 'item'] as const).map(t => (
                                        <button key={t} onClick={() => setChartType(t)}
                                            className={clsx('px-3 py-1.5 rounded-md text-[11px] font-bold transition-all',
                                                chartType === t ? 'bg-amber-500 text-white shadow-md' : 'text-dark-muted hover:text-white'
                                            )}>
                                            {t === 'date' ? '📅 By Date' : t === 'employee' ? '👤 By Employee' : '🏷️ By Item'}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* BY DATE */}
                            {chartType === 'date' && (chartData.length === 0 ? (
                                <div className="p-16 text-center text-dark-muted opacity-40">
                                    <TrendingUp className="w-10 h-10 mx-auto mb-2" />
                                    <p className="text-sm font-medium">Is period mein koi data nahi</p>
                                    <p className="text-xs mt-1">Date range badlao ya entries add karo</p>
                                </div>
                            ) : (
                                <div className="p-4 pt-6">
                                    <ResponsiveContainer width="100%" height={300}>
                                        <ComposedChart data={chartData} margin={{ top: 4, right: 24, bottom: 4, left: 4 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                                            <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 10 }} tickLine={false} axisLine={{ stroke: 'rgba(255,255,255,0.1)' }} />
                                            <YAxis yAxisId="qty" orientation="left" tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} />
                                            <YAxis yAxisId="amt" orientation="right" tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
                                            <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, fontSize: 11, color: '#fff' }}
                                                formatter={(v: number, n: string) => n === 'qty' ? [v.toLocaleString(), 'Qty'] : [`₹${v.toLocaleString('en-IN')}`, n === 'approved' ? 'Approved' : 'Pending']}
                                                cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                                            <Legend wrapperStyle={{ fontSize: 10, color: '#94a3b8', paddingTop: 8 }}
                                                formatter={v => v === 'qty' ? 'Daily Qty' : v === 'approved' ? 'Approved ₹' : 'Pending ₹'} />
                                            <Bar yAxisId="qty" dataKey="qty" fill="#f59e0b" opacity={0.8} radius={[4, 4, 0, 0]} maxBarSize={44} />
                                            <Line yAxisId="amt" type="monotone" dataKey="approved" stroke="#10b981" strokeWidth={2.5} dot={{ r: 3, fill: '#10b981', strokeWidth: 0 }} activeDot={{ r: 5 }} />
                                            <Line yAxisId="amt" type="monotone" dataKey="pending" stroke="#f59e0b" strokeWidth={2} strokeDasharray="5 3" dot={{ r: 3, fill: '#f59e0b', strokeWidth: 0 }} />
                                        </ComposedChart>
                                    </ResponsiveContainer>
                                    <div className="grid grid-cols-3 gap-3 mt-4 border-t border-dark-border/50 pt-4 text-center">
                                        <div><p className="text-[10px] text-dark-muted uppercase font-bold">Total Qty</p><p className="text-xl font-black text-amber-400">{chartData.reduce((s, d) => s + d.qty, 0).toLocaleString()}</p></div>
                                        <div><p className="text-[10px] text-dark-muted uppercase font-bold">Approved</p><p className="text-xl font-black text-success">₹{totalApproved.toLocaleString('en-IN')}</p></div>
                                        <div><p className="text-[10px] text-dark-muted uppercase font-bold">Pending</p><p className="text-xl font-black text-warning">₹{totalPending.toLocaleString('en-IN')}</p></div>
                                    </div>
                                </div>
                            ))}

                            {/* BY EMPLOYEE */}
                            {chartType === 'employee' && (employeeSummary.length === 0 ? (
                                <div className="p-16 text-center text-dark-muted opacity-40">
                                    <Users className="w-10 h-10 mx-auto mb-2" />
                                    <p className="text-sm font-medium">Is period mein koi data nahi</p>
                                </div>
                            ) : (() => {
                                const empData = employeeSummary.slice(0, 12).map(s => ({
                                    name: s.name.split(' ')[0],
                                    approved: s.approved, pending: s.pending, qty: s.totalQty,
                                }));
                                return (
                                    <div className="p-4 pt-6">
                                        <ResponsiveContainer width="100%" height={Math.max(260, empData.length * 36)}>
                                            <BarChart data={empData} layout="vertical" margin={{ top: 4, right: 60, bottom: 4, left: 8 }}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" horizontal={false} />
                                                <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
                                                <YAxis type="category" dataKey="name" tick={{ fill: '#e2e8f0', fontSize: 11 }} axisLine={false} tickLine={false} width={64} />
                                                <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, fontSize: 11, color: '#fff' }}
                                                    formatter={(v: number, n: string) => [`₹${v.toLocaleString('en-IN')}`, n === 'approved' ? 'Approved' : 'Pending']} />
                                                <Legend wrapperStyle={{ fontSize: 10, color: '#94a3b8', paddingTop: 8 }}
                                                    formatter={v => v === 'approved' ? 'Approved ₹' : 'Pending ₹'} />
                                                <Bar dataKey="approved" stackId="a" fill="#10b981" maxBarSize={22} />
                                                <Bar dataKey="pending" stackId="a" fill="#f59e0b" opacity={0.8} radius={[0, 4, 4, 0]} maxBarSize={22} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                        <div className="grid grid-cols-3 gap-3 mt-4 border-t border-dark-border/50 pt-4 text-center">
                                            <div><p className="text-[10px] text-dark-muted uppercase font-bold">Employees</p><p className="text-xl font-black text-amber-400">{employeeSummary.length}</p></div>
                                            <div><p className="text-[10px] text-dark-muted uppercase font-bold">Approved</p><p className="text-xl font-black text-success">₹{totalApproved.toLocaleString('en-IN')}</p></div>
                                            <div><p className="text-[10px] text-dark-muted uppercase font-bold">Pending</p><p className="text-xl font-black text-warning">₹{totalPending.toLocaleString('en-IN')}</p></div>
                                        </div>
                                    </div>
                                );
                            })())}

                            {/* BY ITEM */}
                            {chartType === 'item' && (itemSummary.length === 0 ? (
                                <div className="p-16 text-center text-dark-muted opacity-40">
                                    <PackageSearch className="w-10 h-10 mx-auto mb-2" />
                                    <p className="text-sm font-medium">Is period mein koi data nahi</p>
                                </div>
                            ) : (() => {
                                const COLORS = ['#f59e0b', '#10b981', '#6366f1', '#ef4444', '#3b82f6', '#ec4899', '#14b8a6', '#f97316', '#a855f7', '#06b6d4'];
                                const itemData = itemSummary.slice(0, 10).map(r => ({
                                    name: r.item.length > 12 ? r.item.slice(0, 11) + '…' : r.item,
                                    fullName: r.item, total: r.approved + r.pending,
                                    approved: r.approved, pending: r.pending, qty: r.totalQty,
                                }));
                                return (
                                    <div className="p-4 pt-4">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                                            <div>
                                                <p className="text-[10px] text-dark-muted uppercase font-bold text-center mb-2">Amount Distribution</p>
                                                <ResponsiveContainer width="100%" height={230}>
                                                    <PieChart>
                                                        <Pie data={itemData} dataKey="total" nameKey="name"
                                                            cx="50%" cy="50%" outerRadius={85} innerRadius={45} paddingAngle={2}
                                                            label={({ percent }) => percent > 0.05 ? `${(percent * 100).toFixed(0)}%` : ''}
                                                            labelLine={false}>
                                                            {itemData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} opacity={0.88} />)}
                                                        </Pie>
                                                        <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, fontSize: 11, color: '#fff' }}
                                                            formatter={(v: number, _n: string, p: any) => [`₹${v.toLocaleString('en-IN')} · ${p.payload.qty} units`, p.payload.fullName]} />
                                                    </PieChart>
                                                </ResponsiveContainer>
                                            </div>
                                            <div>
                                                <p className="text-[10px] text-dark-muted uppercase font-bold text-center mb-2">Approved vs Pending</p>
                                                <ResponsiveContainer width="100%" height={230}>
                                                    <BarChart data={itemData} margin={{ top: 4, right: 8, bottom: 28, left: 4 }}>
                                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                                                        <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 9 }} tickLine={false} angle={-35} textAnchor="end" interval={0} />
                                                        <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
                                                        <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, fontSize: 11, color: '#fff' }}
                                                            formatter={(v: number, n: string) => [`₹${v.toLocaleString('en-IN')}`, n === 'approved' ? 'Approved' : 'Pending']} />
                                                        <Bar dataKey="approved" stackId="s" fill="#10b981" maxBarSize={30} />
                                                        <Bar dataKey="pending" stackId="s" fill="#f59e0b" opacity={0.8} radius={[4, 4, 0, 0]} maxBarSize={30} />
                                                    </BarChart>
                                                </ResponsiveContainer>
                                            </div>
                                        </div>
                                        <div className="flex flex-wrap gap-2 mt-3 justify-center">
                                            {itemData.map((d, i) => (
                                                <span key={d.fullName} className="flex items-center gap-1 text-[10px] text-dark-muted">
                                                    <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: COLORS[i % COLORS.length] }} />
                                                    {d.fullName}
                                                </span>
                                            ))}
                                        </div>
                                        <div className="grid grid-cols-3 gap-3 mt-4 border-t border-dark-border/50 pt-4 text-center">
                                            <div><p className="text-[10px] text-dark-muted uppercase font-bold">Items</p><p className="text-xl font-black text-amber-400">{itemSummary.length}</p></div>
                                            <div><p className="text-[10px] text-dark-muted uppercase font-bold">Approved</p><p className="text-xl font-black text-success">₹{totalApproved.toLocaleString('en-IN')}</p></div>
                                            <div><p className="text-[10px] text-dark-muted uppercase font-bold">Pending</p><p className="text-xl font-black text-warning">₹{totalPending.toLocaleString('en-IN')}</p></div>
                                        </div>
                                    </div>
                                );
                            })())}

                        </div>
                    </div>
                )}

            </div>

            {showRateManager && <RateManager onClose={() => setShowRateManager(false)} />}
            {showBulkEntry && <BulkEntryForm onClose={() => setShowBulkEntry(false)} />}

            {/* ── Bulk Approve Confirm Modal ── */}
            <AnimatePresence>
                {showBulkApproveConfirm && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.93, y: 16 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.93 }}
                            className="bg-dark-card border border-success/30 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden"
                        >
                            <div className="px-5 py-4 border-b border-dark-border bg-success/5 flex items-center gap-3">
                                <div className="w-10 h-10 bg-success/15 rounded-full flex items-center justify-center">
                                    <CheckCheck className="w-5 h-5 text-success" />
                                </div>
                                <div>
                                    <h2 className="font-bold text-white text-sm">Bulk Approve Karo?</h2>
                                    <p className="text-[11px] text-dark-muted mt-0.5">Sabhi pending entries approve ho jayengi</p>
                                </div>
                            </div>
                            <div className="p-5 space-y-3">
                                <div className="bg-dark-bg/60 rounded-xl p-3 space-y-2">
                                    <div className="flex justify-between text-xs">
                                        <span className="text-dark-muted">Pending Entries</span>
                                        <span className="font-bold text-warning">{filteredEntries.filter(e => e.status === 'PENDING').length}</span>
                                    </div>
                                    <div className="flex justify-between text-xs">
                                        <span className="text-dark-muted">Total Amount</span>
                                        <span className="font-bold text-success">₹{totalPending.toLocaleString('en-IN')}</span>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => setShowBulkApproveConfirm(false)}
                                        className="flex-1 px-4 py-2.5 rounded-xl border border-dark-border text-sm text-dark-muted hover:text-white transition-colors">
                                        Ruk Jao
                                    </button>
                                    <button onClick={handleBulkApprove} disabled={bulkApproveStatus === 'APPROVING'}
                                        className="flex-1 px-4 py-2.5 rounded-xl bg-success text-white text-sm font-bold hover:bg-success/80 transition-colors flex items-center justify-center gap-2">
                                        <CheckCheck className="w-4 h-4" /> {bulkApproveStatus === 'APPROVING' ? 'Approving...' : 'Haan, Approve Karo'}
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* ── Edit Entry Modal ── */}
            <AnimatePresence>
                {editEntry && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.93, y: 16 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.93 }}
                            className="bg-dark-card border border-dark-border rounded-2xl w-full max-w-md shadow-2xl overflow-hidden"
                        >
                            <div className="px-5 py-4 border-b border-dark-border flex items-center justify-between">
                                <h2 className="font-bold text-white text-sm">Entry Edit Karo</h2>
                                <button onClick={() => setEditEntry(null)} className="text-dark-muted hover:text-white">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                            <div className="p-5 space-y-4">
                                <div>
                                    <label className="text-xs text-dark-muted font-bold uppercase tracking-wider mb-1.5 block">Quantity</label>
                                    <input type="number" value={editForm.qty}
                                        onChange={e => setEditForm(f => ({ ...f, qty: e.target.value }))}
                                        className="w-full bg-dark-bg border border-dark-border rounded-xl px-4 py-2.5 text-white text-sm focus:border-amber-500 outline-none" />
                                </div>
                                <div>
                                    <label className="text-xs text-dark-muted font-bold uppercase tracking-wider mb-1.5 block">Rate (₹)</label>
                                    <input type="number" value={editForm.rate}
                                        onChange={e => setEditForm(f => ({ ...f, rate: e.target.value }))}
                                        className="w-full bg-dark-bg border border-dark-border rounded-xl px-4 py-2.5 text-white text-sm focus:border-amber-500 outline-none" />
                                </div>

                                <div className="flex gap-2">
                                    <button onClick={() => setEditEntry(null)}
                                        className="flex-1 px-4 py-2.5 rounded-xl border border-dark-border text-sm text-dark-muted hover:text-white transition-colors">
                                        Cancel
                                    </button>
                                    <button onClick={handleEditSave} disabled={editStatus === 'SAVING'}
                                        className="flex-1 px-4 py-2.5 rounded-xl bg-amber-500 text-white text-sm font-bold hover:bg-amber-600 transition-colors flex items-center justify-center gap-2">
                                        <Save className="w-4 h-4" /> {editStatus === 'SAVING' ? 'Saving...' : editStatus === 'SUCCESS' ? 'Saved!' : 'Save Karo'}
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* ── Delete Confirm Modal ── */}
            <AnimatePresence>
                {deleteConfirmId && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.93, y: 16 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.93 }}
                            className="bg-dark-card border border-danger/30 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden"
                        >
                            <div className="px-5 py-4 border-b border-dark-border bg-danger/5 flex items-center gap-3">
                                <div className="w-10 h-10 bg-danger/15 rounded-full flex items-center justify-center">
                                    <Trash2 className="w-5 h-5 text-danger" />
                                </div>
                                <div>
                                    <h2 className="font-bold text-white text-sm">Entry Delete Karo?</h2>
                                    <p className="text-[11px] text-dark-muted mt-0.5">Yeh action undo nahi ho sakta</p>
                                </div>
                            </div>
                            <div className="p-5 flex gap-2">
                                <button onClick={() => setDeleteConfirmId(null)}
                                    className="flex-1 px-4 py-2.5 rounded-xl border border-dark-border text-sm text-dark-muted hover:text-white transition-colors">
                                    Cancel
                                </button>
                                <button onClick={() => handleDelete(deleteConfirmId!)}
                                    className="flex-1 px-4 py-2.5 rounded-xl bg-danger text-white text-sm font-bold hover:bg-danger/80 transition-colors flex items-center justify-center gap-2">
                                    <Trash2 className="w-4 h-4" /> Delete
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div >
    );
};

export default ProductionDashboard;