import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEmployeeStore } from '@/store/employeeStore';
import { useAuthStore } from '@/store/authStore';
import { PERMISSIONS } from '@/config/permissions';
import { useScopedEmployees } from '@/hooks/useScopedEmployees';
import {
    Search, Plus, Eye, Edit, Trash2, XCircle, Key,
    Filter, ChevronDown, X, ArrowUpDown, SlidersHorizontal,
    Users, UserCheck, UserX, Clock
} from 'lucide-react';
import { clsx } from 'clsx';
import { CredentialsModal } from '@/components/payroll/CredentialsModal';
import { SkeletonCardGrid } from '@/components/SkeletonLoaders';
import { Employee, EmployeeStatus, ShiftType, SalaryType } from '@/types';
import { useDialog } from '@/components/DialogProvider';

// ── Types ────────────────────────────────────────────────────────────────────
type SortKey = 'name' | 'department' | 'basicSalary' | 'joiningDate';
type SortDir = 'asc' | 'desc';

// ── Status badge config ───────────────────────────────────────────────────────
const STATUS_CONFIG: Record<EmployeeStatus, { label: string; cls: string; icon: React.ReactNode }> = {
    ACTIVE: { label: 'Active', cls: 'text-success bg-success/10 border-success/20', icon: <UserCheck className="w-3 h-3" /> },
    INACTIVE: { label: 'Inactive', cls: 'text-danger bg-danger/10 border-danger/20', icon: <UserX className="w-3 h-3" /> },
    ON_LEAVE: { label: 'On Leave', cls: 'text-warning bg-warning/10 border-warning/20', icon: <Clock className="w-3 h-3" /> },
    SUSPENDED: { label: 'Suspended', cls: 'text-dark-muted bg-dark-border/20 border-dark-border', icon: <XCircle className="w-3 h-3" /> },
};

const SHIFTS = [
    { value: 'All' as ShiftType | 'All', label: 'All Shifts' },
    { value: 'MORNING' as ShiftType, label: '🌅 Morning' },
    { value: 'EVENING' as ShiftType, label: '🌆 Evening' },
    { value: 'NIGHT' as ShiftType, label: '🌙 Night' },
    { value: 'GENERAL' as ShiftType, label: '☀️ General' },
];

const SALARY_TYPES = [
    { value: 'All' as SalaryType | 'All', label: 'All Types' },
    { value: SalaryType.MONTHLY, label: 'Monthly' },
    { value: SalaryType.DAILY, label: 'Daily' },
    { value: SalaryType.HOURLY, label: 'Hourly' },
    { value: SalaryType.PRODUCTION, label: 'Production' },
];

const SORT_OPTIONS: Array<{ key: SortKey; label: string }> = [
    { key: 'name', label: 'Name' },
    { key: 'department', label: 'Department' },
    { key: 'basicSalary', label: 'Salary' },
    { key: 'joiningDate', label: 'Joining Date' },
];

// ── Component ────────────────────────────────────────────────────────────────
export const EmployeeList = () => {
    const navigate = useNavigate();
    const { employees, isLoading, deleteEmployee } = useEmployeeStore();
    const { hasPermission } = useAuthStore();
    const { confirm } = useDialog();
    const [credentialEmployee, setCredentialEmployee] = useState<Employee | null>(null);
    const [showFilters, setShowFilters] = useState(false);

    // ── Row-Level Security ───────────────────────────────────────────────
    const { scopedEmployees } = useScopedEmployees();

    // ── Pagination State ─────────────────────────────────────────────────────
    const { totalCount, currentPage, totalPages, fetchEmployees } = useEmployeeStore();
    const [page, setPage] = useState(1);
    const limit = 50;

    // ── Filter state ─────────────────────────────────────────────────────────
    const [searchTerm, setSearchTerm] = useState('');
    const [deptFilter, setDeptFilter] = useState('All');
    const [statusFilter, setStatusFilter] = useState<EmployeeStatus | 'All'>('All');
    const [shiftFilter, setShiftFilter] = useState<ShiftType | 'All'>('All');
    const [salaryTypeFilter, setSalaryTypeFilter] = useState<SalaryType | 'All'>('All');
    const [salaryMin, setSalaryMin] = useState('');
    const [salaryMax, setSalaryMax] = useState('');
    const [designationFilter, setDesignationFilter] = useState('All');
    const [sortKey, setSortKey] = useState<SortKey>('name');
    const [sortDir, setSortDir] = useState<SortDir>('asc');

    // ── Derived Data (from full list loaded in store if available, or just from active)
    const departments = useMemo(() => ['All', ...new Set(scopedEmployees.map(e => e.department).filter(Boolean).sort())], [scopedEmployees]);
    const designations = useMemo(() => ['All', ...new Set(scopedEmployees.map(e => e.designation).filter(Boolean).sort())], [scopedEmployees]);

    // ── Server-Side Fetch Trigger ──────────────────────────────────────────────
    useEffect(() => {
        // Debounce search slightly
        const timer = setTimeout(() => {
            fetchEmployees({
                page,
                limit,
                search: searchTerm,
                status: statusFilter === 'All' ? undefined : statusFilter,
                department: deptFilter === 'All' ? undefined : deptFilter,
                shift: shiftFilter === 'All' ? undefined : shiftFilter,
            });
        }, 300);
        return () => clearTimeout(timer);
    }, [page, limit, searchTerm, statusFilter, deptFilter, shiftFilter, fetchEmployees]);

    // Reset page to 1 on new search
    useEffect(() => {
        setPage(1);
    }, [searchTerm]);

    // ── Count active filters ──────────────────────────────────────────────────
    const activeFilterCount = [
        deptFilter !== 'All',
        statusFilter !== 'All',
        shiftFilter !== 'All',
        salaryTypeFilter !== 'All',
        salaryMin !== '',
        salaryMax !== '',
        designationFilter !== 'All',
    ].filter(Boolean).length;

    // ── Reset all filters ─────────────────────────────────────────────────────
    const resetFilters = () => {
        setDeptFilter('All');
        setStatusFilter('All');
        setShiftFilter('All');
        setSalaryTypeFilter('All');
        setSalaryMin('');
        setSalaryMax('');
        setDesignationFilter('All');
        setSearchTerm('');
        setPage(1);
    };

    // ── Client-Side Post-Filtering (for properties not yet supported by backend OP)
    const filteredEmployees = useMemo(() => {
        const minSal = salaryMin ? Number(salaryMin) : null;
        const maxSal = salaryMax ? Number(salaryMax) : null;

        // Use scoped employees (Row-Level Security) as the base list
        const result = scopedEmployees.filter(emp => {
            if (deptFilter !== 'All' && emp.department !== deptFilter) return false;
            if (statusFilter !== 'All' && emp.status !== statusFilter) return false;
            if (shiftFilter !== 'All' && emp.shift !== shiftFilter) return false;
            if (salaryTypeFilter !== 'All' && emp.salaryType !== salaryTypeFilter) return false;
            if (designationFilter !== 'All' && emp.designation !== designationFilter) return false;
            if (minSal !== null && emp.basicSalary < minSal) return false;
            if (maxSal !== null && emp.basicSalary > maxSal) return false;
            return true;
        });

        result.sort((a, b) => {
            let va: any = a[sortKey];
            let vb: any = b[sortKey];
            if (typeof va === 'string') va = va.toLowerCase();
            if (typeof vb === 'string') vb = vb.toLowerCase();
            if (va < vb) return sortDir === 'asc' ? -1 : 1;
            if (va > vb) return sortDir === 'asc' ? 1 : -1;
            return 0;
        });

        return result;
    }, [employees, deptFilter, statusFilter, shiftFilter, salaryTypeFilter,
        salaryMin, salaryMax, designationFilter, sortKey, sortDir]);

    // ── Stats strip ──────────────────────────────────────────────────────────
    const totalActive = employees.filter(e => e.status === EmployeeStatus.ACTIVE).length;
    const totalInactive = employees.filter(e => e.status !== EmployeeStatus.ACTIVE).length;

    const toggleSort = (key: SortKey) => {
        if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        else { setSortKey(key); setSortDir('asc'); }
    };

    return (
        <div className="space-y-5">
            {credentialEmployee && (
                <CredentialsModal employee={credentialEmployee} onClose={() => setCredentialEmployee(null)} />
            )}

            {/* ── Header ─────────────────────────────────────────── */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-dark-text mb-0.5">Employee Directory</h1>
                    <p className="text-dark-muted text-sm">
                        {employees.length} total &nbsp;·&nbsp;
                        <span className="text-success">{totalActive} active</span> &nbsp;·&nbsp;
                        <span className="text-danger">{totalInactive} inactive</span>
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {hasPermission(PERMISSIONS.ADD_EMPLOYEE) && (
                        <button
                            onClick={() => navigate('/employees/new')}
                            className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-500 text-white rounded-xl transition-all shadow-lg shadow-primary-600/20 text-sm font-medium"
                        >
                            <Plus className="w-4 h-4" />
                            Add Employee
                        </button>
                    )}
                </div>
            </div>

            {/* ── Search + filter toggle row ──────────────────────── */}
            <div className="flex gap-2">
                {/* Search */}
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-muted" />
                    <input
                        type="text"
                        placeholder="Search name, ID, designation, phone, email…"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full bg-dark-bg border border-dark-border rounded-xl pl-10 pr-10 py-2.5 text-dark-text placeholder-dark-muted focus:outline-none focus:border-primary-500 transition-colors text-sm"
                    />
                    {searchTerm && (
                        <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-muted hover:text-white">
                            <X className="w-4 h-4" />
                        </button>
                    )}
                </div>

                {/* Filter toggle */}
                <button
                    onClick={() => setShowFilters(f => !f)}
                    className={clsx(
                        'flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all',
                        showFilters || activeFilterCount > 0
                            ? 'bg-primary-600/20 border-primary-500 text-primary-400'
                            : 'bg-dark-bg border-dark-border text-dark-muted hover:text-dark-text'
                    )}
                >
                    <SlidersHorizontal className="w-4 h-4" />
                    Filters
                    {activeFilterCount > 0 && (
                        <span className="bg-primary-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold">
                            {activeFilterCount}
                        </span>
                    )}
                </button>

                {/* Sort dropdown */}
                <div className="relative group">
                    <button className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-dark-border bg-dark-bg text-dark-muted hover:text-dark-text text-sm transition-colors">
                        <ArrowUpDown className="w-4 h-4" />
                        Sort
                        <ChevronDown className="w-3 h-3" />
                    </button>
                    <div className="absolute right-0 top-full mt-2 w-44 bg-dark-card border border-dark-border rounded-xl shadow-2xl z-30 overflow-hidden opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
                        {SORT_OPTIONS.map(opt => (
                            <button
                                key={opt.key}
                                onClick={() => toggleSort(opt.key)}
                                className={clsx(
                                    "w-full text-left px-4 py-2.5 text-sm flex items-center justify-between transition-colors",
                                    sortKey === opt.key
                                        ? "text-primary-400 bg-primary-500/10"
                                        : "text-dark-text hover:bg-white/5"
                                )}
                            >
                                {opt.label}
                                {sortKey === opt.key && (
                                    <span className="text-xs text-dark-muted">{sortDir === 'asc' ? '↑' : '↓'}</span>
                                )}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* ── Advanced filter panel ───────────────────────────── */}
            {showFilters && (
                <div className="glass rounded-2xl border border-dark-border p-4 space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                        {/* Department */}
                        <div>
                            <label className="block text-xs text-dark-muted mb-1.5 font-medium">Department</label>
                            <select
                                value={deptFilter}
                                onChange={e => setDeptFilter(e.target.value)}
                                className="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-dark-text text-sm focus:outline-none focus:border-primary-500 transition-colors"
                            >
                                {departments.map(d => <option key={d} value={d}>{d}</option>)}
                            </select>
                        </div>

                        {/* Designation */}
                        <div>
                            <label className="block text-xs text-dark-muted mb-1.5 font-medium">Designation</label>
                            <select
                                value={designationFilter}
                                onChange={e => setDesignationFilter(e.target.value)}
                                className="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-dark-text text-sm focus:outline-none focus:border-primary-500 transition-colors"
                            >
                                {designations.map(d => <option key={d} value={d}>{d}</option>)}
                            </select>
                        </div>

                        {/* Shift */}
                        <div>
                            <label className="block text-xs text-dark-muted mb-1.5 font-medium">Shift</label>
                            <select
                                value={shiftFilter}
                                onChange={e => setShiftFilter(e.target.value as any)}
                                className="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-dark-text text-sm focus:outline-none focus:border-primary-500 transition-colors"
                            >
                                {SHIFTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                            </select>
                        </div>

                        {/* Salary Type */}
                        <div>
                            <label className="block text-xs text-dark-muted mb-1.5 font-medium">Salary Type</label>
                            <select
                                value={salaryTypeFilter}
                                onChange={e => setSalaryTypeFilter(e.target.value as any)}
                                className="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-dark-text text-sm focus:outline-none focus:border-primary-500 transition-colors"
                            >
                                {SALARY_TYPES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                            </select>
                        </div>

                        {/* Salary Min */}
                        <div>
                            <label className="block text-xs text-dark-muted mb-1.5 font-medium">Min Salary (₹)</label>
                            <input
                                type="number"
                                placeholder="0"
                                value={salaryMin}
                                onChange={e => setSalaryMin(e.target.value)}
                                className="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-dark-text text-sm focus:outline-none focus:border-primary-500 transition-colors"
                            />
                        </div>

                        {/* Salary Max */}
                        <div>
                            <label className="block text-xs text-dark-muted mb-1.5 font-medium">Max Salary (₹)</label>
                            <input
                                type="number"
                                placeholder="∞"
                                value={salaryMax}
                                onChange={e => setSalaryMax(e.target.value)}
                                className="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-dark-text text-sm focus:outline-none focus:border-primary-500 transition-colors"
                            />
                        </div>
                    </div>

                    {/* Status filter chips */}
                    <div>
                        <label className="block text-xs text-dark-muted mb-2 font-medium">Status</label>
                        <div className="flex flex-wrap gap-2">
                            {(['All', ...Object.values(EmployeeStatus)] as Array<EmployeeStatus | 'All'>).map(s => (
                                <button
                                    key={s}
                                    onClick={() => setStatusFilter(s)}
                                    className={clsx(
                                        "flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-all",
                                        statusFilter === s
                                            ? (s === 'All' ? "bg-primary-500 border-primary-500 text-white" : STATUS_CONFIG[s].cls + ' border opacity-100')
                                            : "bg-dark-bg border-dark-border text-dark-muted hover:text-dark-text"
                                    )}
                                >
                                    {s !== 'All' && STATUS_CONFIG[s].icon}
                                    {s === 'All' ? 'All' : STATUS_CONFIG[s].label}
                                    {s !== 'All' && (
                                        <span className="text-[10px] opacity-70">
                                            {employees.filter(e => e.status === s).length}
                                        </span>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Reset */}
                    {activeFilterCount > 0 && (
                        <div className="pt-2 border-t border-dark-border/50">
                            <button
                                onClick={resetFilters}
                                className="text-xs text-danger hover:text-red-400 flex items-center gap-1.5 transition-colors"
                            >
                                <X className="w-3 h-3" />
                                Clear all filters
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* ── Active filter chips ─────────────────────────────── */}
            {activeFilterCount > 0 && !showFilters && (
                <div className="flex flex-wrap gap-2">
                    {deptFilter !== 'All' && (
                        <span className="flex items-center gap-1.5 px-2.5 py-1 bg-primary-500/10 border border-primary-500/30 rounded-full text-xs text-primary-400">
                            Dept: {deptFilter}
                            <button onClick={() => setDeptFilter('All')}><X className="w-3 h-3" /></button>
                        </span>
                    )}
                    {designationFilter !== 'All' && (
                        <span className="flex items-center gap-1.5 px-2.5 py-1 bg-primary-500/10 border border-primary-500/30 rounded-full text-xs text-primary-400">
                            Role: {designationFilter}
                            <button onClick={() => setDesignationFilter('All')}><X className="w-3 h-3" /></button>
                        </span>
                    )}
                    {statusFilter !== 'All' && (
                        <span className="flex items-center gap-1.5 px-2.5 py-1 bg-primary-500/10 border border-primary-500/30 rounded-full text-xs text-primary-400">
                            Status: {STATUS_CONFIG[statusFilter].label}
                            <button onClick={() => setStatusFilter('All')}><X className="w-3 h-3" /></button>
                        </span>
                    )}
                    {shiftFilter !== 'All' && (
                        <span className="flex items-center gap-1.5 px-2.5 py-1 bg-primary-500/10 border border-primary-500/30 rounded-full text-xs text-primary-400">
                            Shift: {shiftFilter}
                            <button onClick={() => setShiftFilter('All')}><X className="w-3 h-3" /></button>
                        </span>
                    )}
                    {salaryTypeFilter !== 'All' && (
                        <span className="flex items-center gap-1.5 px-2.5 py-1 bg-primary-500/10 border border-primary-500/30 rounded-full text-xs text-primary-400">
                            Pay: {salaryTypeFilter}
                            <button onClick={() => setSalaryTypeFilter('All')}><X className="w-3 h-3" /></button>
                        </span>
                    )}
                    {(salaryMin || salaryMax) && (
                        <span className="flex items-center gap-1.5 px-2.5 py-1 bg-primary-500/10 border border-primary-500/30 rounded-full text-xs text-primary-400">
                            ₹ {salaryMin || '0'} – {salaryMax || '∞'}
                            <button onClick={() => { setSalaryMin(''); setSalaryMax(''); }}><X className="w-3 h-3" /></button>
                        </span>
                    )}
                    <button onClick={resetFilters} className="text-xs text-danger hover:text-red-400 flex items-center gap-1 ml-1">
                        <X className="w-3 h-3" /> Clear all
                    </button>
                </div>
            )}

            {/* ── Result count ────────────────────────────────────── */}
            {!isLoading && (
                <div className="flex items-center justify-between flex-wrap gap-4 text-xs text-dark-muted">
                    <span className="flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5" />
                        Showing <span className="text-dark-text font-semibold">{filteredEmployees.length}</span> of {totalCount} total employees
                    </span>
                    {filteredEmployees.length === 0 && (
                        <span className="text-warning">No employees match your filters</span>
                    )}
                    {/* Pagination Controls */}
                    {totalPages > 1 && (
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page === 1}
                                className="px-3 py-1.5 rounded-lg border border-dark-border bg-dark-bg hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                Previous
                            </button>
                            <span className="text-dark-text font-medium px-2">Page {currentPage} of {totalPages}</span>
                            <button
                                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                disabled={page === totalPages}
                                className="px-3 py-1.5 rounded-lg border border-dark-border bg-dark-bg hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                Next
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* ── Employee grid ────────────────────────────────────── */}
            {isLoading ? (
                <SkeletonCardGrid cards={6} />
            ) : filteredEmployees.length === 0 ? (
                <div className="glass rounded-2xl border border-dark-border p-16 text-center space-y-3">
                    <Filter className="w-12 h-12 text-dark-border mx-auto" />
                    <p className="text-dark-text font-semibold">No employees found</p>
                    <p className="text-dark-muted text-sm">Try changing your search or filters</p>
                    <button onClick={resetFilters} className="text-sm text-primary-400 hover:text-primary-300 underline">
                        Reset all filters
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {filteredEmployees.map((employee) => {
                        const statusCfg = STATUS_CONFIG[employee.status];
                        return (
                            <div
                                key={employee.id}
                                className="glass group relative overflow-hidden rounded-2xl border border-dark-border/50 hover:border-primary-500/50 transition-all duration-300 hover:shadow-lg hover:shadow-primary-500/10 hover:-translate-y-0.5"
                            >
                                {/* Status indicator strip */}
                                <div className={clsx(
                                    "h-1 w-full",
                                    employee.status === EmployeeStatus.ACTIVE ? "bg-success" :
                                        employee.status === EmployeeStatus.INACTIVE ? "bg-danger" :
                                            employee.status === EmployeeStatus.ON_LEAVE ? "bg-warning" : "bg-dark-border"
                                )} />

                                <div className="p-5 flex flex-col items-center text-center">
                                    {/* Avatar */}
                                    <div className="w-18 h-18 rounded-full p-0.5 bg-gradient-to-br from-primary-500/50 to-purple-600/50 mb-3">
                                        <img
                                            src={employee.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${employee.name}`}
                                            alt={employee.name}
                                            className="w-full h-full rounded-full object-cover border-2 border-dark-bg"
                                            style={{ width: '68px', height: '68px' }}
                                        />
                                    </div>

                                    <h3 className="text-base font-bold text-dark-text mb-0.5 leading-tight">{employee.name}</h3>
                                    <p className="text-primary-400 text-xs font-medium mb-1">{employee.designation}</p>
                                    <span className="px-2 py-0.5 rounded-md bg-dark-bg border border-dark-border text-xs text-dark-muted font-mono">
                                        {employee.code}
                                    </span>

                                    {/* Status badge */}
                                    <span className={clsx(
                                        "mt-2 flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-semibold",
                                        statusCfg.cls
                                    )}>
                                        {statusCfg.icon}
                                        {statusCfg.label}
                                    </span>

                                    {/* Info row */}
                                    <div className="w-full mt-4 pt-4 border-t border-dark-border/50 grid grid-cols-2 gap-2 text-left">
                                        <div>
                                            <p className="text-dark-muted text-[10px] uppercase tracking-wider">Department</p>
                                            <p className="text-dark-text text-xs font-medium truncate">{employee.department}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-dark-muted text-[10px] uppercase tracking-wider">Shift</p>
                                            <p className="text-dark-text text-xs font-medium">{employee.shift || '—'}</p>
                                        </div>
                                        <div>
                                            <p className="text-dark-muted text-[10px] uppercase tracking-wider">Salary</p>
                                            <p className="text-dark-text text-xs font-medium">
                                                {hasPermission(PERMISSIONS.VIEW_EMPLOYEE_SALARY)
                                                    ? `₹${(employee.basicSalary || 0).toLocaleString()}`
                                                    : '****'}
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-dark-muted text-[10px] uppercase tracking-wider">Type</p>
                                            <p className="text-dark-text text-xs font-medium">{employee.salaryType || '—'}</p>
                                        </div>
                                    </div>

                                    {/* Actions Footer — always visible on mobile, hover-reveal on desktop */}
                                    <div className="inset-x-0 bottom-0 p-3 bg-dark-card/95 backdrop-blur-sm flex items-center justify-center gap-2
                                        absolute translate-y-0 md:translate-y-full md:group-hover:translate-y-0 transition-transform duration-300">
                                        {hasPermission(PERMISSIONS.EDIT_EMPLOYEE) && (
                                            <button
                                                onClick={() => setCredentialEmployee(employee)}
                                                className="p-1.5 rounded-lg bg-info/10 text-info hover:bg-info hover:text-white transition-colors"
                                                title="Credentials"
                                            >
                                                <Key className="w-4 h-4" />
                                            </button>
                                        )}
                                        <button
                                            onClick={() => navigate(`/employees/${employee.id}`)}
                                            className="p-1.5 rounded-lg bg-primary-500/10 text-primary-500 hover:bg-primary-500 hover:text-white transition-colors"
                                            title="View Profile"
                                        >
                                            <Eye className="w-4 h-4" />
                                        </button>
                                        {hasPermission(PERMISSIONS.EDIT_EMPLOYEE) && (
                                            <button
                                                onClick={() => navigate(`/employees/${employee.id}/edit`)}
                                                className="p-1.5 rounded-lg bg-warning/10 text-warning hover:bg-warning hover:text-white transition-colors"
                                                title="Edit"
                                            >
                                                <Edit className="w-4 h-4" />
                                            </button>
                                        )}
                                        {hasPermission(PERMISSIONS.DELETE_EMPLOYEE) && (
                                            <button
                                                onClick={async () => {
                                                    const ok = await confirm({
                                                        title: 'Employee Delete Karein?',
                                                        message: `"${employee.name}" ko permanently delete karna chahte hain?`,
                                                        detail: 'Iska sara payroll aur attendance data bhi delete ho jayega.',
                                                        confirmLabel: 'Haan, Delete Karo',
                                                        cancelLabel: 'Cancel',
                                                        variant: 'danger',
                                                    });
                                                    if (ok) deleteEmployee(employee.id);
                                                }}
                                                className="p-1.5 rounded-lg bg-danger/10 text-danger hover:bg-danger hover:text-white transition-colors"
                                                title="Delete"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        )}
                                        {hasPermission(PERMISSIONS.MANAGE_ROLES) && (
                                            <button
                                                onClick={() => useEmployeeStore.getState().toggleLeaveBlock(employee.id)}
                                                className={clsx(
                                                    "p-1.5 rounded-lg transition-colors border",
                                                    employee.isLeaveBlocked
                                                        ? "bg-danger text-white border-danger"
                                                        : "bg-dark-bg text-dark-muted border-dark-border hover:text-white"
                                                )}
                                                title={employee.isLeaveBlocked ? "Unblock Leaves" : "Block Leaves"}
                                            >
                                                <XCircle className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};
