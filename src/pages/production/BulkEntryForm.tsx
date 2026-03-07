import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProductionStore } from '@/store/productionStore';
import { useEmployeeStore } from '@/store/employeeStore';
import { useRateStore } from '@/store/rateStore';
import { useWorkGroupStore } from '@/store/workGroupStore';
import { useSystemConfigStore } from '@/store/systemConfigStore';
import { useDepartmentStore } from '@/store/departmentStore';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { EmployeeStatus } from '@/types';
import {
    Save, Users, CheckSquare, Square, X, CheckCircle,
    Filter, Factory
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import { useMultiCompanyStore } from '@/store/multiCompanyStore';

type RowData = { itemId?: string; item: string; rate: string; qty: string; remark: string };

export const BulkEntryForm = ({ onClose }: { onClose?: () => void }) => {
    const navigate = useNavigate();
    const handleClose = () => onClose ? onClose() : navigate(-1);
    const { employees } = useEmployeeStore();
    const { currentCompanyId } = useMultiCompanyStore();
    const { items, getItem } = useRateStore();
    const { groups } = useWorkGroupStore();
    const { productionGridDepts } = useSystemConfigStore();
    const { departments: mainDepts } = useDepartmentStore();

    // Departments allowed in Production Grid (from System Config → Departments → Production Grid Filter)
    // Empty = all; non-empty = only those dept IDs
    const allowedDeptIds = productionGridDepts; // string[] of dept IDs
    const allowedDeptNames = allowedDeptIds.length === 0
        ? null // null = no filter = show all
        : new Set(mainDepts.filter(d => allowedDeptIds.includes(d.id)).map(d => d.name));


    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

    // ── Defaults Panel ────────────────────────────────────────────────────────
    const [defaultItemName, setDefaultItemName] = useState('');
    const [defaultItemId, setDefaultItemId] = useState('');
    const [defaultRate, setDefaultRate] = useState('');
    const [defaultQty, setDefaultQty] = useState('');
    const [selectedMasterItem, setSelectedMasterItem] = useState<{ id: string; name: string; rate: number } | null>(null);
    const [isManual, setIsManual] = useState(true); // true = type manually; false = pick from master

    // ── Department filter ─────────────────────────────────────────────────────
    const [deptFilter, setDeptFilter] = useState('ALL');

    // Only show departments that have work groups AND are in productionGridDepts config
    const departments = useMemo(() => {
        const deptsWithGroups = new Set(groups.map(g => g.department));
        const empDepts = new Set<string>();
        employees.forEach(e => {
            if (e.department && deptsWithGroups.has(e.department)) {
                // If allowedDeptNames is null = no filter; otherwise check
                if (!allowedDeptNames || allowedDeptNames.has(e.department)) {
                    empDepts.add(e.department);
                }
            }
        });
        return [...Array.from(empDepts).sort()];
    }, [employees, groups, allowedDeptNames]);

    // Active employees — filtered by Production Grid config + selected dept
    const activeEmployees = useMemo(() =>
        employees.filter(e =>
            e.status === EmployeeStatus.ACTIVE &&
            (deptFilter === 'ALL' || e.department === deptFilter) &&
            (!allowedDeptNames || allowedDeptNames.has(e.department || ''))
        )
        , [employees, deptFilter, allowedDeptNames]);

    // ── Row state ─────────────────────────────────────────────────────────────
    const [rows, setRows] = useState<Record<string, RowData>>({});
    const [selectedEmpIds, setSelectedEmpIds] = useState<Set<string>>(new Set());

    // ── Success toast ─────────────────────────────────────────────────────────
    const [toast, setToast] = useState('');
    const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

    // ── Helpers ───────────────────────────────────────────────────────────────
    const getRow = (id: string): RowData => rows[id] || { item: '', rate: '', qty: '', remark: '' };

    const updateRow = (id: string, updates: Partial<RowData>) =>
        setRows(prev => ({ ...prev, [id]: { ...getRow(id), ...updates } }));

    const toggleSelect = (id: string) => {
        const s = new Set(selectedEmpIds);
        s.has(id) ? s.delete(id) : s.add(id);
        setSelectedEmpIds(s);
    };

    const toggleSelectAll = () =>
        setSelectedEmpIds(selectedEmpIds.size === activeEmployees.length
            ? new Set()
            : new Set(activeEmployees.map(e => e.id)));

    // Deselect all when dept filter changes
    const changeDept = (d: string) => { setDeptFilter(d); setSelectedEmpIds(new Set()); };

    // ── Apply defaults to selected rows ───────────────────────────────────────
    const applyDefaults = () => {
        if (!defaultItemName && !defaultRate && !defaultQty) return;
        const newRows = { ...rows };
        activeEmployees.forEach(e => {
            if (selectedEmpIds.has(e.id)) {
                const cur = newRows[e.id] || { item: '', rate: '', qty: '', remark: '' };
                newRows[e.id] = {
                    item: defaultItemName || cur.item,
                    itemId: defaultItemName ? defaultItemId : cur.itemId,
                    rate: defaultRate || cur.rate,
                    qty: defaultQty || cur.qty,
                    remark: cur.remark,
                };
            }
        });
        setRows(newRows);
        showToast(`Defaults applied to ${selectedEmpIds.size} employees`);
    };

    // ── Grand total of filled rows ────────────────────────────────────────────
    const grandTotal = useMemo(() =>
        Object.values(rows).reduce((sum, r) => sum + (Number(r.qty) || 0) * (Number(r.rate) || 0), 0)
        , [rows]);

    const filledCount = useMemo(() =>
        activeEmployees.filter(e => Number(getRow(e.id).qty) > 0).length
        , [rows, activeEmployees]);

    // ── Submit ────────────────────────────────────────────────────────────────
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async () => {
        if (submitting) return;
        const missing: string[] = [];
        const validPayloads: any[] = [];

        selectedEmpIds.forEach(empId => {
            const row = getRow(empId);
            const qty = Number(row.qty);
            const rate = Number(row.rate);
            if (qty <= 0) return; // Skip rows with no qty
            if (!row.item || !rate) {
                const emp = activeEmployees.find(e => e.id === empId);
                missing.push(emp?.name || empId);
                return;
            }
            validPayloads.push({
                companyId: currentCompanyId || undefined,
                date,
                employeeId: empId,
                item: row.item,
                itemId: row.itemId,
                qty,
                rate,
                remarks: row.remark || undefined,
            });
        });

        if (missing.length > 0) {
            showToast(`⚠️ Item/Rate missing for: ${missing.slice(0, 2).join(', ')}${missing.length > 2 ? ` +${missing.length - 2} more` : ''}`);
            return;
        }
        if (validPayloads.length === 0) {
            showToast('⚠️ Kisi ka bhi Qty fill nahi hai!');
            return;
        }

        setSubmitting(true);
        const { addBulkEntries } = useProductionStore.getState();
        const result = await addBulkEntries(validPayloads);
        setSubmitting(false);

        if (result.failedCount > 0) {
            showToast(`⚠️ Partial Success: ${result.successCount} saved, ${result.failedCount} failed.`);
        } else {
            showToast(`✅ ${result.successCount} entries save ho gayi!`);
        }
        setTimeout(() => handleClose(), 1600);
    };

    const allSelected = activeEmployees.length > 0 && selectedEmpIds.size === activeEmployees.length;

    return (
        <div className="space-y-4">

            {/* Toast */}
            <AnimatePresence>
                {toast && (
                    <motion.div
                        initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
                        className="fixed top-4 left-1/2 -translate-x-1/2 z-[60] bg-dark-card border border-dark-border rounded-xl px-5 py-3 text-sm font-medium text-white shadow-2xl"
                    >
                        {toast}
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="glass border border-dark-border rounded-2xl overflow-hidden flex flex-col w-full">
                {/* ── Header ── */}
                <div className="px-5 py-3.5 border-b border-dark-border flex flex-wrap items-center justify-between bg-dark-bg/40 gap-3">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary-500/15 rounded-lg shrink-0">
                            <Users className="w-5 h-5 text-primary-400" />
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-white">Production Grid Entry</h2>
                            <p className="text-[10px] text-dark-muted">Ek din mein sabke liye entries ek saath bharo</p>
                        </div>
                    </div>
                    <button onClick={handleClose} className="text-dark-muted hover:text-white hover:bg-white/5 p-1.5 rounded-lg transition-colors shrink-0">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* ── Bulk Defaults Bar ── */}
                <div className="px-4 py-3 bg-primary-500/5 border-b border-primary-500/20">
                    <div className="flex items-center gap-2 mb-2.5">
                        <div className="flex items-center gap-1.5">
                            <div className="w-1.5 h-4 bg-primary-500 rounded-full" />
                            <span className="text-xs font-bold text-primary-300 uppercase tracking-wider">Bulk Defaults Applier</span>
                        </div>
                        <span className="text-[10px] text-dark-muted">— Ye bharo, employees select karo, phir "Apply to Selected" dabao</span>
                    </div>

                    <div className="flex flex-col md:flex-row md:flex-wrap items-stretch md:items-end gap-3">
                        {/* Date */}
                        <div className="w-full md:w-36">
                            <label className="text-[10px] text-dark-muted font-bold uppercase tracking-wider block mb-1">Date</label>
                            <input type="date" value={date} onChange={e => setDate(e.target.value)}
                                className="w-full bg-dark-bg border border-dark-border rounded-lg px-2.5 py-1.5 text-white text-sm focus:outline-none focus:border-primary-500" />
                        </div>

                        {/* Item */}
                        <div className="w-full md:flex-1 md:min-w-[180px] md:max-w-xs">
                            <div className="flex justify-between items-center mb-1">
                                <label className="text-[10px] text-dark-muted font-bold uppercase tracking-wider">Default Item</label>
                                <button type="button"
                                    onClick={() => { setSelectedMasterItem(null); setDefaultItemName(''); setDefaultItemId(''); setDefaultRate(''); setIsManual(!isManual); }}
                                    className="text-[10px] text-primary-400 hover:text-primary-300 font-medium underline underline-offset-2">
                                    {isManual ? 'Master list se' : 'Manual likho'}
                                </button>
                            </div>
                            {isManual ? (
                                <input type="text" placeholder="Item ka naam likho..."
                                    value={defaultItemName} onChange={e => setDefaultItemName(e.target.value)}
                                    className="w-full bg-dark-bg border border-dark-border rounded-lg px-2.5 py-1.5 text-white text-sm focus:border-primary-500 focus:outline-none" />
                            ) : (
                                <SearchableSelect
                                    options={items.map(i => ({ value: i.id, label: i.name, subLabel: `₹${i.rate}` }))}
                                    value={selectedMasterItem?.id || ''}
                                    onChange={val => {
                                        const item = getItem(val);
                                        if (item) { setSelectedMasterItem(item); setDefaultItemName(item.name); setDefaultItemId(item.id); setDefaultRate(item.rate.toString()); }
                                    }}
                                    placeholder="Item select karo..." />
                            )}
                        </div>

                        {/* Qty & Rate (side by side on mobile) */}
                        <div className="flex gap-3 w-full md:w-auto">
                            <div className="flex-1 md:w-24">
                                <label className="text-[10px] text-dark-muted font-bold uppercase tracking-wider block mb-1">Default Qty</label>
                                <input type="number" placeholder="0" value={defaultQty}
                                    onChange={e => setDefaultQty(e.target.value)}
                                    className="w-full bg-dark-bg border border-dark-border rounded-lg px-2.5 py-1.5 text-white text-sm focus:border-primary-500 focus:outline-none" />
                            </div>
                            <div className="flex-1 md:w-28">
                                <label className="text-[10px] text-dark-muted font-bold uppercase tracking-wider block mb-1">Default Rate (₹)</label>
                                <input type="number" placeholder="0" value={defaultRate}
                                    onChange={e => setDefaultRate(e.target.value)}
                                    className="w-full bg-dark-bg border border-dark-border rounded-lg px-2.5 py-1.5 text-white text-sm focus:border-primary-500 focus:outline-none" />
                            </div>
                        </div>

                        {/* Apply */}
                        <button onClick={applyDefaults}
                            disabled={selectedEmpIds.size === 0}
                            className={clsx(
                                'flex items-center justify-center gap-2 px-4 py-2 mt-1 md:mt-0 md:py-1.5 rounded-lg text-sm font-bold transition-all w-full md:w-auto',
                                selectedEmpIds.size > 0
                                    ? 'bg-primary-600 hover:bg-primary-500 text-white shadow-lg shadow-primary-500/20'
                                    : 'bg-dark-bg border border-dark-border text-dark-muted cursor-not-allowed'
                            )}>
                            <CheckSquare className="w-4 h-4" />
                            Apply to {selectedEmpIds.size > 0 ? selectedEmpIds.size : ''} Selected
                        </button>
                    </div>
                </div>

                {/* ── Filter Bar ── */}
                <div className="px-4 py-2 border-b border-dark-border flex items-center gap-3 bg-dark-bg/20 flex-wrap">
                    <div className="flex items-center gap-2">
                        <Filter className="w-3.5 h-3.5 text-dark-muted" />
                        <span className="text-xs text-dark-muted font-medium">Filter:</span>
                        <div className="flex flex-wrap gap-1">
                            {/* Only show departments from Production Grid Filter config */}
                            {departments.map(dept => (
                                <button key={dept} onClick={() => changeDept(dept)}
                                    className={clsx(
                                        'px-2.5 py-0.5 rounded-md text-xs font-medium transition-all',
                                        deptFilter === dept
                                            ? 'bg-primary-600 text-white'
                                            : 'bg-dark-bg text-dark-muted hover:text-white hover:bg-dark-border'
                                    )}>
                                    {dept}
                                </button>
                            ))}
                            {departments.length === 0 && (
                                <span className="text-xs text-dark-muted italic">System Config → Departments mein Production Grid Filter configure karo</span>
                            )}
                        </div>
                    </div>
                    <div className="ml-auto flex items-center gap-4 text-xs text-dark-muted">
                        <span><span className="text-white font-bold">{activeEmployees.length}</span> employees</span>
                        {filledCount > 0 && <span className="text-success font-bold">{filledCount} filled</span>}
                        {grandTotal > 0 && <span className="text-primary-300 font-mono font-bold">₹{grandTotal.toLocaleString('en-IN')} total</span>}
                    </div>
                </div>

                {/* ── Grid ── */}
                <div className="flex-1 overflow-auto">
                    {/* Regular dept-filtered view */}
                    {activeEmployees.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-dark-muted opacity-50 gap-3">
                            <Factory className="w-12 h-12" />
                            <p className="text-sm font-medium">Is department mein koi active employee nahi</p>
                            <button onClick={() => changeDept('ALL')} className="text-primary-400 text-xs underline">Sab dikhao</button>
                        </div>
                    ) : (
                        <div className="w-full text-left md:text-sm md:table border-t border-dark-border/20 md:border-none px-2 py-4 md:p-0">
                            <div className="hidden md:table-header-group bg-dark-bg sticky top-0 z-10 text-[11px] text-dark-muted uppercase tracking-wider font-bold">
                                <div className="md:table-row">
                                    <div className="md:table-cell px-4 py-2.5 w-10 text-center border-b border-dark-border/50">
                                        <button onClick={toggleSelectAll} className="hover:text-white transition-colors">
                                            {allSelected
                                                ? <CheckSquare className="w-4 h-4 text-primary-500" />
                                                : <Square className="w-4 h-4" />}
                                        </button>
                                    </div>
                                    <div className="md:table-cell px-4 py-2.5 w-52 border-b border-dark-border/50">Employee</div>
                                    <div className="md:table-cell px-4 py-2.5 min-w-[180px] border-b border-dark-border/50">Item / Work</div>
                                    <div className="md:table-cell px-4 py-2.5 w-24 border-b border-dark-border/50">Qty</div>
                                    <div className="md:table-cell px-4 py-2.5 w-28 border-b border-dark-border/50">Rate (₹)</div>
                                    <div className="md:table-cell px-4 py-2.5 w-28 text-right border-b border-dark-border/50">Total</div>
                                    <div className="md:table-cell px-4 py-2.5 min-w-[140px] border-b border-dark-border/50">Remark</div>
                                </div>
                            </div>
                            <div className="md:table-row-group flex flex-col gap-3">
                                {activeEmployees.map((emp) => {
                                    const isSelected = selectedEmpIds.has(emp.id);
                                    const row = getRow(emp.id);
                                    const qty = Number(row.qty) || 0;
                                    const rate = Number(row.rate) || 0;
                                    const total = qty * rate;
                                    const isFilled = qty > 0;

                                    return (
                                        <div key={emp.id}
                                            className={clsx(
                                                'group transition-colors',
                                                'flex flex-col gap-3 p-4 rounded-xl border border-dark-border/70 shadow-lg shadow-black/20 bg-dark-card relative', // Mobile
                                                'md:table-row md:shadow-none md:p-0 md:rounded-none md:border-none md:bg-transparent md:border-b md:border-dark-border/20', // Desktop
                                                isFilled && isSelected && 'border-l-4 border-l-success md:border-l-0 md:bg-success/5',
                                                isFilled && !isSelected && 'md:bg-success/3',
                                                isSelected && !isFilled && 'border-l-4 border-l-primary-500 md:border-l-0 md:bg-primary-500/10',
                                                !isSelected && !isFilled && 'md:hover:bg-white/[0.02]'
                                            )}>

                                            {/* Mobile Header: Checkbox + Employee Name + Total */}
                                            <div className="flex items-center justify-between md:contents">
                                                <div className="flex items-center gap-3 md:contents">
                                                    {/* Checkbox */}
                                                    <div className="md:table-cell md:align-middle md:px-4 md:py-2 text-center shrink-0">
                                                        <button onClick={() => toggleSelect(emp.id)} className="hover:scale-110 transition-transform flex items-center justify-center p-2 md:p-0">
                                                            {isSelected
                                                                ? <CheckSquare className="w-6 h-6 md:w-4 md:h-4 text-primary-500" />
                                                                : <Square className="w-6 h-6 md:w-4 md:h-4 text-dark-muted/50 group-hover:text-dark-muted transition-colors" />}
                                                        </button>
                                                    </div>

                                                    {/* Employee */}
                                                    <div className="md:table-cell md:align-middle md:px-4 md:py-2">
                                                        <div className="flex items-center gap-3 md:gap-2">
                                                            <div className={clsx(
                                                                'w-10 h-10 md:w-7 md:h-7 rounded-full flex items-center justify-center text-base md:text-xs font-bold shrink-0 shadow-inner',
                                                                isFilled ? 'bg-success text-white' : 'bg-dark-bg border border-dark-border text-dark-muted'
                                                            )}>
                                                                {emp.name[0]}
                                                            </div>
                                                            <div>
                                                                <p className="font-bold text-white text-[16px] md:font-medium md:text-[13px] leading-tight">{emp.name}</p>
                                                                {emp.designation && (
                                                                    <p className="text-[12px] md:text-[10px] text-primary-400 font-semibold leading-tight">{emp.designation}</p>
                                                                )}
                                                                <p className="text-[12px] md:text-[10px] text-dark-muted mt-0.5 md:mt-0 font-medium tracking-wide">{emp.code} <span className="text-dark-border mx-1">|</span> {emp.department || '—'}</p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Total (Mobile Only view of total directly in header) */}
                                                <div className="md:hidden font-mono font-bold text-right shrink-0">
                                                    {total > 0 ? (
                                                        <div className="flex flex-col items-end">
                                                            <span className="text-[10px] font-bold text-dark-muted uppercase tracking-wider mb-0.5">Total</span>
                                                            <span className="text-success text-lg leading-none">₹{total.toLocaleString('en-IN')}</span>
                                                        </div>
                                                    ) : (
                                                        <span className="text-dark-muted/40 text-sm">—</span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Form Inputs Grid */}
                                            <div className="grid grid-cols-2 gap-3 md:contents mt-2 md:mt-0">
                                                {/* Item */}
                                                <div className="col-span-2 md:col-span-1 md:table-cell md:align-middle md:px-4 md:py-2">
                                                    <div className="text-[10px] text-dark-muted mb-1.5 md:hidden uppercase font-bold tracking-wider">Item / Work</div>
                                                    <input type="text" placeholder="Item/kaam ka naam..."
                                                        value={row.item}
                                                        onChange={e => { updateRow(emp.id, { item: e.target.value, itemId: '' }); if (!isSelected) toggleSelect(emp.id); }}
                                                        className="w-full bg-dark-bg/60 md:bg-transparent border border-dark-border/40 md:border-0 md:border-b md:border-white/10 rounded-lg md:rounded-none focus:border-primary-500 outline-none px-3 py-2.5 md:px-1 md:py-1 text-white placeholder:text-dark-muted/50 text-[14px] md:text-[13px] transition-colors" />
                                                </div>

                                                {/* Qty */}
                                                <div className="md:table-cell md:align-middle md:px-4 md:py-2">
                                                    <div className="text-[10px] text-dark-muted mb-1.5 md:hidden uppercase font-bold tracking-wider">Qty</div>
                                                    <input type="number" placeholder="0" min={0}
                                                        value={row.qty}
                                                        onChange={e => { updateRow(emp.id, { qty: e.target.value }); if (!isSelected) toggleSelect(emp.id); }}
                                                        className={clsx(
                                                            'w-full bg-dark-bg/60 md:bg-transparent border border-dark-border/40 md:border-0 md:border-b md:border-white/10 rounded-lg md:rounded-none focus:border-primary-500 outline-none px-3 py-2.5 md:px-1 md:py-1 placeholder:text-dark-muted/50 font-mono text-[15px] md:text-[13px] transition-colors',
                                                            qty > 0 ? 'text-primary-300 font-bold shadow-inner' : 'text-white'
                                                        )} />
                                                </div>

                                                {/* Rate */}
                                                <div className="md:table-cell md:align-middle md:px-4 md:py-2">
                                                    <div className="text-[10px] text-dark-muted mb-1.5 md:hidden uppercase font-bold tracking-wider">Rate (₹)</div>
                                                    <input type="number" placeholder="0" min={0}
                                                        value={row.rate}
                                                        onChange={e => { updateRow(emp.id, { rate: e.target.value }); if (!isSelected) toggleSelect(emp.id); }}
                                                        className="w-full bg-dark-bg/60 md:bg-transparent border border-dark-border/40 md:border-0 md:border-b md:border-white/10 rounded-lg md:rounded-none focus:border-primary-500 outline-none px-3 py-2.5 md:px-1 md:py-1 text-white placeholder:text-dark-muted/50 font-mono text-[15px] md:text-[13px] transition-colors" />
                                                </div>
                                            </div>

                                            {/* Desktop Total */}
                                            <div className="hidden md:table-cell md:align-middle md:px-4 md:py-2 text-right font-mono font-bold text-[13px]">
                                                {total > 0 ? (
                                                    <span className="text-success">₹{total.toLocaleString('en-IN')}</span>
                                                ) : (
                                                    <span className="text-dark-muted/40">—</span>
                                                )}
                                            </div>

                                            {/* Remark */}
                                            <div className="mt-1 md:mt-0 md:table-cell md:align-middle md:px-4 md:py-2">
                                                <input type="text" placeholder="Remark (optional)"
                                                    value={row.remark}
                                                    onChange={e => { updateRow(emp.id, { remark: e.target.value }); if (!isSelected) toggleSelect(emp.id); }}
                                                    className="w-full bg-dark-bg/40 md:bg-transparent border border-dark-border/40 md:border-0 md:border-b md:border-white/10 rounded-lg md:rounded-none focus:border-primary-500 outline-none px-3 py-2 md:px-1 md:py-1 text-dark-muted focus:text-white placeholder:text-dark-muted/40 text-[13px] md:text-xs transition-colors" />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

                {/* ── Footer ── */}
                <div className="px-5 py-3 border-t border-dark-border bg-dark-bg/40 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4 text-sm">
                        <span className="text-dark-muted">
                            Selected: <span className="text-white font-bold">{selectedEmpIds.size}</span> employees
                        </span>
                        {filledCount > 0 && (
                            <span className="text-success text-xs flex items-center gap-1">
                                <CheckCircle className="w-3.5 h-3.5" /> {filledCount} rows ready
                            </span>
                        )}
                        {grandTotal > 0 && (
                            <span className="font-mono font-bold text-primary-300">
                                Grand Total: ₹{grandTotal.toLocaleString('en-IN')}
                            </span>
                        )}
                    </div>
                    <div className="flex gap-2">
                        <button onClick={onClose}
                            className="px-4 py-2 text-sm text-dark-muted hover:text-white border border-dark-border rounded-lg hover:bg-white/5 transition-all">
                            Cancel
                        </button>
                        <button onClick={handleSubmit}
                            disabled={selectedEmpIds.size === 0}
                            className={clsx(
                                'flex items-center gap-2 px-6 py-2.5 rounded-lg font-bold text-sm transition-all',
                                selectedEmpIds.size > 0
                                    ? 'bg-primary-600 hover:bg-primary-500 text-white shadow-lg shadow-primary-500/20 active:scale-[0.98]'
                                    : 'bg-dark-bg border border-dark-border text-dark-muted cursor-not-allowed'
                            )}>
                            <Save className="w-4 h-4" />
                            Save {selectedEmpIds.size > 0 ? `${selectedEmpIds.size} Entries` : 'Entries'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
