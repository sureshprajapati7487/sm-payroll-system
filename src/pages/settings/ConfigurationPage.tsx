import React, { useState, useEffect } from 'react';
import { InfoTip } from '@/components/ui/InfoTip';
import { useInternalDepartmentStore, useDepartmentStore, DeptSalaryBasis } from '@/store/departmentStore';
import { useMultiCompanyStore } from '@/store/multiCompanyStore';
import { useInternalWorkGroupStore, useWorkGroupStore } from '@/store/workGroupStore';
import { useInternalSalaryTypeStore, useSalaryTypeStore } from '@/store/salaryTypeStore';
import { useInternalAttendanceActionStore, useAttendanceActionStore } from '@/store/attendanceActionStore';
import { useInternalPunchLocationStore, usePunchLocationStore } from '@/store/punchLocationStore';
import { useInternalSystemSettingStore, useSystemSettingStore } from '@/store/systemSettingStore';
import { useInternalShiftStore, useShiftStore } from '@/store/shiftStore';
import { useSystemConfigStore } from '@/store/systemConfigStore';
import { useSystemKeyStore, useInternalSystemKeyStore } from '@/store/systemKeyStore';
import { useAuthStore } from '@/store/authStore';
import { useHolidayStore } from '@/store/holidayStore';
import { PERMISSIONS } from '@/config/permissions';
import { Roles } from '@/types';
import { Building2, Clock, Plus, Trash2, Edit2, Save, X, Briefcase, Gavel, FileCheck, AlertOctagon, IndianRupee, CalendarCheck, Key, Lock, Eye, EyeOff, Calendar, Camera, MapPin, Fingerprint, ScanFace, Navigation, ToggleLeft, ToggleRight, Crosshair, Shield, Network, Settings2 } from 'lucide-react';
import { WarningModal } from '@/components/ui/WarningModal';
import { StatutorySettings } from './StatutorySettings';
import { RoleAccessConfig } from './RoleAccessConfig';
import { CustomFieldsConfig } from './CustomFieldsConfig';
import { WorkflowBuilder } from './WorkflowConfig';

const SALARY_BASIS_OPTIONS: { value: DeptSalaryBasis; label: string; desc: string; color: string }[] = [
    { value: 'FIXED', label: 'Fixed Monthly', desc: 'Same salary every month (HR, Accounts, Security)', color: 'blue' },
    { value: 'PRODUCTION', label: 'Production Based', desc: 'Pay per unit/attendance (Factory, Line Workers)', color: 'orange' },
    { value: 'SALES', label: 'Sales / Commission', desc: 'Target + commission based (Sales, Marketing)', color: 'green' },
    { value: 'DAILY', label: 'Daily Wage', desc: 'Paid per day worked (Casual, Labour)', color: 'yellow' },
    { value: 'CONTRACTUAL', label: 'Contractual', desc: 'Project or contract-based (IT, Freelancers)', color: 'purple' },
];

const SALARY_BASIS_BADGE: Record<DeptSalaryBasis, { label: string; cls: string }> = {
    FIXED: { label: '📅 Fixed', cls: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
    PRODUCTION: { label: '🏭 Production', cls: 'bg-orange-500/20 text-orange-300 border-orange-500/30' },
    SALES: { label: '📈 Sales', cls: 'bg-green-500/20 text-green-300 border-green-500/30' },
    DAILY: { label: '🗓️ Daily Wage', cls: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30' },
    CONTRACTUAL: { label: '📝 Contract', cls: 'bg-purple-500/20 text-purple-300 border-purple-500/30' },
};

// ─── KeyRow component (for System Keys table) ─────────────────────────────
const KeyRow = ({ sk, isLast, onDelete, onUpdate }: {
    sk: { id: string; key: string; label: string; value: string; description: string; isSecret: boolean };
    isLast: boolean;
    onDelete: () => void;
    onUpdate: (data: { value: string }) => void;
}) => {
    const [shown, setShown] = useState(false);
    const [editing, setEditing] = useState(false);
    const [val, setVal] = useState(sk.value);
    return (
        <div className={`flex items-center gap-3 px-4 py-3 hover:bg-slate-700/20 transition-all ${!isLast ? 'border-b border-slate-700/30' : ''}`}>
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-white truncate">{sk.label}</span>
                </div>
                <span className="text-xs font-mono text-slate-500">{sk.key}</span>
                {sk.description && <p className="text-xs text-slate-500 truncate mt-0.5">{sk.description}</p>}
            </div>
            <div className="flex items-center gap-2 shrink-0">
                {editing ? (
                    <div className="flex items-center gap-1">
                        <input autoFocus value={val} onChange={e => setVal(e.target.value)} className="bg-slate-900 border border-amber-500/50 rounded px-2 py-1 text-sm text-white w-28 outline-none font-mono" />
                        <button onClick={() => { onUpdate({ value: val }); setEditing(false); }} className="p-1.5 bg-amber-600 hover:bg-amber-500 rounded text-white"><Save className="w-3 h-3" /></button>
                        <button onClick={() => { setVal(sk.value); setEditing(false); }} className="p-1.5 bg-slate-700 hover:bg-slate-600 rounded text-white"><X className="w-3 h-3" /></button>
                    </div>
                ) : (
                    <span className="text-sm font-mono text-amber-300 bg-slate-900 px-2 py-0.5 rounded">
                        {sk.isSecret ? (shown ? sk.value : '••••••') : sk.value}
                    </span>
                )}
                {sk.isSecret && !editing && (
                    <button onClick={() => setShown(s => !s)} className="p-1 text-slate-500 hover:text-slate-300">
                        {shown ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                )}
                {!editing && <button onClick={() => setEditing(true)} className="p-1 text-slate-500 hover:text-amber-400"><Edit2 className="w-3.5 h-3.5" /></button>}
                <button onClick={onDelete} className="p-1 text-slate-500 hover:text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
        </div>
    );
};

// ─── WorkAllocationPanel ─────────────────────────────────────────────────────
const WA_COLOR_CLS: Record<string, { bg: string; text: string; border: string }> = {
    blue: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/30' },
    emerald: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30' },
    violet: { bg: 'bg-violet-500/10', text: 'text-violet-400', border: 'border-violet-500/30' },
    orange: { bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/30' },
    pink: { bg: 'bg-pink-500/10', text: 'text-pink-400', border: 'border-pink-500/30' },
    cyan: { bg: 'bg-cyan-500/10', text: 'text-cyan-400', border: 'border-cyan-500/30' },
    yellow: { bg: 'bg-yellow-500/10', text: 'text-yellow-400', border: 'border-yellow-500/30' },
    rose: { bg: 'bg-rose-500/10', text: 'text-rose-400', border: 'border-rose-500/30' },
};

const WorkAllocationPanel = ({
    workGroups, assignments, addGroup, removeGroup, getGroupEmployees, departments,
    mainDepartments, productionGridDepts, setProductionGridDepts,
}: {
    workGroups: { id: string; name: string; department: string; color: string; icon?: string }[];
    assignments: Record<string, string>;
    addGroup: (g: { name: string; department: string; color: string; icon: string }) => void;
    removeGroup: (id: string) => void;
    getGroupEmployees: (id: string) => string[];
    departments: string[];
    mainDepartments: { id: string; name: string }[];
    productionGridDepts: string[];
    setProductionGridDepts: (ids: string[]) => void;
}) => {
    const [newName, setNewName] = useState('');
    const [newDept, setNewDept] = useState(departments[0] || '');
    const [newColor, setNewColor] = useState('blue');
    const [newIcon, setNewIcon] = useState('🏭');

    const handleAdd = () => {
        if (!newName.trim()) return;
        addGroup({ name: newName.trim(), department: newDept || 'General', color: newColor, icon: newIcon });
        setNewName('');
        setNewColor('blue');
        setNewIcon('🏭');
    };

    const totalAssigned = Object.keys(assignments).length;

    // Group by department
    const byDept = departments.reduce<Record<string, typeof workGroups>>((acc, d) => {
        acc[d] = workGroups.filter(g => g.department === d);
        return acc;
    }, {});
    const otherGroups = workGroups.filter(g => !departments.includes(g.department));

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* LEFT: Create form */}
            <div className="space-y-6">
                <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6">
                    <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
                        <Plus className="w-4 h-4 text-violet-400" /> Add Department
                    </h3>
                    <div className="space-y-3">
                        {/* Department Name */}
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-slate-400 uppercase">Department Name</label>
                            <input
                                type="text"
                                value={newName}
                                onChange={e => setNewName(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleAdd()}
                                placeholder="e.g. Cutting Department"
                                className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500"
                            />
                        </div>
                        {/* Parent Dept (optional) */}
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-slate-400 uppercase">Under Department (optional)</label>
                            <select value={newDept} onChange={e => setNewDept(e.target.value)}
                                className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500">
                                <option value="">-- None --</option>
                                {departments.map(d => <option key={d}>{d}</option>)}
                            </select>
                        </div>
                        <button onClick={handleAdd} disabled={!newName.trim()}
                            className={`w-full py-2.5 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${newName.trim()
                                ? 'bg-violet-600 hover:bg-violet-500 text-white'
                                : 'bg-slate-700 text-slate-500 cursor-not-allowed'}`}>
                            <Plus className="w-4 h-4" /> Add Department
                        </button>
                    </div>
                </div>

                {/* Stats */}
                <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-4 space-y-2">
                    <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">Summary</p>
                    <div className="flex justify-between text-sm">
                        <span className="text-slate-400">Total Groups</span>
                        <span className="text-white font-bold">{workGroups.length}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                        <span className="text-slate-400">Assigned Employees</span>
                        <span className="text-violet-400 font-bold">{totalAssigned}</span>
                    </div>
                </div>

                {/* Production Grid Filter Config */}
                <div className="bg-slate-800/30 border border-violet-500/20 rounded-xl p-4 space-y-3">
                    <div>
                        <p className="text-xs font-bold text-violet-400 uppercase tracking-wider">🏭 Production Grid Filter</p>
                        <p className="text-[10px] text-slate-500 mt-0.5">
                            Kaunse departments Production Grid Entry mein dikhenge?
                        </p>
                    </div>
                    {mainDepartments.length === 0 ? (
                        <p className="text-xs text-slate-600 italic">Pehle Work Allocation tab mein departments banao</p>
                    ) : (
                        <div className="space-y-2">
                            {mainDepartments.map(dept => {
                                const checked = productionGridDepts.length === 0 || productionGridDepts.includes(dept.id);
                                const isSelected = productionGridDepts.includes(dept.id);
                                const toggle = () => {
                                    if (productionGridDepts.length === 0) {
                                        // Currently "all" — deselect this one
                                        setProductionGridDepts(mainDepartments.filter(d => d.id !== dept.id).map(d => d.id));
                                    } else {
                                        const next = isSelected
                                            ? productionGridDepts.filter(id => id !== dept.id)
                                            : [...productionGridDepts, dept.id];
                                        // If all selected, store as empty (= show all)
                                        setProductionGridDepts(next.length === mainDepartments.length ? [] : next);
                                    }
                                };
                                return (
                                    <label key={dept.id} className="flex items-center gap-2.5 cursor-pointer group">
                                        <div onClick={toggle}
                                            className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all ${checked ? 'bg-violet-600 border-violet-600' : 'border-slate-600 bg-slate-900 group-hover:border-violet-500'}`}>
                                            {checked && <span className="text-white text-[10px] font-bold">✓</span>}
                                        </div>
                                        <span className="text-sm text-slate-300 group-hover:text-white transition-colors">{dept.name}</span>
                                    </label>
                                );
                            })}
                            <p className="text-[10px] text-slate-600 pt-1 border-t border-slate-700/50">
                                {productionGridDepts.length === 0 ? '✅ Sab departments dikh rahe hain' : `${productionGridDepts.length} department${productionGridDepts.length > 1 ? 's' : ''} selected`}
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* RIGHT: Groups list by department */}
            <div className="lg:col-span-2 space-y-6">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                    Departments
                    <span className="text-xs text-slate-500 font-normal">({workGroups.length} total)</span>
                </h3>

                {workGroups.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-slate-500 opacity-50 gap-3 bg-slate-800/20 rounded-2xl border border-dashed border-slate-700">
                        <span className="text-4xl">🏭</span>
                        <p className="text-sm font-medium">Koi group nahi banaya abhi</p>
                        <p className="text-xs">Left side se pehla group banao</p>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {Object.entries(byDept).map(([dept, groups]) => groups.length === 0 ? null : (
                            <div key={dept}>
                                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">{dept}</p>
                                <div className="space-y-2">
                                    {groups.map(g => {
                                        const col = WA_COLOR_CLS[g.color] || WA_COLOR_CLS.blue;
                                        const count = getGroupEmployees(g.id).length;
                                        return (
                                            <div key={g.id}
                                                className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${col.border} ${col.bg} group`}>
                                                <span className="text-xl">{g.icon || '🏭'}</span>
                                                <div className="flex-1">
                                                    <p className={`font-bold text-sm ${col.text}`}>{g.name}</p>
                                                    <p className="text-xs text-slate-500">{count} employees assigned</p>
                                                </div>
                                                <button
                                                    onClick={() => { if (window.confirm(`"${g.name}" group delete karna chahte ho? ${count > 0 ? `(${count} employees unassign ho jaenge)` : ''}`)) removeGroup(g.id); }}
                                                    className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 p-1.5 hover:bg-red-500/10 rounded-lg transition-all">
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                        {otherGroups.length > 0 && (
                            <div>
                                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">General</p>
                                <div className="space-y-2">
                                    {otherGroups.map(g => {
                                        const col = WA_COLOR_CLS[g.color] || WA_COLOR_CLS.blue;
                                        const count = getGroupEmployees(g.id).length;
                                        return (
                                            <div key={g.id}
                                                className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${col.border} ${col.bg} group`}>
                                                <span className="text-xl">{g.icon || '🏭'}</span>
                                                <div className="flex-1">
                                                    <p className={`font-bold text-sm ${col.text}`}>{g.name}</p>
                                                    <p className="text-xs text-slate-500">{g.department} · {count} employees assigned</p>
                                                </div>
                                                <button
                                                    onClick={() => { if (window.confirm(`"${g.name}" delete karein?`)) removeGroup(g.id); }}
                                                    className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 p-1.5 hover:bg-red-500/10 rounded-lg transition-all">
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Tip */}
                <div className="bg-violet-500/5 border border-violet-500/20 rounded-xl px-4 py-3 flex gap-2">
                    <span className="text-violet-400 text-sm">💡</span>
                    <p className="text-xs text-slate-400">
                        Group banane ke baad, <strong className="text-white">Employee edit page → Work Allocation</strong> se individual assign karo. Ya Production Grid Entry → <strong className="text-white">Work Allocation view</strong> se dekho.
                    </p>
                </div>
            </div>
        </div>
    );
};


// ─── Salesman Configuration Panel ────────────────────────────────────────────
const LS_SALES_CFG = 'sm-salesman-config';

interface SalesConfig {
    // Visit Settings
    gpsRadiusMeters: number;
    maxDailyVisits: number;
    minVisitDurationMins: number;
    maxVisitDurationMins: number;
    checkInStartTime: string;
    checkInEndTime: string;
    // Commission
    baseCommissionPct: number;
    bonusThreshold1: number;
    bonusThreshold1Pct: number;
    bonusThreshold2: number;
    bonusThreshold2Pct: number;
    // Targets
    dailyVisitTarget: number;
    monthlyOrderTarget: number;
    monthlyCollectionTarget: number;
    // Client
    maxClientsPerSalesman: number;
    overdueAlertDays: number;
    // Toggles
    gpsRequired: boolean;
    photoRequired: boolean;
    competitorTracking: boolean;
    offlineMode: boolean;
    autoCheckout: boolean;
    autoCheckoutHours: number;
    // Visit Purposes (custom)
    visitPurposes: { key: string; label: string; emoji: string }[];
}

const DEFAULT_SALES_CFG: SalesConfig = {
    gpsRadiusMeters: 50,
    maxDailyVisits: 20,
    minVisitDurationMins: 5,
    maxVisitDurationMins: 180,
    checkInStartTime: '08:00',
    checkInEndTime: '20:00',
    baseCommissionPct: 2,
    bonusThreshold1: 50000,
    bonusThreshold1Pct: 3,
    bonusThreshold2: 100000,
    bonusThreshold2Pct: 5,
    dailyVisitTarget: 8,
    monthlyOrderTarget: 200000,
    monthlyCollectionTarget: 150000,
    maxClientsPerSalesman: 100,
    overdueAlertDays: 7,
    gpsRequired: true,
    photoRequired: false,
    competitorTracking: false,
    offlineMode: true,
    autoCheckout: true,
    autoCheckoutHours: 8,
    visitPurposes: [
        { key: 'SALES', label: 'Sales', emoji: '🛒' },
        { key: 'COLLECTION', label: 'Collection', emoji: '💰' },
        { key: 'DEMO', label: 'Demo', emoji: '🎯' },
        { key: 'COMPLAINT', label: 'Complaint', emoji: '⚠️' },
        { key: 'FOLLOWUP', label: 'Follow-up', emoji: '🔄' },
        { key: 'OTHER', label: 'Other', emoji: '📝' },
    ],
};

function loadSalesCfg(): SalesConfig {
    try {
        const raw = localStorage.getItem(LS_SALES_CFG);
        if (raw) return { ...DEFAULT_SALES_CFG, ...JSON.parse(raw) };
    } catch { /* ignore */ }
    return DEFAULT_SALES_CFG;
}

const SalesmanConfigPanel = () => {
    const { settings, updateSetting } = useInternalSystemSettingStore();

    // Load from DB first (so all devices get same config), fall back to localStorage
    const [cfg, setCfg] = useState<SalesConfig>(() => {
        const dbCfg = settings.SALESMAN_CONFIG;
        if (dbCfg) return { ...DEFAULT_SALES_CFG, ...dbCfg };
        return loadSalesCfg();
    });
    const [saved, setSaved] = useState(false);
    const [newPurpose, setNewPurpose] = useState({ key: '', label: '', emoji: '📌' });

    // Sync from DB whenever settings load (handles page refresh / phone first load)
    useEffect(() => {
        if (settings.SALESMAN_CONFIG) {
            setCfg(prev => ({ ...DEFAULT_SALES_CFG, ...settings.SALESMAN_CONFIG, ...prev }));
            // Keep localStorage in sync too (for offline fallback)
            try { localStorage.setItem(LS_SALES_CFG, JSON.stringify({ ...DEFAULT_SALES_CFG, ...settings.SALESMAN_CONFIG })); } catch { }
        }
    }, [settings.SALESMAN_CONFIG]);

    const update = <K extends keyof SalesConfig>(key: K, val: SalesConfig[K]) =>
        setCfg(p => ({ ...p, [key]: val }));

    const save = async () => {
        // Save to DB (all devices) AND localStorage (offline fallback)
        await updateSetting('SALESMAN_CONFIG', cfg);
        try { localStorage.setItem(LS_SALES_CFG, JSON.stringify(cfg)); } catch { }
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
    };

    const addPurpose = () => {
        if (!newPurpose.key.trim() || !newPurpose.label.trim()) return;
        update('visitPurposes', [...cfg.visitPurposes, { key: newPurpose.key.toUpperCase().replace(/\s+/g, '_'), label: newPurpose.label, emoji: newPurpose.emoji }]);
        setNewPurpose({ key: '', label: '', emoji: '📌' });
    };

    const removePurpose = (key: string) =>
        update('visitPurposes', cfg.visitPurposes.filter(p => p.key !== key));

    const inp = 'w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:border-orange-500 outline-none';
    const Toggle = ({ on, onToggle }: { on: boolean; onToggle: () => void }) => (
        <button onClick={onToggle} className={`relative w-12 h-6 rounded-full transition-colors ${on ? 'bg-orange-500' : 'bg-slate-700'}`}>
            <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-6' : ''}`} />
        </button>
    );

    // InfoTip is now a shared global component from @/components/ui/InfoTip

    return (
        <div className="space-y-8 max-w-4xl">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">🛒 Salesman Configuration</h2>
                    <p className="text-sm text-slate-400 mt-1">Sales team ke liye rules, targets, aur features configure karo</p>
                </div>
                <button onClick={save} className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm transition-all shadow-lg ${saved ? 'bg-green-600 shadow-green-600/20 text-white' : 'bg-orange-500 hover:bg-orange-400 text-white shadow-orange-500/20'}`}>
                    <Save className="w-4 h-4" /> {saved ? '✅ Saved!' : 'Save Changes'}
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* Section 1: Visit Settings */}
                <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-6 space-y-4">
                    <h3 className="font-bold text-white flex items-center gap-2 text-sm">
                        <span className="w-7 h-7 rounded-lg bg-blue-500/20 flex items-center justify-center text-sm">📍</span>
                        Visit Settings
                    </h3>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="relative">
                            <InfoTip id="gpsRadiusMeters" label="GPS Radius (meters)" />
                            <input type="number" value={cfg.gpsRadiusMeters} onChange={e => update('gpsRadiusMeters', +e.target.value)} className={inp} min={50} max={5000} step={50} />
                            <p className="text-[10px] text-slate-500 mt-1">Client se itni door check-in allow hoga</p>
                        </div>
                        <div className="relative">
                            <InfoTip id="maxDailyVisits" label="Max Daily Visits" />
                            <input type="number" value={cfg.maxDailyVisits} onChange={e => update('maxDailyVisits', +e.target.value)} className={inp} min={1} max={100} />
                        </div>
                        <div className="relative">
                            <InfoTip id="minVisitDurationMins" label="Min Visit Duration (mins)" />
                            <input type="number" value={cfg.minVisitDurationMins} onChange={e => update('minVisitDurationMins', +e.target.value)} className={inp} min={1} max={60} />
                        </div>
                        <div className="relative">
                            <InfoTip id="maxVisitDurationMins" label="Max Visit Duration (mins)" />
                            <input type="number" value={cfg.maxVisitDurationMins} onChange={e => update('maxVisitDurationMins', +e.target.value)} className={inp} min={30} max={480} />
                        </div>
                        <div className="relative">
                            <InfoTip id="checkInTime" label="Check-In Start" />
                            <input type="time" value={cfg.checkInStartTime} onChange={e => update('checkInStartTime', e.target.value)} className={inp} />
                        </div>
                        <div className="relative">
                            <InfoTip id="checkInTime" label="Check-In End" />
                            <input type="time" value={cfg.checkInEndTime} onChange={e => update('checkInEndTime', e.target.value)} className={inp} />
                        </div>
                    </div>
                    <div className="flex items-center justify-between py-2 border-t border-slate-700/50">
                        <div>
                            <p className="text-sm text-white font-medium">Auto Checkout</p>
                            <p className="text-xs text-slate-500">Visit automatically close ho jaegi</p>
                        </div>
                        <Toggle on={cfg.autoCheckout} onToggle={() => update('autoCheckout', !cfg.autoCheckout)} />
                    </div>
                    {cfg.autoCheckout && (
                        <div className="relative">
                            <InfoTip id="autoCheckoutHours" label="Auto Checkout After (hours)" />
                            <input type="number" value={cfg.autoCheckoutHours} onChange={e => update('autoCheckoutHours', +e.target.value)} className={inp} min={1} max={24} />
                        </div>
                    )}
                </div>

                {/* Section 2: Commission & Targets */}
                <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-6 space-y-4">
                    <h3 className="font-bold text-white flex items-center gap-2 text-sm">
                        <span className="w-7 h-7 rounded-lg bg-green-500/20 flex items-center justify-center text-sm">💰</span>
                        Commission &amp; Targets
                    </h3>
                    <div className="relative">
                        <InfoTip id="baseCommissionPct" label="Base Commission (%)" />
                        <input type="number" value={cfg.baseCommissionPct} onChange={e => update('baseCommissionPct', +e.target.value)} className={inp} min={0} max={50} step={0.5} />
                    </div>
                    <div className="bg-green-500/5 border border-green-500/20 rounded-xl p-3 space-y-3">
                        <div className="flex items-center gap-2">
                            <p className="text-xs font-bold text-green-400 uppercase">Bonus Slabs</p>
                            <InfoTip id="bonusSlabs" label="" />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="text-[10px] text-slate-500 block mb-1">Slab 1 — Min Order (₹)</label>
                                <input type="number" value={cfg.bonusThreshold1} onChange={e => update('bonusThreshold1', +e.target.value)} className={inp} step={5000} />
                            </div>
                            <div>
                                <label className="text-[10px] text-slate-500 block mb-1">Slab 1 Commission %</label>
                                <input type="number" value={cfg.bonusThreshold1Pct} onChange={e => update('bonusThreshold1Pct', +e.target.value)} className={inp} min={0} max={50} step={0.5} />
                            </div>
                            <div>
                                <label className="text-[10px] text-slate-500 block mb-1">Slab 2 — Min Order (₹)</label>
                                <input type="number" value={cfg.bonusThreshold2} onChange={e => update('bonusThreshold2', +e.target.value)} className={inp} step={5000} />
                            </div>
                            <div>
                                <label className="text-[10px] text-slate-500 block mb-1">Slab 2 Commission %</label>
                                <input type="number" value={cfg.bonusThreshold2Pct} onChange={e => update('bonusThreshold2Pct', +e.target.value)} className={inp} min={0} max={50} step={0.5} />
                            </div>
                        </div>
                        <div className="space-y-3 border-t border-slate-700/50 pt-3">
                            <p className="text-xs font-bold text-orange-400 uppercase">Monthly Targets</p>
                            <div className="relative">
                                <InfoTip id="dailyVisitTarget" label="Daily Visit Target" />
                                <input type="number" value={cfg.dailyVisitTarget} onChange={e => update('dailyVisitTarget', +e.target.value)} className={inp} min={1} max={50} />
                            </div>
                            <div className="relative">
                                <InfoTip id="monthlyOrderTarget" label="Monthly Order Target (₹)" />
                                <input type="number" value={cfg.monthlyOrderTarget} onChange={e => update('monthlyOrderTarget', +e.target.value)} className={inp} step={10000} />
                            </div>
                            <div className="relative">
                                <InfoTip id="monthlyCollectionTarget" label="Monthly Collection Target (₹)" />
                                <input type="number" value={cfg.monthlyCollectionTarget} onChange={e => update('monthlyCollectionTarget', +e.target.value)} className={inp} step={10000} />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Section 3: Client Management */}
                <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-6 space-y-4">
                    <h3 className="font-bold text-white flex items-center gap-2 text-sm">
                        <span className="w-7 h-7 rounded-lg bg-purple-500/20 flex items-center justify-center text-sm">🏪</span>
                        Client Management
                    </h3>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="relative">
                            <InfoTip id="maxClientsPerSalesman" label="Max Clients / Salesman" />
                            <input type="number" value={cfg.maxClientsPerSalesman} onChange={e => update('maxClientsPerSalesman', +e.target.value)} className={inp} min={10} max={1000} />
                        </div>
                        <div className="relative">
                            <InfoTip id="overdueAlertDays" label="Overdue Alert (days)" />
                            <input type="number" value={cfg.overdueAlertDays} onChange={e => update('overdueAlertDays', +e.target.value)} className={inp} min={1} max={90} />
                            <p className="text-[10px] text-slate-500 mt-1">Itne din baad next visit nahi ki toh overdue</p>
                        </div>
                    </div>
                </div>

                {/* Section 4: Feature Toggles */}
                <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-6 space-y-1">
                    <h3 className="font-bold text-white flex items-center gap-2 text-sm mb-3">
                        <span className="w-7 h-7 rounded-lg bg-yellow-500/20 flex items-center justify-center text-sm">⚙️</span>
                        Feature Switches
                    </h3>
                    {[
                        { key: 'gpsRequired' as const, label: 'GPS Mandatory', desc: 'Check-in GPS ke bina band hai', icon: '📍', tipId: 'gpsRequired' },
                        { key: 'photoRequired' as const, label: 'Photo Required', desc: 'Check-in par client photo lena padega', icon: '📷', tipId: 'photoRequired' },
                        { key: 'competitorTracking' as const, label: 'Competitor Tracking', desc: 'Salesman competitor info note kar sake', icon: '🔍', tipId: 'competitorTracking' },
                        { key: 'offlineMode' as const, label: 'Offline Mode', desc: 'Internet nahi hone par bhi data save', icon: '📶', tipId: 'offlineMode' },
                    ].map(({ key, label, desc, icon, tipId }) => (
                        <div key={key} className="flex items-center justify-between py-3 border-b border-slate-700/30 last:border-0">
                            <div className="flex items-center gap-2">
                                <span className="text-base">{icon}</span>
                                <div>
                                    <InfoTip id={tipId} label={label} />
                                    <p className="text-[11px] text-slate-500">{desc}</p>
                                </div>
                            </div>
                            <Toggle on={cfg[key]} onToggle={() => update(key, !cfg[key])} />
                        </div>
                    ))}

                </div>

                {/* Section 5: Visit Purposes (Full width) */}
                <div className="bg-slate-800/40 border border-orange-500/20 rounded-2xl p-6 lg:col-span-2">
                    <h3 className="font-bold text-white flex items-center gap-2 text-sm mb-4">
                        <span className="w-7 h-7 rounded-lg bg-orange-500/20 flex items-center justify-center text-sm">🎯</span>
                        Visit Purposes
                        <span className="text-xs text-slate-500 font-normal ml-1">(Check-in ke waqt salesman jo purpose choose karta hai)</span>
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 mb-4">
                        {cfg.visitPurposes.map(p => (
                            <div key={p.key} className="group flex items-center gap-2 px-3 py-2.5 bg-slate-900/50 border border-slate-700 rounded-xl">
                                <span className="text-lg shrink-0">{p.emoji}</span>
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-semibold text-white truncate">{p.label}</p>
                                    <p className="text-[10px] text-slate-500 font-mono truncate">{p.key}</p>
                                </div>
                                <button
                                    onClick={() => removePurpose(p.key)}
                                    className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-400 text-slate-600 transition-all shrink-0"
                                    title="Remove"
                                >
                                    <Trash2 className="w-3 h-3" />
                                </button>
                            </div>
                        ))}
                    </div>
                    {/* Add New Purpose */}
                    <div className="flex gap-2 items-end">
                        <div className="w-14">
                            <label className="text-[10px] text-slate-500 uppercase block mb-1">Emoji</label>
                            <input value={newPurpose.emoji} onChange={e => setNewPurpose(p => ({ ...p, emoji: e.target.value }))} className={`${inp} text-center text-lg`} maxLength={2} />
                        </div>
                        <div className="flex-1">
                            <label className="text-[10px] text-slate-500 uppercase block mb-1">Label (Display Name)</label>
                            <input value={newPurpose.label} onChange={e => setNewPurpose(p => ({ ...p, label: e.target.value }))} placeholder="e.g. Training" className={inp} />
                        </div>
                        <div className="flex-1">
                            <label className="text-[10px] text-slate-500 uppercase block mb-1">Key (Internal)</label>
                            <input value={newPurpose.key} onChange={e => setNewPurpose(p => ({ ...p, key: e.target.value.toUpperCase().replace(/\s+/g, '_') }))} placeholder="e.g. TRAINING" className={`${inp} font-mono`} />
                        </div>
                        <button onClick={addPurpose} disabled={!newPurpose.key || !newPurpose.label} className="px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-400 disabled:opacity-40 text-white text-sm font-bold flex items-center gap-1 transition-all mb-0.5">
                            <Plus className="w-4 h-4" /> Add
                        </button>
                    </div>
                </div>

                {/* Info Box — DB backed */}
                <div className="bg-green-500/5 border border-green-500/20 rounded-xl px-5 py-4 flex gap-3 lg:col-span-2">
                    <span className="text-green-400 text-lg shrink-0">✅</span>
                    <p className="text-sm text-slate-400">
                        Yeh settings <strong className="text-white">database</strong> mein save hoti hain.
                        <span className="text-green-400 font-medium"> Save karne ke baad sabhi devices (phone, tablet) par automatically apply hongi.</span>
                    </p>
                </div>
            </div>
        </div>
    );
};

export const ConfigurationPage = () => {

    const [activeTab, setActiveTab] = useState<'departments' | 'workAllocation' | 'shifts' | 'rules' | 'salaryTypes' | 'attendance' | 'keys' | 'holidays' | 'punch' | 'salesman' | 'statutory' | 'roles' | 'customFields' | 'workflows'>('departments');
    const { departments, addDepartment, updateDepartment, deleteDepartment } = useDepartmentStore();
    const { shifts, addShift, updateShift, removeShift } = useShiftStore();
    const { groups: workGroups, assignments, addGroup, removeGroup, getGroupEmployees } = useWorkGroupStore();
    const config = useSystemConfigStore();
    const { user, hasPermission } = useAuthStore();
    const { holidays, addHoliday, removeHoliday, fetchHolidays } = useHolidayStore();
    const isSuperAdmin = user?.role === Roles.SUPER_ADMIN;
    const isAdmin = user?.role === Roles.ADMIN || user?.role === Roles.SUPER_ADMIN;

    const currentCompanyId = useMultiCompanyStore(s => s.currentCompanyId);
    const fetchDepartments = useInternalDepartmentStore(s => s.fetchDepartments);
    const fetchShifts = useInternalShiftStore(s => s.fetchShifts);
    const fetchGroups = useInternalWorkGroupStore(s => s.fetchGroups);
    const fetchSalaryTypes = useInternalSalaryTypeStore(s => s.fetchSalaryTypes);
    const fetchAttendanceActions = useInternalAttendanceActionStore(s => s.fetchAttendanceActions);
    const fetchPunchLocations = useInternalPunchLocationStore(s => s.fetchPunchLocations);
    const fetchSystemSettings = useInternalSystemSettingStore(s => s.fetchSettings);
    const fetchSystemKeys = useInternalSystemKeyStore(s => s.fetchKeys);

    const { salaryTypes, addSalaryType, updateSalaryType, deleteSalaryType } = useSalaryTypeStore();
    const { attendanceActions, addAttendanceAction, deleteAttendanceAction, toggleAttendanceAction } = useAttendanceActionStore();
    const { punchLocations, addPunchLocation, updatePunchLocation, deletePunchLocation, togglePunchLocationZone } = usePunchLocationStore();
    const { settings, updateSetting } = useSystemSettingStore();
    const { keys: systemKeys, addKey: addSystemKey, updateKey: updateSystemKey, deleteKey: deleteSystemKey } = useSystemKeyStore();

    useEffect(() => {
        if (!currentCompanyId) return;
        if (activeTab === 'departments') fetchDepartments(currentCompanyId);
        if (activeTab === 'shifts' && fetchShifts) fetchShifts(currentCompanyId);
        if (activeTab === 'workAllocation' && fetchGroups) fetchGroups(currentCompanyId);
        if (activeTab === 'salaryTypes' && fetchSalaryTypes) fetchSalaryTypes(currentCompanyId);
        if (activeTab === 'attendance' && fetchAttendanceActions) fetchAttendanceActions(currentCompanyId);
        if (activeTab === 'holidays') fetchHolidays(currentCompanyId ? parseInt(currentCompanyId, 10) : undefined);
        if (activeTab === 'keys') fetchSystemKeys(currentCompanyId);
        if (activeTab === 'punch') {
            fetchSystemSettings?.(currentCompanyId);
            fetchPunchLocations?.(currentCompanyId);
        }
    }, [activeTab, currentCompanyId, fetchDepartments, fetchShifts, fetchGroups, fetchSalaryTypes, fetchAttendanceActions, fetchSystemKeys, fetchSystemSettings, fetchPunchLocations, fetchHolidays]);

    // Punch System tab state
    const [detectingGps, setDetectingGps] = useState(false);

    // DB defaults
    const punchLocationMaster = settings.PUNCH_LOCATION_MASTER || { enabled: false, name: 'Office', lat: 0, lng: 0, radiusMeters: 100 };
    const punchMethods = settings.PUNCH_METHODS || {
        face: { enabled: true, label: 'Face Scan' },
        fingerprint: { enabled: true, label: 'Thumb Print' },
        photoUpload: { enabled: true, label: 'Live Selfie' }
    };
    const shiftPunchWindows = settings.SHIFT_PUNCH_WINDOWS || [];

    const _updatePunchMethod = (method: string, updates: any) => {
        updateSetting('PUNCH_METHODS', { ...punchMethods, [method]: { ...punchMethods[method], ...updates } });
    };

    const _updatePunchLocationMaster = (updates: any) => {
        updateSetting('PUNCH_LOCATION_MASTER', { ...punchLocationMaster, ...updates });
    };

    const _updateShiftPunchWindow = (id: string, updates: any) => {
        const updated = shiftPunchWindows.map((w: any) => w.id === id ? { ...w, ...updates } : w);
        updateSetting('SHIFT_PUNCH_WINDOWS', updated);
    };

    const _addShiftPunchWindow = (win: any) => {
        const newWin = { ...win, id: Math.random().toString(36).substr(2, 9) };
        updateSetting('SHIFT_PUNCH_WINDOWS', [...shiftPunchWindows, newWin]);
    };

    const _removeShiftPunchWindow = (id: string) => {
        updateSetting('SHIFT_PUNCH_WINDOWS', shiftPunchWindows.filter((w: any) => w.id !== id));
    };

    const [locDraft, setLocDraft] = useState<{
        enabled: boolean;
        name: string;
        lat: number;
        lng: number;
        radiusMeters: number;
    }>(punchLocationMaster);
    useEffect(() => { setLocDraft(punchLocationMaster); }, [settings.PUNCH_LOCATION_MASTER]);

    // Warning Modal State
    const [warning, setWarning] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        onConfirm: () => void;
        severity?: 'warning' | 'danger';
        confirmText?: string;
    }>({
        isOpen: false,
        title: '',
        message: '',
        onConfirm: () => { },
        severity: 'warning'
    });

    // Department Form State
    const [deptForm, setDeptForm] = useState<{
        name: string;
        description: string;
        salaryBasis: DeptSalaryBasis;
        defaultSalaryType: 'MONTHLY' | 'DAILY' | 'PER_UNIT';
        costCenter: string;
        headCount: string;
    }>({ name: '', description: '', salaryBasis: 'FIXED', defaultSalaryType: 'MONTHLY', costCenter: '', headCount: '' });
    const [editingDeptId, setEditingDeptId] = useState<string | null>(null);

    // Shift Form State
    const [shiftForm, setShiftForm] = useState({ name: '', startTime: '09:00', endTime: '18:00', graceTimeMinutes: 15 });
    const [editingShiftId, setEditingShiftId] = useState<string | null>(null);

    // Loan Type Form State

    // Holiday Form State (must be at top level — Rules of Hooks)
    const [hForm, setHForm] = useState({ name: '', date: '', type: 'FESTIVAL' as 'FESTIVAL' | 'NATIONAL' | 'OPTIONAL' });
    const canManageHolidays = hasPermission(PERMISSIONS.MANAGE_HOLIDAYS);

    const handleHSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!hForm.name || !hForm.date) return;
        addHoliday(hForm);
        setHForm({ name: '', date: '', type: 'FESTIVAL' });
    };

    const handleDeptSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const payload = {
            name: deptForm.name,
            description: deptForm.description,
            salaryBasis: deptForm.salaryBasis,
            defaultSalaryType: deptForm.defaultSalaryType,
            costCenter: deptForm.costCenter || undefined,
            headCount: deptForm.headCount ? Number(deptForm.headCount) : undefined,
        };
        if (editingDeptId) {
            updateDepartment(editingDeptId, payload);
            setEditingDeptId(null);
        } else {
            addDepartment(payload);
        }
        setDeptForm({ name: '', description: '', salaryBasis: 'FIXED', defaultSalaryType: 'MONTHLY', costCenter: '', headCount: '' });
    };

    const handleShiftSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (editingShiftId) {
            updateShift(editingShiftId, shiftForm);
            setEditingShiftId(null);
        } else {
            addShift(shiftForm);
        }
        setShiftForm({ name: '', startTime: '09:00', endTime: '18:00', graceTimeMinutes: 15 });
    };

    // Salary Type Form
    const BASIS_OPTIONS = [
        { value: 'MONTHLY' as const, label: '📅 Monthly', color: 'blue' },
        { value: 'DAILY' as const, label: '🗓️ Daily', color: 'yellow' },
        { value: 'PER_UNIT' as const, label: '🏭 Per Unit', color: 'orange' },
        { value: 'WEEKLY' as const, label: '📆 Weekly', color: 'purple' },
        { value: 'OTHER' as const, label: '📝 Other', color: 'slate' },
    ] as const;
    type Basis = 'MONTHLY' | 'DAILY' | 'PER_UNIT' | 'WEEKLY' | 'OTHER';
    const [stForm, setStForm] = useState<{ key: string; label: string; description: string; basis: Basis }>({ key: '', label: '', description: '', basis: 'MONTHLY' });
    const [editingStId, setEditingStId] = useState<string | null>(null);
    const handleStSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const data = { ...stForm, key: stForm.key || stForm.label };
        if (editingStId) {
            updateSalaryType(editingStId, data);
            setEditingStId(null);
        } else {
            addSalaryType(data);
        }
        setStForm({ key: '', label: '', description: '', basis: 'MONTHLY' });
    };

    return (
        <div className="max-w-6xl mx-auto space-y-6 pb-20">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white tracking-tight">System Configuration</h1>
                    <p className="text-slate-400">Manage your organization's core settings</p>
                </div>
            </div>

            {/* ── Tab Bar — Clean Grouped Design ──────────────────────────────── */}
            <div className="space-y-2">
                {/* Row 1: Core Settings */}
                <div className="flex flex-wrap gap-1.5">
                    {[
                        { id: 'departments', label: 'Departments', icon: <Building2 className="w-3.5 h-3.5" />, color: 'primary' },
                        { id: 'workAllocation', label: 'Work Allocation', icon: <span className="text-xs">🏭</span>, color: 'violet' },
                        { id: 'shifts', label: 'Shifts', icon: <Clock className="w-3.5 h-3.5" />, color: 'primary' },
                        { id: 'rules', label: 'Payroll Rules', icon: <Gavel className="w-3.5 h-3.5" />, color: 'primary' },
                        { id: 'salaryTypes', label: 'Salary Types', icon: <IndianRupee className="w-3.5 h-3.5" />, color: 'primary' },
                        { id: 'attendance', label: 'Attendance', icon: <CalendarCheck className="w-3.5 h-3.5" />, color: 'primary' },
                        { id: 'holidays', label: 'Holidays', icon: <Calendar className="w-3.5 h-3.5" />, color: 'primary' },
                        { id: 'salesman', label: 'Salesman', icon: <span className="text-xs">🛒</span>, color: 'orange' },
                        { id: 'punch', label: 'Punch System', icon: <Camera className="w-3.5 h-3.5" />, color: 'emerald' },
                        { id: 'statutory', label: 'Statutory', icon: <Shield className="w-3.5 h-3.5" />, color: 'primary' },
                    ].map(tab => {
                        const isActive = activeTab === tab.id;
                        const colorMap: Record<string, string> = {
                            primary: 'bg-primary-600 text-white shadow-primary-600/30',
                            violet: 'bg-violet-600 text-white shadow-violet-600/30',
                            orange: 'bg-orange-600 text-white shadow-orange-600/30',
                            emerald: 'bg-emerald-600 text-white shadow-emerald-600/30',
                        };
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${isActive
                                    ? `${colorMap[tab.color]} shadow-md`
                                    : 'bg-slate-800 text-slate-400 border border-slate-700 hover:text-white hover:border-slate-500'
                                    }`}
                            >
                                {tab.icon}
                                {tab.label}
                            </button>
                        );
                    })}
                </div>

                {/* Row 2: System / Admin tabs */}
                <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[10px] text-slate-600 font-bold uppercase tracking-wider mr-1">Admin:</span>

                    {/* System Keys */}
                    <button
                        onClick={() => isSuperAdmin && setActiveTab('keys')}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${activeTab === 'keys'
                            ? 'bg-amber-600 text-white shadow-md shadow-amber-600/30'
                            : isSuperAdmin
                                ? 'bg-slate-800 text-amber-400 border border-amber-500/30 hover:bg-amber-500/10'
                                : 'bg-slate-800/40 text-slate-600 border border-slate-800 cursor-not-allowed'
                            }`}
                        title={!isSuperAdmin ? 'Super Admin only' : 'System Keys'}
                    >
                        <Key className="w-3.5 h-3.5" />
                        System Keys
                        {!isSuperAdmin && <Lock className="w-3 h-3 ml-0.5 opacity-60" />}
                    </button>

                    {/* Audit Logs */}
                    <button
                        onClick={() => window.location.href = '/admin/audit-logs'}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap bg-slate-800 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/10"
                        title="View System Audit Trail"
                    >
                        <FileCheck className="w-3.5 h-3.5" />
                        Audit Logs
                    </button>

                    {/* Role Access — Super Admin only */}
                    {isSuperAdmin && (
                        <button
                            onClick={() => setActiveTab('roles')}
                            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${activeTab === 'roles'
                                ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30'
                                : 'bg-rose-500/10 text-rose-400 border border-rose-500/30 hover:bg-rose-500/20'
                                }`}
                            title="Role Access Control — Super Admin Only"
                        >
                            <Shield className="w-3.5 h-3.5" />
                            Role Access
                            <span className="ml-0.5 text-[9px] bg-rose-500/30 text-rose-300 px-1 py-0.5 rounded font-bold">SA</span>
                        </button>
                    )}

                    {/* Custom Fields — Super Admin only */}
                    {isSuperAdmin && (
                        <button
                            onClick={() => setActiveTab('customFields')}
                            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${activeTab === 'customFields'
                                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                                : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 hover:bg-indigo-500/20'
                                }`}
                            title="Custom Fields Config — Super Admin Only"
                        >
                            <Settings2 className="w-3.5 h-3.5" />
                            Custom Fields
                            <span className="ml-0.5 text-[9px] bg-indigo-500/30 text-indigo-300 px-1 py-0.5 rounded font-bold">SA</span>
                        </button>
                    )}

                    {/* Workflows — Super Admin only */}
                    {isSuperAdmin && (
                        <button
                            onClick={() => setActiveTab('workflows')}
                            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${activeTab === 'workflows'
                                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                                : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 hover:bg-indigo-500/20'
                                }`}
                            title="Approval Workflows — Super Admin Only"
                        >
                            <Network className="w-3.5 h-3.5" />
                            Workflows
                            <span className="ml-0.5 text-[9px] bg-indigo-500/30 text-indigo-300 px-1 py-0.5 rounded font-bold">SA</span>
                        </button>
                    )}
                </div>
            </div>

            {activeTab === 'departments' && (
                <WorkAllocationPanel
                    workGroups={workGroups}
                    assignments={assignments}
                    addGroup={addGroup}
                    removeGroup={removeGroup}
                    getGroupEmployees={getGroupEmployees}
                    departments={departments.map(d => d.name)}
                    mainDepartments={departments.map(d => ({ id: d.id, name: d.name }))}
                    productionGridDepts={config.productionGridDepts}
                    setProductionGridDepts={config.setProductionGridDepts}
                />
            )}

            {activeTab !== 'salaryTypes' && activeTab !== 'attendance' && activeTab !== 'keys' && activeTab !== 'holidays' && activeTab !== 'punch' && activeTab !== 'departments' && activeTab !== 'salesman' && activeTab !== 'statutory' && activeTab !== 'roles' && activeTab !== 'customFields' && activeTab !== 'workflows' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Content Switching */}
                    {activeTab === 'rules' ? (
                        <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Zero Presence Rule */}
                            <div className="bg-slate-800/30 border border-slate-700/50 rounded-2xl p-6 hover:border-primary-500/50 transition-all">
                                <div className="flex items-start justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center">
                                            <AlertOctagon className="w-6 h-6 text-red-400" />
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-bold text-white">Zero-Presence Rule</h3>
                                            <div className="flex items-center gap-2 mt-1">
                                                <div className={`w-2 h-2 rounded-full ${config.enableZeroPresenceRule ? 'bg-green-500' : 'bg-slate-600'}`} />
                                                <span className="text-sm text-slate-400">{config.enableZeroPresenceRule ? 'Enabled' : 'Disabled'}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input type="checkbox" className="sr-only peer" checked={config.enableZeroPresenceRule} onChange={config.toggleZeroPresenceRule} />
                                        <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                                    </label>
                                </div>
                                <p className="mt-4 text-sm text-slate-400 leading-relaxed border-t border-slate-700/50 pt-4">
                                    If an employee is marked <b>PRESENT for 0 days</b> in a month, they will receive <b>NO PAY</b> (0 Days Salary).
                                    <br />
                                    Includes forfeiting all Week-Offs, Holidays, and Allowances.
                                </p>
                            </div>

                            {/* Sandwich Rule */}
                            <div className="bg-slate-800/30 border border-slate-700/50 rounded-2xl p-6 hover:border-primary-500/50 transition-all">
                                <div className="flex items-start justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 rounded-xl bg-orange-500/10 flex items-center justify-center">
                                            <FileCheck className="w-6 h-6 text-orange-400" />
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-bold text-white">Sandwich Rule (Adjacency)</h3>
                                            <div className="flex items-center gap-2 mt-1">
                                                <div className={`w-2 h-2 rounded-full ${config.enableSandwichRule ? 'bg-green-500' : 'bg-slate-600'}`} />
                                                <span className="text-sm text-slate-400">{config.enableSandwichRule ? 'Enabled' : 'Disabled'}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input type="checkbox" className="sr-only peer" checked={config.enableSandwichRule} onChange={config.toggleSandwichRule} />
                                        <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                                    </label>
                                </div>
                                <p className="mt-4 text-sm text-slate-400 leading-relaxed border-t border-slate-700/50 pt-4">
                                    Determines if Holidays/Week-Offs are paid.
                                    <br />
                                    <span className="text-orange-400 font-medium">Condition:</span> Must be <b>PRESENT</b> on both the <i>Immediate Previous</i> and <i>Immediate Next</i> working days.
                                    <br />
                                    Otherwise, the Off-Day is treated as <b>Absent/Unpaid</b>.
                                </p>
                            </div>
                        </div>
                    ) : (
                        <>
                            <div className="lg:col-span-1">
                                {/* Form Section */}
                                <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700 rounded-2xl p-6 sticky top-24">
                                    <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                                        {activeTab === 'workAllocation' ? (
                                            editingDeptId ? <Edit2 className="w-5 h-5 text-warning" /> : <Plus className="w-5 h-5 text-primary-400" />
                                        ) : (
                                            editingShiftId ? <Edit2 className="w-5 h-5 text-warning" /> : <Plus className="w-5 h-5 text-primary-400" />
                                        )}
                                        {activeTab === 'workAllocation'
                                            ? (editingDeptId ? 'Edit Work Allocation' : 'Add Work Allocation')
                                            : (editingShiftId ? 'Edit Shift' : 'Add Shift')
                                        }
                                    </h2>

                                    {activeTab === 'workAllocation' ? (
                                        <form onSubmit={handleDeptSubmit} className="space-y-4">
                                            <div className="space-y-1">
                                                <label className="text-xs font-medium text-slate-400 uppercase">Department Name</label>
                                                <input
                                                    required
                                                    type="text"
                                                    value={deptForm.name}
                                                    onChange={e => setDeptForm({ ...deptForm, name: e.target.value })}
                                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:border-primary-500 outline-none"
                                                    placeholder="e.g. Production"
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-xs font-medium text-slate-400 uppercase">Description</label>
                                                <textarea
                                                    value={deptForm.description}
                                                    onChange={e => setDeptForm({ ...deptForm, description: e.target.value })}
                                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:border-primary-500 outline-none min-h-[80px]"
                                                    placeholder="Short description..."
                                                />
                                            </div>

                                            {/* Salary Basis */}
                                            <div className="space-y-1">
                                                <label className="text-xs font-medium text-slate-400 uppercase">💰 Salary Basis</label>
                                                <p className="text-xs text-slate-500 mb-2">How is salary calculated for employees in this department?</p>
                                                <div className="space-y-2">
                                                    {SALARY_BASIS_OPTIONS.map(opt => (
                                                        <label key={opt.value} className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${deptForm.salaryBasis === opt.value
                                                            ? `border-${opt.color}-500/60 bg-${opt.color}-500/10`
                                                            : 'border-slate-700 hover:border-slate-600'
                                                            }`}>
                                                            <input
                                                                type="radio"
                                                                name="salaryBasis"
                                                                value={opt.value}
                                                                checked={deptForm.salaryBasis === opt.value}
                                                                onChange={() => setDeptForm({ ...deptForm, salaryBasis: opt.value })}
                                                                className="mt-1 accent-primary-500"
                                                            />
                                                            <div>
                                                                <p className="text-sm font-semibold text-white">{opt.label}</p>
                                                                <p className="text-xs text-slate-400">{opt.desc}</p>
                                                            </div>
                                                        </label>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Default Salary Type */}
                                            <div className="space-y-1">
                                                <label className="text-xs font-medium text-slate-400 uppercase">📋 Default Salary Type (for new employees)</label>
                                                <select
                                                    value={deptForm.defaultSalaryType}
                                                    onChange={e => setDeptForm({ ...deptForm, defaultSalaryType: e.target.value as 'MONTHLY' | 'DAILY' | 'PER_UNIT' })}
                                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:border-primary-500 outline-none"
                                                >
                                                    <option value="MONTHLY">Monthly Fixed</option>
                                                    <option value="DAILY">Daily Rate</option>
                                                    <option value="PER_UNIT">Per Unit / Production</option>
                                                </select>
                                            </div>

                                            {/* Cost Center & Head Count */}
                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="space-y-1">
                                                    <label className="text-xs font-medium text-slate-400 uppercase">Cost Center Code</label>
                                                    <input
                                                        type="text"
                                                        value={deptForm.costCenter}
                                                        onChange={e => setDeptForm({ ...deptForm, costCenter: e.target.value })}
                                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:border-primary-500 outline-none"
                                                        placeholder="e.g. CC-001"
                                                    />
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="text-xs font-medium text-slate-400 uppercase">Target Headcount</label>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        value={deptForm.headCount}
                                                        onChange={e => setDeptForm({ ...deptForm, headCount: e.target.value })}
                                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:border-primary-500 outline-none"
                                                        placeholder="e.g. 20"
                                                    />
                                                </div>
                                            </div>

                                            <div className="flex gap-3 pt-2">
                                                <button
                                                    type="submit"
                                                    className="flex-1 bg-primary-600 hover:bg-primary-500 text-white font-bold py-2.5 rounded-xl transition-all flex items-center justify-center gap-2"
                                                >
                                                    <Save className="w-4 h-4" /> {editingDeptId ? 'Update' : 'Save'}
                                                </button>
                                                {editingDeptId && (
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setEditingDeptId(null);
                                                            setDeptForm({ name: '', description: '', salaryBasis: 'FIXED', defaultSalaryType: 'MONTHLY', costCenter: '', headCount: '' });
                                                        }}
                                                        className="px-4 bg-slate-700 hover:bg-slate-600 text-white rounded-xl transition-all"
                                                    >
                                                        <X className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>
                                        </form>
                                    ) : activeTab === 'shifts' ? (
                                        <form onSubmit={handleShiftSubmit} className="space-y-4">
                                            <div className="space-y-1">
                                                <label className="text-xs font-medium text-slate-400 uppercase">Shift Name</label>
                                                <input
                                                    required
                                                    type="text"
                                                    value={shiftForm.name}
                                                    onChange={e => setShiftForm({ ...shiftForm, name: e.target.value })}
                                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:border-primary-500 outline-none"
                                                    placeholder="e.g. Morning Shift"
                                                />
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-1">
                                                    <label className="text-xs font-medium text-slate-400 uppercase">Start Time</label>
                                                    <input
                                                        required
                                                        type="time"
                                                        value={shiftForm.startTime}
                                                        onChange={e => setShiftForm({ ...shiftForm, startTime: e.target.value })}
                                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:border-primary-500 outline-none"
                                                    />
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="text-xs font-medium text-slate-400 uppercase">End Time</label>
                                                    <input
                                                        required
                                                        type="time"
                                                        value={shiftForm.endTime}
                                                        onChange={e => setShiftForm({ ...shiftForm, endTime: e.target.value })}
                                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:border-primary-500 outline-none"
                                                    />
                                                </div>
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-xs font-medium text-slate-400 uppercase">Grace Time (Minutes)</label>
                                                <input
                                                    type="number"
                                                    value={shiftForm.graceTimeMinutes}
                                                    onChange={e => setShiftForm({ ...shiftForm, graceTimeMinutes: Number(e.target.value) })}
                                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:border-primary-500 outline-none"
                                                />
                                            </div>
                                            <div className="flex gap-3 pt-2">
                                                <button
                                                    type="submit"
                                                    className="flex-1 bg-primary-600 hover:bg-primary-500 text-white font-bold py-2.5 rounded-xl transition-all flex items-center justify-center gap-2"
                                                >
                                                    <Save className="w-4 h-4" /> {editingShiftId ? 'Update' : 'Save'}
                                                </button>
                                                {editingShiftId && (
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setEditingShiftId(null);
                                                            setShiftForm({ name: '', startTime: '09:00', endTime: '18:00', graceTimeMinutes: 15 });
                                                        }}
                                                        className="px-4 bg-slate-700 hover:bg-slate-600 text-white rounded-xl transition-all"
                                                    >
                                                        <X className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>
                                        </form>
                                    ) : null}
                                </div>
                            </div>

                            {/* List Section */}
                            <div className="lg:col-span-2">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {activeTab === 'workAllocation' ? (
                                        departments.map(dept => (
                                            <div key={dept.id} className="bg-slate-800/30 border border-slate-700/50 rounded-2xl p-5 hover:border-primary-500/50 transition-all group lg:min-h-[160px] flex flex-col justify-between">
                                                <div>
                                                    <div className="flex items-center justify-between mb-2">
                                                        <div className="w-10 h-10 rounded-xl bg-primary-500/10 flex items-center justify-center">
                                                            <Briefcase className="w-5 h-5 text-primary-400" />
                                                        </div>
                                                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <button
                                                                onClick={() => {
                                                                    setEditingDeptId(dept.id);
                                                                    setDeptForm({
                                                                        name: dept.name,
                                                                        description: dept.description,
                                                                        salaryBasis: dept.salaryBasis || 'FIXED',
                                                                        defaultSalaryType: dept.defaultSalaryType || 'MONTHLY',
                                                                        costCenter: dept.costCenter || '',
                                                                        headCount: dept.headCount?.toString() || ''
                                                                    });
                                                                }}
                                                                className="p-2 bg-slate-800 hover:bg-warning/20 hover:text-warning rounded-lg transition-all"
                                                            >
                                                                <Edit2 className="w-4 h-4" />
                                                            </button>
                                                            <button
                                                                onClick={() => deleteDepartment(dept.id)}
                                                                className="p-2 bg-slate-800 hover:bg-red-500/20 hover:text-red-500 rounded-lg transition-all"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                    <h3 className="text-lg font-bold text-white">{dept.name}</h3>
                                                    <p className="text-sm text-slate-400 line-clamp-1">{dept.description}</p>
                                                    {/* Salary Basis Badge */}
                                                    {dept.salaryBasis && (() => {
                                                        const badge = SALARY_BASIS_BADGE[dept.salaryBasis];
                                                        return (
                                                            <span className={`inline-flex items-center mt-2 text-xs px-2 py-0.5 rounded-full border font-medium ${badge.cls}`}>
                                                                {badge.label}
                                                            </span>
                                                        );
                                                    })()}
                                                    {dept.headCount && (
                                                        <p className="text-xs text-slate-500 mt-1">👥 Target: {dept.headCount} people</p>
                                                    )}
                                                    {dept.costCenter && (
                                                        <p className="text-xs text-slate-500">💼 {dept.costCenter}</p>
                                                    )}
                                                </div>
                                            </div>
                                        ))
                                    ) : activeTab === 'shifts' ? (
                                        shifts.map(shift => (
                                            <div key={shift.id} className="bg-slate-800/30 border border-slate-700/50 rounded-2xl p-5 hover:border-primary-500/50 transition-all group flex flex-col justify-between">
                                                <div>
                                                    <div className="flex items-center justify-between mb-2">
                                                        <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center">
                                                            <Clock className="w-5 h-5 text-orange-400" />
                                                        </div>
                                                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <button
                                                                onClick={() => {
                                                                    setEditingShiftId(shift.id);
                                                                    setShiftForm({
                                                                        name: shift.name,
                                                                        startTime: shift.startTime,
                                                                        endTime: shift.endTime,
                                                                        graceTimeMinutes: shift.graceTimeMinutes
                                                                    });
                                                                }}
                                                                className="p-2 bg-slate-800 hover:bg-warning/20 hover:text-warning rounded-lg transition-all"
                                                            >
                                                                <Edit2 className="w-4 h-4" />
                                                            </button>
                                                            <button
                                                                onClick={() => removeShift(shift.id)}
                                                                className="p-2 bg-slate-800 hover:bg-red-500/20 hover:text-red-500 rounded-lg transition-all"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                    <h3 className="text-lg font-bold text-white">{shift.name}</h3>
                                                    <div className="flex items-center gap-4 mt-2">
                                                        <div className="text-xs bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-400">
                                                            {shift.startTime} - {shift.endTime}
                                                        </div>
                                                        <div className="text-[10px] text-slate-500">
                                                            Grace: {shift.graceTimeMinutes}m
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    ) : null}
                                </div>
                            </div>
                        </>
                    )}
                </div>
            )
            }

            {/* ─── Salary Types ─── */}
            {
                activeTab === 'salaryTypes' && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Form */}
                        <div className="lg:col-span-1">
                            <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700 rounded-2xl p-6 sticky top-24">
                                <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                                    {editingStId ? <Edit2 className="w-5 h-5 text-warning" /> : <Plus className="w-5 h-5 text-primary-400" />}
                                    {editingStId ? 'Edit Salary Type' : 'Add Salary Type'}
                                </h2>
                                <form onSubmit={handleStSubmit} className="space-y-4">
                                    <div className="space-y-1">
                                        <label className="text-xs font-medium text-slate-400 uppercase">Display Label *</label>
                                        <input
                                            required
                                            type="text"
                                            value={stForm.label}
                                            onChange={e => setStForm({ ...stForm, label: e.target.value })}
                                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:border-primary-500 outline-none"
                                            placeholder="e.g. Monthly Fixed"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-medium text-slate-400 uppercase">Key / Code (auto)</label>
                                        <input
                                            type="text"
                                            value={stForm.key}
                                            onChange={e => setStForm({ ...stForm, key: e.target.value })}
                                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:border-primary-500 outline-none font-mono text-sm"
                                            placeholder="e.g. MONTHLY_FIXED (auto-filled)"
                                        />
                                        <p className="text-xs text-slate-500">Leave blank to auto-generate from label</p>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-medium text-slate-400 uppercase">Description</label>
                                        <textarea
                                            value={stForm.description}
                                            onChange={e => setStForm({ ...stForm, description: e.target.value })}
                                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:border-primary-500 outline-none min-h-[70px]"
                                            placeholder="How is this salary type calculated?"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-medium text-slate-400 uppercase">Basis / Cycle</label>
                                        <div className="grid grid-cols-1 gap-2">
                                            {BASIS_OPTIONS.map(opt => (
                                                <label key={opt.value} className={`flex items-center gap-3 p-2.5 rounded-xl border cursor-pointer transition-all ${stForm.basis === opt.value
                                                    ? 'border-primary-500/60 bg-primary-500/10'
                                                    : 'border-slate-700 hover:border-slate-600'
                                                    }`}>
                                                    <input
                                                        type="radio"
                                                        name="stBasis"
                                                        value={opt.value}
                                                        checked={stForm.basis === opt.value}
                                                        onChange={() => setStForm({ ...stForm, basis: opt.value })}
                                                        className="accent-primary-500"
                                                    />
                                                    <span className="text-sm font-medium text-white">{opt.label}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="flex gap-3 pt-2">
                                        <button type="submit" className="flex-1 bg-primary-600 hover:bg-primary-500 text-white font-bold py-2.5 rounded-xl transition-all flex items-center justify-center gap-2">
                                            <Save className="w-4 h-4" /> {editingStId ? 'Update' : 'Save'}
                                        </button>
                                        {editingStId && (
                                            <button type="button" onClick={() => { setEditingStId(null); setStForm({ key: '', label: '', description: '', basis: 'MONTHLY' }); }}
                                                className="px-4 bg-slate-700 hover:bg-slate-600 text-white rounded-xl transition-all">
                                                <X className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>
                                </form>
                            </div>
                        </div>

                        {/* Cards */}
                        <div className="lg:col-span-2">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {salaryTypes.map(st => (
                                    <div key={st.id} className="bg-slate-800/30 border border-slate-700/50 rounded-2xl p-5 hover:border-primary-500/50 transition-all group flex flex-col justify-between">
                                        <div>
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="w-10 h-10 rounded-xl bg-primary-500/10 flex items-center justify-center">
                                                    <IndianRupee className="w-5 h-5 text-primary-400" />
                                                </div>
                                                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button
                                                        onClick={() => { setEditingStId(st.id); setStForm({ key: st.key, label: st.label, description: st.description, basis: st.basis as 'MONTHLY' | 'DAILY' | 'PER_UNIT' | 'WEEKLY' | 'OTHER' }); }}
                                                        className="p-2 bg-slate-800 hover:bg-warning/20 hover:text-warning rounded-lg transition-all"
                                                    >
                                                        <Edit2 className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => setWarning({ isOpen: true, title: 'Delete Salary Type?', message: `\"${st.label}\" salary type delete ho jayega. Existing employees pe assigned data affect ho sakta hai.`, severity: 'danger', confirmText: 'Yes, Delete', onConfirm: () => deleteSalaryType(st.id) })}
                                                        className="p-2 bg-slate-800 hover:bg-red-500/20 hover:text-red-500 rounded-lg transition-all"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>
                                            <h3 className="text-lg font-bold text-white">{st.label}</h3>
                                            <p className="text-sm text-slate-400 line-clamp-2 mt-1">{st.description}</p>
                                            <div className="flex items-center gap-2 mt-2">
                                                <span className="text-xs bg-slate-900 border border-slate-700 rounded px-2 py-0.5 text-slate-400 font-mono">KEY: {st.key}</span>
                                                <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${st.basis === 'MONTHLY' ? 'bg-blue-500/20 text-blue-300 border-blue-500/30' :
                                                    st.basis === 'DAILY' ? 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30' :
                                                        st.basis === 'PER_UNIT' ? 'bg-orange-500/20 text-orange-300 border-orange-500/30' :
                                                            st.basis === 'WEEKLY' ? 'bg-purple-500/20 text-purple-300 border-purple-500/30' :
                                                                'bg-slate-500/20 text-slate-300 border-slate-500/30'
                                                    }`}>{BASIS_OPTIONS.find(b => b.value === st.basis)?.label ?? st.basis}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )
            }


            {/* ─── Attendance Actions ─── */}
            {
                activeTab === 'attendance' && (() => {
                    const COLOR_OPTIONS = [
                        { value: 'green', label: 'Green', cls: 'bg-green-500' },
                        { value: 'red', label: 'Red', cls: 'bg-red-500' },
                        { value: 'yellow', label: 'Yellow', cls: 'bg-yellow-500' },
                        { value: 'orange', label: 'Orange', cls: 'bg-orange-500' },
                        { value: 'blue', label: 'Blue', cls: 'bg-blue-500' },
                        { value: 'purple', label: 'Purple', cls: 'bg-purple-500' },
                        { value: 'slate', label: 'Grey', cls: 'bg-slate-500' },
                    ];
                    const colorBadge = (color: string) => ({
                        green: 'bg-green-500/20 text-green-300 border-green-500/40',
                        red: 'bg-red-500/20 text-red-300 border-red-500/40',
                        yellow: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40',
                        orange: 'bg-orange-500/20 text-orange-300 border-orange-500/40',
                        blue: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
                        purple: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
                        slate: 'bg-slate-500/20 text-slate-300 border-slate-500/40',
                    }[color] ?? 'bg-slate-500/20 text-slate-300 border-slate-500/40');
                    return (
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                                {/* Form */}
                                <div className="lg:col-span-1">
                                    <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700 rounded-2xl p-6 sticky top-24">
                                        <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                                            <Plus className="w-5 h-5 text-primary-400" /> Add Custom Action
                                        </h2>
                                        <form onSubmit={e => {
                                            e.preventDefault();
                                            const fd = new FormData(e.currentTarget);
                                            addAttendanceAction({
                                                key: fd.get('key') as string,
                                                label: fd.get('label') as string,
                                                icon: fd.get('icon') as string,
                                                color: fd.get('color') as string,
                                                enabled: true
                                            });
                                            (e.target as HTMLFormElement).reset();
                                        }} className="space-y-4">
                                            <div className="space-y-1">
                                                <label className="text-xs font-medium text-slate-400 uppercase">Action Label *</label>
                                                <input required name="label" type="text" className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:border-primary-500 outline-none" placeholder="e.g. Work From Home" />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-xs font-medium text-slate-400 uppercase">Icon (Emoji)</label>
                                                <input name="icon" type="text" maxLength={2} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:border-primary-500 outline-none text-2xl" placeholder="🏠" defaultValue="📋" />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-xs font-medium text-slate-400 uppercase">Key Code</label>
                                                <input name="key" type="text" className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:border-primary-500 outline-none font-mono text-sm" placeholder="WFH (auto)" />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-xs font-medium text-slate-400 uppercase">Color</label>
                                                <select name="color" defaultValue="blue" className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:border-primary-500 outline-none">
                                                    {COLOR_OPTIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                                                </select>
                                            </div>
                                            <button type="submit" className="w-full bg-primary-600 hover:bg-primary-500 text-white font-bold py-2.5 rounded-xl transition-all flex items-center justify-center gap-2">
                                                <Save className="w-4 h-4" /> Add Action
                                            </button>
                                        </form>
                                    </div>
                                </div>

                                {/* Cards */}
                                <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4 content-start">
                                    {attendanceActions.map(action => (
                                        <div key={action.id} className={`bg-slate-800/30 border rounded-2xl p-5 transition-all group ${action.enabled ? 'border-slate-700/50 hover:border-primary-500/50' : 'border-slate-700/20 opacity-60'}`}>
                                            <div className="flex items-start justify-between mb-3">
                                                {/* Preview button */}
                                                <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-sm font-semibold ${colorBadge(action.color)}`}>
                                                    <span className="text-base">{action.icon}</span> {action.label}
                                                </span>
                                                {/* Controls */}
                                                <div className="flex items-center gap-2">
                                                    {/* Toggle ON/OFF */}
                                                    <button
                                                        onClick={() => toggleAttendanceAction(action.id)}
                                                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${action.enabled ? 'bg-primary-600' : 'bg-slate-700'}`}
                                                        title={action.enabled ? 'Disable' : 'Enable'}
                                                    >
                                                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${action.enabled ? 'translate-x-6' : 'translate-x-1'}`} />
                                                    </button>
                                                    {!action.isDefault && (
                                                        <button
                                                            onClick={() => setWarning({ isOpen: true, title: 'Delete Action?', message: `"${action.label}" action permanently delete ho jayegi.`, severity: 'danger', confirmText: 'Delete', onConfirm: () => deleteAttendanceAction(action.id) })}
                                                            className="p-1.5 bg-slate-800 hover:bg-red-500/20 hover:text-red-400 rounded-lg transition-all text-slate-400"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 mt-2">
                                                <span className="text-xs font-mono bg-slate-900 border border-slate-700 px-2 py-0.5 rounded text-slate-400">KEY: {action.key}</span>
                                                {action.isDefault && <span className="text-xs text-slate-500">🔒 Default</span>}
                                                {!action.enabled && <span className="text-xs text-red-400 font-medium">● Disabled</span>}
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* ── Punch Method Config ────────────────────────── */}
                                <div className="mt-8">
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center">
                                            <Camera className="w-4 h-4 text-blue-400" />
                                        </div>
                                        <div>
                                            <h3 className="text-white font-bold text-sm">Punch Methods</h3>
                                            <p className="text-slate-400 text-xs">Jo methods enable hain woh Punch Widget mein dikhenge</p>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        {([
                                            { key: 'face' as const, icon: '🫥', desc: 'Webcam se live photo le ke punch karo' },
                                            { key: 'fingerprint' as const, icon: '👆', desc: 'Device fingerprint/biometric se punch karo' },
                                            { key: 'photoUpload' as const, icon: '📷', desc: 'Gallery se photo upload karke punch karo' },
                                        ] as const).map(({ key, icon, desc }) => {
                                            const m = punchMethods[key];
                                            return (
                                                <div key={key} className={`border rounded-2xl p-4 transition-all ${m.enabled ? 'border-blue-500/40 bg-blue-500/5' : 'border-slate-700/50 bg-slate-800/30 opacity-60'}`}>
                                                    <div className="flex items-start justify-between mb-3">
                                                        <span className="text-2xl">{icon}</span>
                                                        <button
                                                            onClick={() => _updatePunchMethod(key, { enabled: !m.enabled })}
                                                            className={`w-11 h-6 rounded-full transition-all relative shrink-0 ${m.enabled ? 'bg-blue-500' : 'bg-slate-600'}`}
                                                        >
                                                            <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-all shadow-sm ${m.enabled ? 'left-[22px]' : 'left-0.5'}`} />
                                                        </button>
                                                    </div>
                                                    <input
                                                        value={m.label}
                                                        onChange={e => _updatePunchMethod(key, { label: e.target.value })}
                                                        className="w-full bg-transparent text-white font-bold text-sm border-b border-slate-700 focus:border-blue-500 outline-none pb-1 mb-1"
                                                    />
                                                    <p className="text-xs text-slate-500">{desc}</p>
                                                    <span className={`mt-2 inline-block text-[10px] font-bold px-2 py-0.5 rounded-full ${m.enabled ? 'bg-blue-500/20 text-blue-300' : 'bg-slate-700 text-slate-500'}`}>
                                                        {m.enabled ? '● ACTIVE' : '○ DISABLED'}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })()
            }


            {/* ─── System Keys (Super Admin Only) ─── */}
            {
                activeTab === 'keys' && (() => {
                    const CATEGORIES = ['PAYROLL', 'ATTENDANCE', 'LEAVES', 'GENERAL', 'SECURITY'] as const;
                    const CAT_COLORS: Record<string, string> = {
                        PAYROLL: 'bg-green-500/20 text-green-300 border-green-500/30',
                        ATTENDANCE: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
                        LEAVES: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
                        GENERAL: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
                        SECURITY: 'bg-red-500/20 text-red-300 border-red-500/30',
                    };

                    if (!isSuperAdmin) {
                        return (
                            <div className="flex flex-col items-center justify-center py-24 gap-4">
                                <div className="w-20 h-20 rounded-full bg-red-500/10 flex items-center justify-center">
                                    <Lock className="w-10 h-10 text-red-400" />
                                </div>
                                <h2 className="text-2xl font-bold text-white">Access Denied</h2>
                                <p className="text-slate-400 text-center max-w-sm">Yeh section sirf <span className="text-amber-400 font-bold">Super Admin</span> ke liye hai. System Keys dekhne ya badalne ki permission nahi hai.</p>
                            </div>
                        );
                    }

                    return (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                            {/* Form */}
                            <div className="lg:col-span-1">
                                <div className="bg-slate-800/50 backdrop-blur-xl border border-amber-500/30 rounded-2xl p-6 sticky top-24">
                                    <h2 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
                                        <Key className="w-5 h-5 text-amber-400" /> Add System Key
                                    </h2>
                                    <p className="text-xs text-amber-400/70 mb-5">⚡ Super Admin Only — Yeh keys system-wide rules set karti hain</p>
                                    <form onSubmit={e => {
                                        e.preventDefault();
                                        const fd = new FormData(e.currentTarget);
                                        addSystemKey({
                                            key: fd.get('key') as string,
                                            label: fd.get('label') as string,
                                            value: fd.get('value') as string,
                                            category: fd.get('category') as typeof CATEGORIES[number],
                                            description: fd.get('description') as string,
                                            isSecret: fd.get('isSecret') === 'on',
                                        });
                                        (e.target as HTMLFormElement).reset();
                                    }} className="space-y-3">
                                        <div>
                                            <label className="text-xs font-medium text-slate-400 uppercase">Label *</label>
                                            <input required name="label" type="text" className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:border-amber-500 outline-none mt-1" placeholder="e.g. Max OT Hours" />
                                        </div>
                                        <div>
                                            <label className="text-xs font-medium text-slate-400 uppercase">Key Code *</label>
                                            <input required name="key" type="text" className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm font-mono focus:border-amber-500 outline-none mt-1" placeholder="MAX_OT_HOURS" />
                                        </div>
                                        <div>
                                            <label className="text-xs font-medium text-slate-400 uppercase">Value *</label>
                                            <input required name="value" type="text" className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:border-amber-500 outline-none mt-1" placeholder="50" />
                                        </div>
                                        <div>
                                            <label className="text-xs font-medium text-slate-400 uppercase">Category</label>
                                            <select name="category" defaultValue="GENERAL" className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:border-amber-500 outline-none mt-1">
                                                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-xs font-medium text-slate-400 uppercase">Description</label>
                                            <input name="description" type="text" className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:border-amber-500 outline-none mt-1" placeholder="Short explanation" />
                                        </div>
                                        <label className="flex items-center gap-3 cursor-pointer pt-1">
                                            <input name="isSecret" type="checkbox" className="accent-amber-500 w-4 h-4" />
                                            <span className="text-sm text-slate-300">Secret Value (mask from non-admins)</span>
                                        </label>
                                        <button type="submit" className="w-full bg-amber-600 hover:bg-amber-500 text-white font-bold py-2.5 rounded-xl transition-all flex items-center justify-center gap-2 mt-2">
                                            <Save className="w-4 h-4" /> Save Key
                                        </button>
                                    </form>
                                </div>
                            </div>

                            {/* Keys Table */}
                            <div className="lg:col-span-2 space-y-3">
                                {CATEGORIES.map(cat => {
                                    const catKeys = systemKeys.filter(k => k.category === cat);
                                    if (catKeys.length === 0) return null;
                                    return (
                                        <div key={cat} className="bg-slate-800/30 border border-slate-700/50 rounded-2xl overflow-hidden">
                                            <div className={`px-4 py-2 flex items-center gap-2 border-b border-slate-700/50`}>
                                                <span className={`text-xs font-bold px-2 py-0.5 rounded border ${CAT_COLORS[cat]}`}>{cat}</span>
                                                <span className="text-xs text-slate-500">{catKeys.length} key{catKeys.length > 1 ? 's' : ''}</span>
                                            </div>
                                            {catKeys.map((sk, idx) => {
                                                return (
                                                    <KeyRow
                                                        key={sk.id}
                                                        sk={sk}
                                                        isLast={idx === catKeys.length - 1}
                                                        onDelete={() => setWarning({ isOpen: true, title: 'Delete Key?', message: `"${sk.key}" key permanently delete ho jayegi. Is key ka use karne wali features break ho sakti hain.`, severity: 'danger', confirmText: 'Delete', onConfirm: () => deleteSystemKey(sk.id) })}
                                                        onUpdate={(data) => updateSystemKey(sk.id, data)}
                                                    />
                                                );
                                            })}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })()
            }


            {/* ─── Holidays ─── */}
            {
                activeTab === 'holidays' && (() => {
                    const sortedHolidays = [...holidays].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
                    // hForm, setHForm, canManageHolidays, handleHSubmit are hoisted to component top-level (Rules of Hooks)

                    return (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {/* Add Form */}
                            <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700 rounded-2xl p-6 h-fit">
                                <h3 className="font-bold text-white mb-5 flex items-center gap-2 border-b border-slate-700 pb-4">
                                    <Plus className="w-5 h-5 text-primary-400" /> Add New Holiday
                                </h3>
                                {!canManageHolidays && <p className="text-yellow-400 text-sm mb-4">⚠️ View only — Holiday manage karne ki permission nahi hai.</p>}
                                <form onSubmit={handleHSubmit} className="space-y-4">
                                    <div>
                                        <label className="text-xs font-medium text-slate-400 uppercase">Holiday Name *</label>
                                        <input
                                            disabled={!canManageHolidays}
                                            type="text"
                                            value={hForm.name}
                                            onChange={e => setHForm({ ...hForm, name: e.target.value })}
                                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:border-primary-500 outline-none mt-1 disabled:opacity-50"
                                            placeholder="e.g. Diwali, Independence Day"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-medium text-slate-400 uppercase">Date *</label>
                                        <input
                                            disabled={!canManageHolidays}
                                            type="date"
                                            value={hForm.date}
                                            onChange={e => setHForm({ ...hForm, date: e.target.value })}
                                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:border-primary-500 outline-none mt-1 disabled:opacity-50"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-medium text-slate-400 uppercase">Type</label>
                                        <select
                                            disabled={!canManageHolidays}
                                            value={hForm.type}
                                            onChange={e => setHForm({ ...hForm, type: e.target.value as any })}
                                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:border-primary-500 outline-none mt-1 disabled:opacity-50"
                                        >
                                            <option value="FESTIVAL">Festival</option>
                                            <option value="NATIONAL">National Holiday</option>
                                            <option value="OPTIONAL">Optional</option>
                                        </select>
                                    </div>
                                    <button
                                        type="submit"
                                        disabled={!canManageHolidays}
                                        className="w-full py-2.5 bg-primary-600 hover:bg-primary-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2"
                                    >
                                        <Calendar className="w-4 h-4" /> Add to Calendar
                                    </button>
                                </form>
                            </div>

                            {/* Holidays List */}
                            <div className="md:col-span-2 bg-slate-800/30 border border-slate-700/50 rounded-2xl overflow-hidden">
                                <div className="p-4 border-b border-slate-700/50 bg-slate-800/40 flex items-center gap-2">
                                    <Calendar className="w-5 h-5 text-yellow-400" />
                                    <h3 className="font-bold text-white">Upcoming Holidays</h3>
                                    <span className="ml-auto text-xs text-slate-500">{sortedHolidays.length} total</span>
                                </div>
                                <div className="divide-y divide-slate-700/30">
                                    {sortedHolidays.length === 0 && (
                                        <div className="flex flex-col items-center justify-center py-16 text-slate-500">
                                            <Calendar className="w-10 h-10 mb-3 opacity-30" />
                                            <p>Koi holiday add nahi ki gayi abhi tak.</p>
                                        </div>
                                    )}
                                    {sortedHolidays.map(h => (
                                        <div key={h.id} className="group flex items-center gap-4 p-4 hover:bg-slate-700/20 transition-all">
                                            <div className="w-14 h-14 bg-slate-900 rounded-xl flex flex-col items-center justify-center border border-slate-700 shrink-0">
                                                <span className="text-[10px] text-slate-500 uppercase font-bold">{new Date(h.date).toLocaleString('default', { month: 'short' })}</span>
                                                <span className="text-xl font-bold text-white leading-none">{new Date(h.date).getDate()}</span>
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2">
                                                    <p className="font-bold text-white">{h.name}</p>
                                                    <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium uppercase ${h.type === 'NATIONAL' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                                                        h.type === 'OPTIONAL' ? 'bg-slate-500/10 text-slate-400 border-slate-500/20' :
                                                            'bg-purple-500/10 text-purple-400 border-purple-500/20'
                                                        }`}>{h.type}</span>
                                                </div>
                                                <p className="text-sm text-slate-400">{new Date(h.date).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric' })}</p>
                                            </div>
                                            {canManageHolidays && (
                                                <button
                                                    onClick={() => removeHoliday(h.id)}
                                                    className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    );
                })()
            }


            {/* ─── Punch System (Methods + Location) ─── */}
            {
                activeTab === 'punch' && (() => {

                    const METHOD_ICONS: Record<string, JSX.Element> = {
                        face: <ScanFace className="w-5 h-5" />,
                        fingerprint: <Fingerprint className="w-5 h-5" />,
                        photoUpload: <Camera className="w-5 h-5" />,
                    };
                    const METHOD_COLORS: Record<string, string> = {
                        face: 'text-blue-400',
                        fingerprint: 'text-indigo-400',
                        photoUpload: 'text-cyan-400',
                    };

                    return (
                        <div className="space-y-8 max-w-3xl">

                            {/* ── Punch Methods ── */}
                            <div className="bg-slate-800/30 border border-slate-700/50 rounded-2xl p-6">
                                <div className="flex items-center gap-3 mb-5">
                                    <div className="w-9 h-9 rounded-xl bg-blue-500/15 flex items-center justify-center border border-blue-500/20">
                                        <Camera className="w-4.5 h-4.5 text-blue-400" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-white text-sm">Punch Methods</h3>
                                        <p className="text-xs text-slate-500">Employee punch ke liye kaun sa method allow hai</p>
                                    </div>
                                </div>
                                <div className="space-y-3">
                                    {(['face', 'fingerprint', 'photoUpload'] as const).map(method => {
                                        const m = punchMethods[method];
                                        return (
                                            <div key={method} className={`flex items-center gap-4 px-4 py-3 rounded-xl border transition-all ${m.enabled ? 'bg-slate-700/30 border-slate-600/40' : 'bg-slate-800/20 border-slate-700/20 opacity-60'
                                                }`}>
                                                <span className={`${METHOD_COLORS[method]}`}>{METHOD_ICONS[method]}</span>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        {isAdmin ? (
                                                            <input
                                                                value={m.label}
                                                                onChange={e => _updatePunchMethod(method, { label: e.target.value })}
                                                                className="bg-transparent text-white text-sm font-semibold w-full outline-none border-b border-transparent focus:border-slate-500 transition-colors"
                                                            />
                                                        ) : (
                                                            <span className="text-white font-bold text-sm">{m.label}</span>
                                                        )}
                                                        {!m.enabled && <span className="text-[10px] bg-slate-800 text-slate-500 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">Disabled</span>}
                                                    </div>
                                                    <p className="text-xs text-slate-500 capitalize">{method === 'photoUpload' ? 'Live Camera Selfie' : method}</p>
                                                </div>
                                                {isAdmin && (
                                                    <button
                                                        onClick={() => _updatePunchMethod(method, { enabled: !m.enabled })}
                                                        className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg transition-all ${m.enabled
                                                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25'
                                                            : 'bg-slate-700/50 text-slate-500 border border-slate-600/30 hover:bg-slate-700'
                                                            }`}
                                                    >
                                                        {m.enabled
                                                            ? <><ToggleRight className="w-4 h-4" /> Enabled</>
                                                            : <><ToggleLeft className="w-4 h-4" /> Disabled</>}
                                                    </button>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* ── GPS Location Restriction ── */}
                            <div className="bg-slate-800/30 border border-slate-700/50 rounded-2xl p-6">
                                <div className="flex items-center justify-between mb-5">
                                    <div className="flex items-center gap-3">
                                        <div className="w-9 h-9 rounded-xl bg-emerald-500/15 flex items-center justify-center border border-emerald-500/20">
                                            <MapPin className="w-4.5 h-4.5 text-emerald-400" />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-white text-sm">GPS Location Restriction</h3>
                                            <p className="text-xs text-slate-500">Sirf office ke andar se punch allow karo</p>
                                        </div>
                                    </div>
                                    {isAdmin && (
                                        <button
                                            onClick={() => _updatePunchLocationMaster({ enabled: !punchLocationMaster.enabled })}
                                            className={`flex items-center gap-2 text-xs font-bold px-4 py-2 rounded-xl transition-all border ${punchLocationMaster.enabled
                                                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/25'
                                                : 'bg-slate-700/50 text-slate-400 border-slate-600/30 hover:bg-slate-700'
                                                }`}
                                        >
                                            {punchLocationMaster.enabled
                                                ? <><ToggleRight className="w-4 h-4" /> Location ON</>
                                                : <><ToggleLeft className="w-4 h-4" /> Location OFF</>}
                                        </button>
                                    )}
                                </div>

                                {punchLocationMaster.enabled && (() => {
                                    const detectMyLocation = () => {
                                        setDetectingGps(true);
                                        navigator.geolocation.getCurrentPosition(
                                            (pos) => {
                                                setLocDraft(d => ({ ...d, lat: pos.coords.latitude, lng: pos.coords.longitude }));
                                                setDetectingGps(false);
                                            },
                                            (err) => {
                                                console.error('GPS error:', err.message);
                                                setDetectingGps(false);
                                            },
                                            { enableHighAccuracy: true }
                                        );
                                    };

                                    const saveLocation = () => {
                                        if (!locDraft.lat || !locDraft.lng) return alert('Pehli GPS Location set kijiye');
                                        _updatePunchLocationMaster(locDraft);
                                        alert('Master Location Save ho gayi');
                                    };
                                    return (
                                        <div className="space-y-4">
                                            {/* Location name */}
                                            <div>
                                                <label className="text-xs text-slate-400 font-medium mb-1.5 block">Location Name</label>
                                                <input
                                                    value={locDraft.name}
                                                    onChange={e => setLocDraft(d => ({ ...d, name: e.target.value }))}
                                                    placeholder="e.g. Head Office"
                                                    disabled={!isAdmin}
                                                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500/50 transition-colors disabled:opacity-50"
                                                />
                                            </div>

                                            {/* Lat + Lng */}
                                            <div className="grid grid-cols-2 gap-3">
                                                <div>
                                                    <label className="text-xs text-slate-400 font-medium mb-1.5 block">Latitude</label>
                                                    <input
                                                        type="number" step="0.000001"
                                                        value={locDraft.lat}
                                                        onChange={e => setLocDraft(d => ({ ...d, lat: +e.target.value }))}
                                                        disabled={!isAdmin}
                                                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm font-mono focus:outline-none focus:border-emerald-500/50 transition-colors disabled:opacity-50"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-xs text-slate-400 font-medium mb-1.5 block">Longitude</label>
                                                    <input
                                                        type="number" step="0.000001"
                                                        value={locDraft.lng}
                                                        onChange={e => setLocDraft(d => ({ ...d, lng: +e.target.value }))}
                                                        disabled={!isAdmin}
                                                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm font-mono focus:outline-none focus:border-emerald-500/50 transition-colors disabled:opacity-50"
                                                    />
                                                </div>
                                            </div>

                                            {/* Detect GPS button */}
                                            {isAdmin && (
                                                <button
                                                    onClick={detectMyLocation}
                                                    disabled={detectingGps}
                                                    className="flex items-center gap-2 text-xs font-bold text-emerald-400 hover:text-emerald-300 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/15 transition-all disabled:opacity-50"
                                                >
                                                    {detectingGps
                                                        ? <><Navigation className="w-3.5 h-3.5 animate-pulse" /> Detecting...</>
                                                        : <><Crosshair className="w-3.5 h-3.5" /> My Current Location Detect Karo</>}
                                                </button>
                                            )}

                                            {/* Radius */}
                                            <div>
                                                <div className="flex items-center justify-between mb-2">
                                                    <label className="text-xs text-slate-400 font-medium">Allowed Radius</label>
                                                    <span className="text-sm font-bold text-emerald-400 font-mono">{locDraft.radiusMeters}m</span>
                                                </div>
                                                <input
                                                    type="range" min={25} max={2000} step={25}
                                                    value={locDraft.radiusMeters}
                                                    onChange={e => setLocDraft(d => ({ ...d, radiusMeters: +e.target.value }))}
                                                    disabled={!isAdmin}
                                                    className="w-full accent-emerald-500 disabled:opacity-50"
                                                />
                                                <div className="flex justify-between text-xs text-slate-600 mt-1">
                                                    <span>25m</span><span>500m</span><span>1km</span><span>2km</span>
                                                </div>
                                            </div>

                                            {/* Active zone preview */}
                                            <div className="bg-slate-900/50 rounded-xl px-4 py-3 flex items-center gap-3 border border-slate-700/30">
                                                <MapPin className="w-4 h-4 text-emerald-400 shrink-0" />
                                                <div className="text-xs">
                                                    <p className="text-white font-semibold">{locDraft.name || 'Location not set'}</p>
                                                    <p className="text-slate-500 font-mono">{locDraft.lat}, {locDraft.lng} · {locDraft.radiusMeters}m radius</p>
                                                </div>
                                            </div>

                                            {/* Save button */}
                                            {isAdmin && (
                                                <button
                                                    onClick={saveLocation}
                                                    className="w-full py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:brightness-110 text-white rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/30"
                                                >
                                                    <Save className="w-4 h-4" /> Location Save Karo
                                                </button>
                                            )}
                                        </div>
                                    );
                                })()}

                                {!punchLocationMaster.enabled && (
                                    <div className="flex items-center gap-3 bg-slate-900/40 rounded-xl px-4 py-3 border border-slate-700/20">
                                        <MapPin className="w-4 h-4 text-slate-600" />
                                        <p className="text-xs text-slate-500">Location restriction disabled hai. Enable karo to office boundary se punch restrict karo.</p>
                                    </div>
                                )}
                            </div>

                            {/* ── Multi-Location GPS Zones ── */}
                            <div className="bg-slate-800/30 border border-slate-700/50 rounded-2xl p-6">
                                <div className="flex items-center justify-between mb-5">
                                    <div className="flex items-center gap-3">
                                        <div className="w-9 h-9 rounded-xl bg-teal-500/15 flex items-center justify-center border border-teal-500/20">
                                            <MapPin className="w-4 h-4 text-teal-400" />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-white text-sm">Multi-Location GPS Zones</h3>
                                            <p className="text-xs text-slate-500">Multiple branches / offices ke liye alag GPS zones</p>
                                        </div>
                                    </div>
                                    {isAdmin && (
                                        <button
                                            onClick={() => {
                                                const name = prompt('Zone name (e.g. Head Office, Branch A):');
                                                if (!name) return;
                                                const latStr = prompt('Latitude (e.g. 28.6139):');
                                                const lngStr = prompt('Longitude (e.g. 77.2090):');
                                                const lat = parseFloat(latStr || '0');
                                                const lng = parseFloat(lngStr || '0');
                                                if (isNaN(lat) || isNaN(lng)) return;
                                                addPunchLocation({ name, lat, lng, radiusMeters: 100, enabled: true });
                                            }}
                                            className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg bg-teal-500/15 text-teal-400 border border-teal-500/30 hover:bg-teal-500/25 transition-all"
                                        >
                                            <Plus className="w-3.5 h-3.5" /> Add Zone
                                        </button>
                                    )}
                                </div>

                                {punchLocations.length === 0 ? (
                                    <div className="flex items-center gap-3 bg-slate-900/40 rounded-xl px-4 py-3 border border-slate-700/20">
                                        <MapPin className="w-4 h-4 text-slate-600" />
                                        <p className="text-xs text-slate-500">Koi GPS zone add nahi kiya. "+ Add Zone" se new location add karo.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {punchLocations.map(zone => {
                                            const bssids: string[] = zone.allowedBSSIDs || [];
                                            return (
                                                <div key={zone.id} className={`rounded-xl border transition-all ${zone.enabled ? 'bg-slate-700/30 border-slate-600/40' : 'bg-slate-800/20 border-slate-700/20 opacity-50'}`}>
                                                    {/* Main Zone Row */}
                                                    <div className="flex items-center gap-3 px-4 py-3">
                                                        <div className={`w-2 h-2 rounded-full shrink-0 ${zone.enabled ? 'bg-teal-400' : 'bg-slate-600'}`} />
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-sm font-semibold text-white truncate">{zone.name}</p>
                                                            <p className="text-xs text-slate-500 font-mono">{zone.lat.toFixed(5)}, {zone.lng.toFixed(5)} · {zone.radiusMeters}m</p>
                                                        </div>
                                                        {isAdmin && (
                                                            <div className="flex items-center gap-1 shrink-0">
                                                                {/* Radius quick edit */}
                                                                <input
                                                                    type="number"
                                                                    value={zone.radiusMeters}
                                                                    min={10} max={5000} step={10}
                                                                    onChange={e => updatePunchLocation(zone.id, { radiusMeters: +e.target.value })}
                                                                    className="w-16 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-white text-xs font-mono text-center focus:outline-none focus:border-teal-500/50"
                                                                    title="Radius (meters)"
                                                                />
                                                                <span className="text-xs text-slate-500">m</span>
                                                                <button
                                                                    onClick={() => togglePunchLocationZone(zone.id)}
                                                                    className={`px-2 py-1 text-xs font-bold rounded-lg border transition-all ${zone.enabled ? 'bg-teal-500/15 text-teal-400 border-teal-500/30' : 'bg-slate-700/50 text-slate-500 border-slate-600/30'}`}
                                                                >
                                                                    {zone.enabled ? 'ON' : 'OFF'}
                                                                </button>
                                                                <button
                                                                    onClick={() => deletePunchLocation(zone.id)}
                                                                    className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                                                                >
                                                                    <Trash2 className="w-3.5 h-3.5" />
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* ── BSSID (Wi-Fi Router) Binding Section ── */}
                                                    <div className="mx-4 mb-3 px-3 pt-2 pb-3 bg-slate-900/50 rounded-lg border border-slate-700/30">
                                                        <div className="flex items-center gap-2 mb-2">
                                                            <span className="text-[10px] font-bold text-violet-400 uppercase tracking-wider">📶 Wi-Fi BSSID Binding</span>
                                                            <span className="text-[10px] text-slate-600">Android App Only</span>
                                                        </div>

                                                        {/* Existing BSSIDs */}
                                                        {bssids.length > 0 ? (
                                                            <div className="flex flex-wrap gap-1.5 mb-2">
                                                                {bssids.map((mac, idx) => (
                                                                    <span key={idx} className="flex items-center gap-1 bg-violet-500/10 border border-violet-500/30 text-violet-300 text-[11px] font-mono px-2 py-0.5 rounded-full">
                                                                        {mac}
                                                                        {isAdmin && (
                                                                            <button
                                                                                onClick={() => {
                                                                                    const updated = bssids.filter((_, i) => i !== idx);
                                                                                    updatePunchLocation(zone.id, { allowedBSSIDs: updated } as any);
                                                                                }}
                                                                                className="text-violet-500 hover:text-red-400 transition-colors ml-0.5"
                                                                                title="Remove this BSSID"
                                                                            >×</button>
                                                                        )}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        ) : (
                                                            <p className="text-[11px] text-slate-600 mb-2">No BSSID restrictions — all Wi-Fi networks allowed.</p>
                                                        )}

                                                        {/* Add BSSID input */}
                                                        {isAdmin && (
                                                            <form
                                                                onSubmit={e => {
                                                                    e.preventDefault();
                                                                    const input = (e.currentTarget.elements.namedItem('bssidInput') as HTMLInputElement);
                                                                    const raw = input.value.trim().toUpperCase();
                                                                    // Basic MAC address format validation
                                                                    const macRegex = /^([0-9A-F]{2}[:-]){5}([0-9A-F]{2})$/;
                                                                    if (!macRegex.test(raw)) {
                                                                        input.setCustomValidity('Format: AA:BB:CC:DD:EE:FF');
                                                                        input.reportValidity();
                                                                        return;
                                                                    }
                                                                    if (bssids.includes(raw)) {
                                                                        input.setCustomValidity('Already added');
                                                                        input.reportValidity();
                                                                        return;
                                                                    }
                                                                    input.setCustomValidity('');
                                                                    updatePunchLocation(zone.id, { allowedBSSIDs: [...bssids, raw] } as any);
                                                                    input.value = '';
                                                                }}
                                                                className="flex gap-2"
                                                            >
                                                                <input
                                                                    name="bssidInput"
                                                                    type="text"
                                                                    placeholder="AA:BB:CC:DD:EE:FF"
                                                                    maxLength={17}
                                                                    className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-white text-xs font-mono focus:outline-none focus:border-violet-500/60 transition-colors placeholder-slate-600"
                                                                    onChange={e => {
                                                                        (e.target as HTMLInputElement).setCustomValidity('');
                                                                    }}
                                                                />
                                                                <button
                                                                    type="submit"
                                                                    className="px-3 py-1.5 bg-violet-500/15 border border-violet-500/30 text-violet-400 hover:bg-violet-500/25 text-xs font-bold rounded-lg transition-all"
                                                                >
                                                                    + Add
                                                                </button>
                                                            </form>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                                <p className="text-[11px] text-slate-600 mt-3">💡 Punch ke waqt employee ki location sabse kareeb wale enabled zone se match hoti hai.</p>
                                <p className="text-[11px] text-slate-600 mt-1">📶 BSSID binding sirf Android app users pe apply hoti hai. Regular browser pe skip hoti hai.</p>

                            </div>

                            {/* ── Shift-wise Punch Windows ── */}
                            <div className="bg-slate-800/30 border border-slate-700/50 rounded-2xl p-6">
                                <div className="flex items-center justify-between mb-5">
                                    <div className="flex items-center gap-3">
                                        <div className="w-9 h-9 rounded-xl bg-violet-500/15 flex items-center justify-center border border-violet-500/20">
                                            <Clock className="w-4 h-4 text-violet-400" />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-white text-sm">Shift-wise Punch Windows</h3>
                                            <p className="text-xs text-slate-500">Har shift ke liye allowed check-in / check-out time</p>
                                        </div>
                                    </div>
                                    {isAdmin && (
                                        <button
                                            onClick={() => {
                                                const shiftName = prompt('Shift name (e.g. Morning Shift):');
                                                if (!shiftName) return;
                                                _addShiftPunchWindow({
                                                    shiftId: shiftName.toUpperCase().replace(/\s+/g, '_'),
                                                    shiftName,
                                                    checkInFrom: '07:30',
                                                    checkInTo: '10:30',
                                                    checkOutFrom: '16:00',
                                                    checkOutTo: '21:00',
                                                    enabled: true,
                                                });
                                            }}
                                            className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg bg-violet-500/15 text-violet-400 border border-violet-500/30 hover:bg-violet-500/25 transition-all"
                                        >
                                            <Plus className="w-3.5 h-3.5" /> Add Window
                                        </button>
                                    )}
                                </div>

                                {shiftPunchWindows.length === 0 ? (
                                    <div className="flex items-center gap-3 bg-slate-900/40 rounded-xl px-4 py-3 border border-slate-700/20">
                                        <Clock className="w-4 h-4 text-slate-600" />
                                        <p className="text-xs text-slate-500">Koi punch window set nahi. "+ Add Window" se shift-wise time restrict karo.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {shiftPunchWindows.map((win: any) => (
                                            <div key={win.id} className={`rounded-xl border p-4 transition-all ${win.enabled ? 'bg-slate-700/30 border-slate-600/40' : 'bg-slate-800/20 border-slate-700/20 opacity-50'}`}>
                                                <div className="flex items-center justify-between mb-3">
                                                    <div className="flex items-center gap-2">
                                                        <div className={`w-2 h-2 rounded-full ${win.enabled ? 'bg-violet-400' : 'bg-slate-600'}`} />
                                                        <p className="text-sm font-bold text-white">{win.shiftName}</p>
                                                        <span className="text-xs text-slate-500 font-mono">({win.shiftId})</span>
                                                    </div>
                                                    {isAdmin && (
                                                        <div className="flex items-center gap-1">
                                                            <button
                                                                onClick={() => _updateShiftPunchWindow(win.id, { enabled: !win.enabled })}
                                                                className={`px-2 py-0.5 text-xs font-bold rounded border transition-all ${win.enabled ? 'bg-violet-500/15 text-violet-400 border-violet-500/30' : 'bg-slate-700/50 text-slate-500 border-slate-600/30'}`}
                                                            >
                                                                {win.enabled ? 'ON' : 'OFF'}
                                                            </button>
                                                            <button onClick={() => _removeShiftPunchWindow(win.id)} className="p-1 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all">
                                                                <Trash2 className="w-3.5 h-3.5" />
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div>
                                                        <p className="text-[10px] text-slate-500 uppercase font-bold mb-1.5 flex items-center gap-1">
                                                            <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" /> Check-In Window
                                                        </p>
                                                        <div className="flex items-center gap-2">
                                                            <input
                                                                type="time"
                                                                value={win.checkInFrom}
                                                                disabled={!isAdmin}
                                                                onChange={e => _updateShiftPunchWindow(win.id, { checkInFrom: e.target.value })}
                                                                className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-white text-xs font-mono focus:outline-none focus:border-violet-500/50 disabled:opacity-50"
                                                            />
                                                            <span className="text-slate-500 text-xs">→</span>
                                                            <input
                                                                type="time"
                                                                value={win.checkInTo}
                                                                disabled={!isAdmin}
                                                                onChange={e => _updateShiftPunchWindow(win.id, { checkInTo: e.target.value })}
                                                                className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-white text-xs font-mono focus:outline-none focus:border-violet-500/50 disabled:opacity-50"
                                                            />
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <p className="text-[10px] text-slate-500 uppercase font-bold mb-1.5 flex items-center gap-1">
                                                            <span className="w-1.5 h-1.5 rounded-full bg-red-400 inline-block" /> Check-Out Window
                                                        </p>
                                                        <div className="flex items-center gap-2">
                                                            <input
                                                                type="time"
                                                                value={win.checkOutFrom}
                                                                disabled={!isAdmin}
                                                                onChange={e => _updateShiftPunchWindow(win.id, { checkOutFrom: e.target.value })}
                                                                className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-white text-xs font-mono focus:outline-none focus:border-violet-500/50 disabled:opacity-50"
                                                            />
                                                            <span className="text-slate-500 text-xs">→</span>
                                                            <input
                                                                type="time"
                                                                value={win.checkOutTo}
                                                                disabled={!isAdmin}
                                                                onChange={e => _updateShiftPunchWindow(win.id, { checkOutTo: e.target.value })}
                                                                className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-white text-xs font-mono focus:outline-none focus:border-violet-500/50 disabled:opacity-50"
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                <p className="text-[11px] text-slate-600 mt-3">⚠️ Is window ke bahar punch karne par "Late Punch" alert dikhega.</p>
                            </div>

                        </div>
                    );
                })()
            }

            <WarningModal
                isOpen={warning.isOpen}
                onClose={() => setWarning(prev => ({ ...prev, isOpen: false }))}
                onConfirm={warning.onConfirm}
                title={warning.title}
                message={warning.message}
                severity={warning.severity}
                confirmText={warning.confirmText}
            />
            {activeTab === 'salesman' && <SalesmanConfigPanel />}
            {activeTab === 'statutory' && <StatutorySettings />}
            {activeTab === 'roles' && <RoleAccessConfig />}
            {activeTab === 'customFields' && <CustomFieldsConfig />}
            {activeTab === 'workflows' && <WorkflowBuilder />}
        </div >
    );
};
