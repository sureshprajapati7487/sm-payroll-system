import { useState, useMemo, useEffect } from 'react';
import { useEmployeeStore } from '@/store/employeeStore';
import { useMultiCompanyStore } from '@/store/multiCompanyStore';
import { useClientStore } from '@/store/clientStore';
import { useNavigate } from 'react-router-dom';
import {
    ShoppingBag, Users, CheckCircle2, Clock,
    AlertCircle, Plus, Trash2, Edit3, Phone, Mail,
    ArrowRight, Target, TrendingUp, X, Check, Building2,
    ListChecks, ChevronDown, ChevronUp, Calendar, BarChart2,
    IndianRupee, Activity, Navigation
} from 'lucide-react';
import { ClientListPage } from './ClientListPage';
import { RouteTab } from './RouteTab';

import { useSalesTaskStore, SalesTask, TaskPriority, TaskStatus } from '@/store/salesTaskStore';

const PRIORITY_META: Record<TaskPriority, { label: string; color: string; bg: string; dot: string }> = {
    high: { label: 'High', color: 'text-red-400', bg: 'bg-red-500/15 border-red-500/30', dot: 'bg-red-400' },
    medium: { label: 'Medium', color: 'text-yellow-400', bg: 'bg-yellow-500/15 border-yellow-500/30', dot: 'bg-yellow-400' },
    low: { label: 'Low', color: 'text-green-400', bg: 'bg-green-500/15 border-green-500/30', dot: 'bg-green-400' },
};
// ─── Add/Edit Task Modal ──────────────────────────────────────────────────────
const TaskModal = ({
    task, salesEmployees, onSave, onClose,
}: {
    task: Partial<SalesTask> | null;
    salesEmployees: { id: string; name: string }[];
    onSave: (t: Partial<SalesTask>) => void;
    onClose: () => void;
}) => {
    const [form, setForm] = useState<Partial<SalesTask>>(
        task || { title: '', priority: 'medium', status: 'todo' }
    );

    const handleSave = () => {
        if (!form.title?.trim()) return;
        onSave({
            id: form.id || `task-${Date.now()}`,
            title: form.title!,
            description: form.description,
            salesmanId: form.salesmanId,
            priority: (form.priority as TaskPriority) || 'medium',
            status: form.status ?? 'todo',
            dueDate: form.dueDate,
            createdAt: form.createdAt || new Date().toISOString(),
            completedAt: form.completedAt,
        });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative glass rounded-2xl border border-dark-border w-full max-w-md shadow-2xl">
                <div className="flex items-center justify-between px-6 py-4 border-b border-dark-border">
                    <h2 className="text-white font-bold text-base flex items-center gap-2">
                        <ListChecks className="w-4 h-4 text-orange-400" />
                        {task?.id ? 'Edit Task' : 'New Task'}
                    </h2>
                    <button onClick={onClose} className="text-dark-muted hover:text-white transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 space-y-4">
                    <div>
                        <label className="text-xs text-dark-muted uppercase block mb-1">Task Title *</label>
                        <input
                            autoFocus
                            value={form.title || ''}
                            onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                            onKeyDown={e => e.key === 'Enter' && handleSave()}
                            className="w-full rounded-lg px-3 py-2 text-sm"
                            placeholder="e.g. Call 10 new clients today"
                        />
                    </div>
                    <div>
                        <label className="text-xs text-dark-muted uppercase block mb-1">Description (Optional)</label>
                        <textarea
                            value={form.description || ''}
                            onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                            rows={2}
                            className="w-full rounded-lg px-3 py-2 text-sm resize-none"
                            placeholder="Task details..."
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs text-dark-muted uppercase block mb-1">Priority</label>
                            <select
                                value={form.priority || 'MEDIUM'}
                                onChange={e => setForm(p => ({ ...p, priority: e.target.value as TaskPriority }))}
                                className="w-full rounded-lg px-3 py-2 text-sm"
                            >
                                <option value="HIGH">🔴 High</option>
                                <option value="MEDIUM">🟡 Medium</option>
                                <option value="LOW">🟢 Low</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-xs text-dark-muted uppercase block mb-1">Due Date</label>
                            <input
                                type="date"
                                value={form.dueDate || ''}
                                onChange={e => setForm(p => ({ ...p, dueDate: e.target.value || undefined }))}
                                className="w-full rounded-lg px-3 py-2 text-sm"
                            />
                        </div>
                    </div>
                    {salesEmployees.length > 0 && (
                        <div>
                            <label className="text-xs text-dark-muted uppercase block mb-1">Assign To</label>
                            <select
                                value={form.salesmanId || ''}
                                onChange={e => setForm(p => ({ ...p, salesmanId: e.target.value || undefined }))}
                                className="w-full rounded-lg px-3 py-2 text-sm"
                            >
                                <option value="">-- Anyone --</option>
                                {salesEmployees.map(emp => (
                                    <option key={emp.id} value={emp.id}>{emp.name}</option>
                                ))}
                            </select>
                        </div>
                    )}
                    <div className="flex gap-3 pt-2">
                        <button onClick={onClose} className="flex-1 py-2 rounded-lg border border-dark-border text-dark-muted hover:text-white text-sm font-medium transition-colors">
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={!form.title?.trim()}
                            className="flex-1 py-2 rounded-lg bg-orange-500 hover:bg-orange-400 disabled:opacity-40 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2"
                        >
                            <Check className="w-4 h-4" /> Save Task
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ─── Single Task Row ──────────────────────────────────────────────────────────
const TaskRow = ({
    task, empName, onToggle, onEdit, onDelete,
}: {
    task: SalesTask;
    empName: string;
    onToggle: () => void;
    onEdit: () => void;
    onDelete: () => void;
}) => {
    const priority = PRIORITY_META[task.priority] || PRIORITY_META['medium'];
    const isDone = task.status === 'done';
    const isOverdue = !isDone && task.dueDate && new Date(task.dueDate) < new Date();
    const dueDate = task.dueDate ? new Date(task.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : null;

    return (
        <div className={`group flex items-start gap-3 px-5 py-4 hover:bg-white/5 transition-all duration-200 ${isDone ? 'opacity-60' : ''}`}>
            <button
                onClick={onToggle}
                className={`mt-0.5 shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${isDone
                    ? 'bg-green-500 border-green-500 scale-110'
                    : 'border-dark-border hover:border-orange-400 hover:scale-110'
                    }`}
            >
                {isDone && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
            </button>
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                    <p className={`font-semibold text-sm transition-all duration-300 ${isDone ? 'line-through text-dark-muted' : 'text-white'}`}>
                        {task.title}
                    </p>
                    <span className={`w-2 h-2 rounded-full shrink-0 ${priority.dot}`} title={priority.label} />
                    {isOverdue && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-500/15 border border-red-500/30 text-red-400 font-semibold">
                            ⚠️ Overdue
                        </span>
                    )}
                    {isDone && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-500/15 border border-green-500/30 text-green-400 font-semibold">
                            ✅ Done
                        </span>
                    )}
                </div>
                {task.description && (
                    <p className="text-xs text-dark-muted mt-0.5 truncate">{task.description}</p>
                )}
                <div className="flex items-center gap-3 mt-1 text-[11px] flex-wrap">
                    {empName !== '—' && (
                        <span className="flex items-center gap-1 text-dark-muted"><Users className="w-3 h-3" /> {empName}</span>
                    )}
                    {dueDate && (
                        <span className={`flex items-center gap-1 ${isOverdue ? 'text-red-400' : 'text-dark-muted'}`}>
                            <Calendar className="w-3 h-3" />
                            {isDone ? `Done` : `Due: ${dueDate}`}
                        </span>
                    )}
                    {isDone && task.completedAt && (
                        <span className="text-green-400/70">
                            Completed {new Date(task.completedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                        </span>
                    )}
                </div>
            </div>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                {!isDone && (
                    <button onClick={onEdit} className="p-1.5 rounded-lg hover:bg-dark-border/50 text-dark-muted hover:text-white transition-colors" title="Edit">
                        <Edit3 className="w-3.5 h-3.5" />
                    </button>
                )}
                <button onClick={onDelete} className="p-1.5 rounded-lg hover:bg-red-500/10 text-dark-muted hover:text-red-400 transition-colors" title="Delete">
                    <Trash2 className="w-3.5 h-3.5" />
                </button>
            </div>
        </div>
    );
};

// ─── Performance Tab ──────────────────────────────────────────────────────────
const PerformanceTab = ({ salesEmployees }: { salesEmployees: { id: string; name: string; designation?: string; status?: string }[] }) => {
    const { fetchStats } = useClientStore();
    const [statsMap, setStatsMap] = useState<Record<string, any>>({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!salesEmployees.length) { setLoading(false); return; }
        const fetchAll = async () => {
            setLoading(true);
            const results: Record<string, any> = {};
            await Promise.all(
                salesEmployees.map(async (emp) => {
                    try {
                        const s = await fetchStats(emp.id);
                        results[emp.id] = s;
                    } catch {
                        results[emp.id] = { todayVisits: 0, totalVisits: 0, totalClients: 0, totalOrders: 0, totalCollection: 0, overdueClients: 0, avgDurationMins: 0 };
                    }
                })
            );
            setStatsMap(results);
            setLoading(false);
        };
        fetchAll();
        // salesEmployees stable key — object reference se re-render avoid
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [salesEmployees.map(e => e.id).join(',')]);

    if (!salesEmployees.length) {
        return (
            <div className="glass rounded-2xl border border-dark-border p-16 text-center space-y-3">
                <BarChart2 className="w-12 h-12 mx-auto text-dark-muted opacity-30" />
                <p className="text-dark-muted">Koi Sales Employee nahi mila</p>
                <p className="text-xs text-dark-muted">Employee Department mein "Sales" likho</p>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="glass rounded-2xl border border-dark-border p-12 text-center">
                <div className="animate-spin w-8 h-8 rounded-full border-2 border-primary-400 border-t-transparent mx-auto mb-3" />
                <p className="text-dark-muted text-sm">Performance data load ho rahi hai...</p>
            </div>
        );
    }

    // Sort by totalOrders descending
    const sorted = [...salesEmployees].sort((a, b) => (statsMap[b.id]?.totalOrders || 0) - (statsMap[a.id]?.totalOrders || 0));

    return (
        <div className="space-y-4">
            {/* Summary Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                    {
                        label: 'Total Visits Today',
                        value: Object.values(statsMap).reduce((s: number, v: any) => s + (v?.todayVisits || 0), 0),
                        icon: Activity, color: 'text-blue-400', bg: 'bg-blue-500/10'
                    },
                    {
                        label: 'Total Orders (₹)',
                        value: `₹${Object.values(statsMap).reduce((s: number, v: any) => s + (v?.totalOrders || 0), 0).toLocaleString('en-IN')}`,
                        icon: IndianRupee, color: 'text-green-400', bg: 'bg-green-500/10'
                    },
                    {
                        label: 'Total Collection (₹)',
                        value: `₹${Object.values(statsMap).reduce((s: number, v: any) => s + (v?.totalCollection || 0), 0).toLocaleString('en-IN')}`,
                        icon: TrendingUp, color: 'text-emerald-400', bg: 'bg-emerald-500/10'
                    },
                    {
                        label: 'Overdue Visits',
                        value: Object.values(statsMap).reduce((s: number, v: any) => s + (v?.overdueClients || 0), 0),
                        icon: AlertCircle, color: 'text-red-400', bg: 'bg-red-500/10'
                    },
                ].map(({ label, value, icon: Icon, color, bg }) => (
                    <div key={label} className="glass rounded-xl border border-dark-border p-4 flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg ${bg} flex items-center justify-center shrink-0`}>
                            <Icon className={`w-5 h-5 ${color}`} />
                        </div>
                        <div>
                            <p className="text-dark-muted text-xs">{label}</p>
                            <p className={`text-xl font-bold ${color}`}>{value}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Per-Salesman Stats Table */}
            <div className="glass rounded-2xl border border-dark-border overflow-hidden">
                <div className="px-5 py-3 border-b border-dark-border flex items-center gap-2">
                    <BarChart2 className="w-4 h-4 text-orange-400" />
                    <h3 className="text-white font-bold text-sm">Salesman-wise Performance</h3>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 font-semibold">{salesEmployees.length} members</span>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-dark-border/50 bg-dark-surface/30">
                                <th className="px-5 py-3 text-left text-xs text-dark-muted uppercase font-semibold">#</th>
                                <th className="px-5 py-3 text-left text-xs text-dark-muted uppercase font-semibold">Salesman</th>
                                <th className="px-4 py-3 text-center text-xs text-dark-muted uppercase font-semibold">Aaj Visits</th>
                                <th className="px-4 py-3 text-center text-xs text-dark-muted uppercase font-semibold">Total Visits</th>
                                <th className="px-4 py-3 text-center text-xs text-dark-muted uppercase font-semibold">Clients</th>
                                <th className="px-4 py-3 text-right text-xs text-dark-muted uppercase font-semibold">Orders (₹)</th>
                                <th className="px-4 py-3 text-right text-xs text-dark-muted uppercase font-semibold">Collection (₹)</th>
                                <th className="px-4 py-3 text-center text-xs text-dark-muted uppercase font-semibold">Overdue</th>
                                <th className="px-4 py-3 text-center text-xs text-dark-muted uppercase font-semibold">Avg Visit</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-dark-border/30">
                            {sorted.map((emp, idx) => {
                                const s = statsMap[emp.id] || {};
                                const rank = idx + 1;
                                const rankColor = rank === 1 ? 'text-yellow-400' : rank === 2 ? 'text-slate-300' : rank === 3 ? 'text-orange-400' : 'text-dark-muted';
                                const rankEmoji = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`;
                                return (
                                    <tr key={emp.id} className="hover:bg-white/5 transition-colors">
                                        <td className={`px-5 py-3.5 font-bold text-sm ${rankColor}`}>{rankEmoji}</td>
                                        <td className="px-5 py-3.5">
                                            <div className="flex items-center gap-2">
                                                <img
                                                    src={`https://ui-avatars.com/api/?name=${emp.name}&background=random&size=32`}
                                                    alt={emp.name}
                                                    className="w-8 h-8 rounded-full border border-dark-border shrink-0"
                                                />
                                                <div>
                                                    <p className="text-white font-semibold text-sm">{emp.name}</p>
                                                    <p className="text-xs text-dark-muted">{(emp as any).designation || 'Salesman'}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3.5 text-center">
                                            <span className={`font-bold text-sm ${s.todayVisits > 0 ? 'text-blue-400' : 'text-dark-muted'}`}>
                                                {s.todayVisits ?? '—'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3.5 text-center">
                                            <span className="text-white font-semibold text-sm">{s.totalVisits ?? '—'}</span>
                                        </td>
                                        <td className="px-4 py-3.5 text-center">
                                            <span className="flex items-center justify-center gap-1 text-dark-muted text-sm">
                                                <Building2 className="w-3 h-3" /> {s.totalClients ?? '—'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3.5 text-right">
                                            <span className={`font-bold text-sm ${(s.totalOrders || 0) > 0 ? 'text-green-400' : 'text-dark-muted'}`}>
                                                ₹{(s.totalOrders || 0).toLocaleString('en-IN')}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3.5 text-right">
                                            <span className={`font-semibold text-sm ${(s.totalCollection || 0) > 0 ? 'text-emerald-400' : 'text-dark-muted'}`}>
                                                ₹{(s.totalCollection || 0).toLocaleString('en-IN')}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3.5 text-center">
                                            <span className={`text-sm font-bold ${(s.overdueClients || 0) > 0 ? 'text-red-400' : 'text-green-400'}`}>
                                                {(s.overdueClients || 0) > 0 ? `⚠️ ${s.overdueClients}` : '✅ 0'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3.5 text-center">
                                            <span className="text-xs text-dark-muted flex items-center justify-center gap-1">
                                                <Clock className="w-3 h-3" />
                                                {s.avgDurationMins ? `${s.avgDurationMins}m` : '—'}
                                            </span>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

// ─── Today's Activity Banner ──────────────────────────────────────────────────
const TodayActivityBanner = ({ companyId }: { companyId: string }) => {
    const { visits, fetchVisits } = useClientStore();
    const today = new Date().toISOString().split('T')[0];

    useEffect(() => {
        if (companyId) fetchVisits({ companyId, date: today });
        // fetchVisits stable Zustand action — safe to add in deps
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [companyId]);

    const todayVisits = visits.filter(v => v.checkInAt?.startsWith(today));
    const activeNow = todayVisits.filter(v => !v.checkOutAt).length;
    const completed = todayVisits.filter(v => !!v.checkOutAt).length;
    const totalOrders = todayVisits.reduce((s, v) => s + (v.orderAmount || 0), 0);
    const totalCollection = todayVisits.reduce((s, v) => s + (v.collectionAmount || 0), 0);

    return (
        <div className="glass rounded-2xl border border-primary-500/20 p-5">
            <div className="flex items-center gap-2 mb-4">
                <div className="w-7 h-7 rounded-lg bg-primary-500/20 flex items-center justify-center">
                    <Activity className="w-4 h-4 text-primary-400" />
                </div>
                <h3 className="text-white font-bold text-sm">Aaj ki Activity</h3>
                <span className="text-xs text-dark-muted">{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
                {activeNow > 0 && (
                    <span className="ml-auto text-[10px] px-2 py-1 rounded-full bg-green-500/20 text-green-400 border border-green-500/30 font-semibold animate-pulse">
                        🟢 {activeNow} Active Now
                    </span>
                )}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                    { label: 'Total Visits', value: todayVisits.length, color: 'text-blue-400', icon: '🔁' },
                    { label: 'Completed', value: completed, color: 'text-green-400', icon: '✅' },
                    { label: 'Orders (₹)', value: `₹${totalOrders.toLocaleString('en-IN')}`, color: 'text-emerald-400', icon: '🛒' },
                    { label: 'Collection (₹)', value: `₹${totalCollection.toLocaleString('en-IN')}`, color: 'text-yellow-400', icon: '💰' },
                ].map(({ label, value, color, icon }) => (
                    <div key={label} className="bg-dark-surface/40 rounded-xl px-4 py-3 border border-dark-border/50">
                        <p className="text-lg mb-0.5">{icon}</p>
                        <p className={`text-xl font-bold ${color}`}>{value}</p>
                        <p className="text-xs text-dark-muted">{label}</p>
                    </div>
                ))}
            </div>
        </div>
    );
};

// ─── Main Component ───────────────────────────────────────────────────────────
export const SalesmanDashboard = () => {
    const { employees } = useEmployeeStore();
    const { currentCompanyId } = useMultiCompanyStore();
    const navigate = useNavigate();

    const { tasks, fetchTasks, addTask, updateTask, deleteTask } = useSalesTaskStore();
    const [activeTab, setActiveTab] = useState<'tasks' | 'clients' | 'performance' | 'route'>('tasks');
    const [modalTask, setModalTask] = useState<Partial<SalesTask> | null | false>(false);
    const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'DONE'>('ALL');
    const [searchEmp, setSearchEmp] = useState('');
    const [showDone, setShowDone] = useState(true);
    const [pendingDelete, setPendingDelete] = useState<string | null>(null);
    const [pendingClearDone, setPendingClearDone] = useState(false);

    useEffect(() => {
        if (currentCompanyId) {
            fetchTasks();
        }
    }, [currentCompanyId]);

    const salesEmployees = useMemo(() => {
        const base = currentCompanyId ? employees.filter(e => e.companyId === currentCompanyId) : employees;
        return base.filter(e => {
            const dept = (e.department || '').toUpperCase();
            return dept.includes('SALES') || dept.includes('SALESMAN');
        });
    }, [employees, currentCompanyId]);

    const filteredEmployees = useMemo(() =>
        searchEmp.trim()
            ? salesEmployees.filter(e => e.name.toLowerCase().includes(searchEmp.toLowerCase()) || (e.code || '').toLowerCase().includes(searchEmp.toLowerCase()))
            : salesEmployees,
        [salesEmployees, searchEmp]
    );

    const total = tasks.length;
    const done = tasks.filter(t => t.status === 'done').length;
    const pending = total - done;
    const overdue = tasks.filter(t => t.status !== 'done' && t.dueDate && new Date(t.dueDate) < new Date()).length;
    const progress = total > 0 ? Math.round((done / total) * 100) : 0;

    const pendingTasks = useMemo(() =>
        tasks
            .filter(task => task.status !== 'done')
            .filter(() => filter === 'ALL' || filter === 'PENDING')
            .sort((a, b) => {
                const pOrder = { high: 0, medium: 1, low: 2 };
                if (pOrder[a.priority] !== pOrder[b.priority]) return pOrder[a.priority] - pOrder[b.priority];
                if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
                return 0;
            }),
        [tasks, filter]
    );

    const doneTasks = useMemo(() =>
        tasks.filter(t => t.status === 'done').sort((a, b) => (b.completedAt || '').localeCompare(a.completedAt || '')),
        [tasks]
    );

    const saveTask = (t: Partial<SalesTask>) => {
        if (t.id && tasks.some(existing => existing.id === t.id)) {
            updateTask(t.id, t);
        } else {
            addTask(t);
        }
        setModalTask(false);
    };

    const toggleTask = (id: string, currentStatus: TaskStatus) => {
        updateTask(id, {
            status: currentStatus === 'done' ? 'todo' : 'done'
        });
    };

    const handleDelete = (id: string) => setPendingDelete(id);

    const confirmDelete = async () => {
        if (pendingDelete) {
            await deleteTask(pendingDelete);
        }
        setPendingDelete(null);
    };

    const clearDone = () => setPendingClearDone(true);

    const confirmClearDone = async () => {
        const doneTaskIds = tasks.filter(t => t.status === 'done').map(t => t.id);
        for (const id of doneTaskIds) {
            await deleteTask(id);
        }
        setPendingClearDone(false);
    };

    const getEmpName = (id?: string) => salesEmployees.find(e => e.id === id)?.name || '—';

    const TABS = [
        { key: 'tasks', label: 'Tasks', icon: ListChecks },
        { key: 'route', label: "Today's Route", icon: Navigation },
        { key: 'clients', label: 'Clients / Parties', icon: Building2 },
        { key: 'performance', label: 'Performance', icon: BarChart2 },
    ] as const;

    return (
        <div className="space-y-4 md:space-y-6">
            {/* ── Header ── */}
            <div className="flex items-start justify-between flex-wrap gap-3">
                <div>
                    <h1 className="text-xl md:text-2xl font-bold text-white flex items-center gap-3">
                        <div className="w-9 h-9 md:w-10 md:h-10 rounded-xl bg-orange-500/20 flex items-center justify-center shrink-0">
                            <ShoppingBag className="w-4 h-4 md:w-5 md:h-5 text-orange-400" />
                        </div>
                        Salesman Dashboard
                    </h1>
                    <p className="text-dark-muted mt-1 text-sm hidden md:block">Sales team overview + task management + performance</p>
                </div>
                {activeTab === 'tasks' && (
                    <button
                        onClick={() => setModalTask({})}
                        className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-400 text-white rounded-xl text-sm font-semibold transition-all shadow-lg shadow-orange-500/20"
                    >
                        <Plus className="w-4 h-4" /> New Task
                    </button>
                )}
            </div>

            {/* ── Today's Activity Banner (always visible, all tabs) ── */}
            {currentCompanyId && <TodayActivityBanner companyId={currentCompanyId} />}

            {/* ── Tab Bar ── */}
            <div className="overflow-x-auto pb-1 -mx-1 px-1">
                <div className="flex gap-1 glass rounded-xl border border-dark-border p-1 w-max min-w-full md:w-fit">
                    {TABS.map(({ key, label, icon: Icon }) => (
                        <button
                            key={key}
                            onClick={() => setActiveTab(key)}
                            className={`flex items-center gap-1.5 px-3 md:px-4 py-2 rounded-lg text-xs md:text-sm font-semibold transition-all whitespace-nowrap ${activeTab === key ? 'bg-primary-500/20 text-primary-400 shadow' : 'text-dark-muted hover:text-white'}`}
                        >
                            <Icon className="w-3.5 h-3.5 md:w-4 md:h-4 shrink-0" /> {label}
                        </button>
                    ))}
                </div>
            </div>

            {/* ── Clients Tab ── */}
            {activeTab === 'clients' && <ClientListPage />}

            {/* ── Route Tab ── */}
            {activeTab === 'route' && <RouteTab companyId={currentCompanyId} />}

            {/* ── Performance Tab ── */}
            {activeTab === 'performance' && <PerformanceTab salesEmployees={salesEmployees} />}

            {/* ── Tasks Tab ── */}
            {activeTab === 'tasks' && (<>

                {/* KPI Row */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                        { label: 'Total Tasks', value: total, icon: ListChecks, color: 'text-orange-400', bg: 'bg-orange-500/10' },
                        { label: 'Pending', value: pending, icon: AlertCircle, color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
                        { label: 'Overdue', value: overdue, icon: Clock, color: 'text-red-400', bg: 'bg-red-500/10' },
                        { label: 'Completed', value: done, icon: Target, color: 'text-green-400', bg: 'bg-green-500/10' },
                    ].map(({ label, value, icon: Icon, color, bg }) => (
                        <div key={label} className="glass rounded-xl border border-dark-border p-4 flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-lg ${bg} flex items-center justify-center shrink-0`}>
                                <Icon className={`w-5 h-5 ${color}`} />
                            </div>
                            <div>
                                <p className="text-dark-muted text-xs">{label}</p>
                                <p className={`text-2xl font-bold ${color}`}>{value}</p>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Progress Bar */}
                <div className="glass rounded-2xl border border-dark-border p-5">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-green-400" />
                            <span className="text-white font-semibold text-sm">Overall Progress</span>
                        </div>
                        <span className="text-2xl font-bold text-white">{progress}%</span>
                    </div>
                    <div className="w-full h-3 rounded-full bg-dark-border/40 overflow-hidden">
                        <div
                            className="h-full rounded-full bg-gradient-to-r from-orange-500 to-green-500 transition-all duration-700"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                    <p className="text-xs text-dark-muted mt-2">{done} of {total} tasks completed</p>
                </div>

                {/* Main Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                    {/* Sales Team (2/5) */}
                    <div className="lg:col-span-2 glass rounded-2xl border border-dark-border overflow-hidden">
                        <div className="px-5 py-4 border-b border-dark-border flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Users className="w-4 h-4 text-orange-400" />
                                <h3 className="text-white font-bold text-sm">Sales Team</h3>
                                <span className="text-xs px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 font-semibold">
                                    {salesEmployees.length}
                                </span>
                            </div>
                            <button
                                onClick={() => navigate('/employees/new')}
                                className="text-xs text-primary-400 hover:text-primary-300 flex items-center gap-1 font-medium transition-colors"
                            >
                                Add <ArrowRight className="w-3 h-3" />
                            </button>
                        </div>

                        <div className="px-4 py-3 border-b border-dark-border/50">
                            <input
                                value={searchEmp}
                                onChange={e => setSearchEmp(e.target.value)}
                                placeholder="Search salesman..."
                                className="w-full rounded-lg px-3 py-1.5 text-sm"
                            />
                        </div>

                        {filteredEmployees.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-16 text-dark-muted gap-3">
                                <ShoppingBag className="w-10 h-10 opacity-30" />
                                <p className="text-sm font-medium">No Sales Employees Found</p>
                                <p className="text-xs text-center px-4">
                                    Employee create karte waqt Department mein <strong className="text-orange-400">"Sales"</strong> dal kar save karein
                                </p>
                                <button
                                    onClick={() => navigate('/employees/new')}
                                    className="mt-2 px-4 py-2 bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 rounded-lg text-xs font-semibold transition-colors"
                                >
                                    + Add Employee
                                </button>
                            </div>
                        ) : (
                            <div className="divide-y divide-dark-border/40 max-h-[420px] overflow-y-auto">
                                {filteredEmployees.map(emp => (
                                    <div
                                        key={emp.id}
                                        className="flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors cursor-pointer group"
                                        onClick={() => navigate(`/employees/${emp.id}`)}
                                    >
                                        <img
                                            src={emp.avatar || `https://ui-avatars.com/api/?name=${emp.name}&background=random`}
                                            alt={emp.name}
                                            className="w-9 h-9 rounded-full border-2 border-dark-border shrink-0"
                                        />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-semibold text-white truncate">{emp.name}</p>
                                            <p className="text-xs text-dark-muted truncate">{emp.code} • {emp.designation || emp.department}</p>
                                        </div>
                                        <div className="flex flex-col items-end gap-1 shrink-0">
                                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${emp.status === 'ACTIVE' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                                {emp.status}
                                            </span>
                                            <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                {emp.phone && <Phone className="w-3 h-3 text-dark-muted" />}
                                                {emp.email && <Mail className="w-3 h-3 text-dark-muted" />}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Task List (3/5) */}
                    <div className="lg:col-span-3 glass rounded-2xl border border-dark-border overflow-hidden flex flex-col">
                        <div className="px-5 py-4 border-b border-dark-border flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-2">
                                <ListChecks className="w-4 h-4 text-orange-400" />
                                <h3 className="text-white font-bold text-sm">Task List</h3>
                                {pending > 0 && (
                                    <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 font-semibold">
                                        {pending} left
                                    </span>
                                )}
                            </div>
                            <div className="flex gap-1">
                                {(['ALL', 'PENDING', 'DONE'] as const).map(f => (
                                    <button
                                        key={f}
                                        onClick={() => setFilter(f)}
                                        className={`text-[10px] px-2 py-1 rounded-lg font-semibold transition-colors ${filter === f ? 'bg-primary-500/20 text-primary-400 border border-primary-500/30' : 'text-dark-muted hover:text-white'}`}
                                    >
                                        {f === 'ALL' ? 'All' : f === 'PENDING' ? 'Pending' : 'Done'}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto max-h-[500px]">
                            {filter !== 'DONE' && (<>
                                {pendingTasks.length === 0 && (
                                    <div className="flex flex-col items-center justify-center py-12 text-dark-muted gap-3">
                                        <CheckCircle2 className="w-10 h-10 opacity-30 text-green-400" />
                                        <p className="text-sm font-medium text-green-400">Sab tasks complete! 🎉</p>
                                        <button
                                            onClick={() => setModalTask({})}
                                            className="px-4 py-2 bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 rounded-lg text-xs font-semibold transition-colors"
                                        >
                                            + New Task Add Karo
                                        </button>
                                    </div>
                                )}
                                <div className="divide-y divide-dark-border/30">
                                    {pendingTasks.map(task => (
                                        <TaskRow
                                            key={task.id}
                                            task={task}
                                            empName={getEmpName(task.salesmanId)}
                                            onToggle={() => toggleTask(task.id, task.status)}
                                            onEdit={() => setModalTask(task)}
                                            onDelete={() => handleDelete(task.id)}
                                        />
                                    ))}
                                </div>
                            </>)}

                            {(filter === 'ALL' || filter === 'DONE') && doneTasks.length > 0 && (
                                <div>
                                    <button
                                        onClick={() => setShowDone(p => !p)}
                                        className="w-full px-5 py-2.5 flex items-center gap-2 bg-green-500/5 border-t border-green-500/20 hover:bg-green-500/10 transition-colors"
                                    >
                                        <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
                                        <span className="text-green-400 text-xs font-semibold flex-1 text-left">
                                            Completed ({done})
                                        </span>
                                        {showDone ? <ChevronUp className="w-3.5 h-3.5 text-green-400" /> : <ChevronDown className="w-3.5 h-3.5 text-green-400" />}
                                        {done > 0 && (
                                            <span
                                                className="text-[10px] text-red-400/60 hover:text-red-400 transition-colors ml-2"
                                                onClick={e => { e.stopPropagation(); clearDone(); }}
                                            >
                                                Clear All
                                            </span>
                                        )}
                                    </button>
                                    {showDone && (
                                        <div className="divide-y divide-dark-border/20">
                                            {doneTasks.map(task => (
                                                <TaskRow
                                                    key={task.id}
                                                    task={task}
                                                    empName={getEmpName(task.salesmanId)}
                                                    onToggle={() => toggleTask(task.id, task.status)}
                                                    onEdit={() => setModalTask(task)}
                                                    onDelete={() => handleDelete(task.id)}
                                                />
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="px-5 py-3 border-t border-dark-border/50">
                            <button
                                onClick={() => setModalTask({})}
                                className="w-full flex items-center justify-center gap-2 py-2 rounded-xl border border-dashed border-dark-border text-dark-muted hover:text-white hover:border-orange-500/40 transition-all text-xs font-medium"
                            >
                                <Plus className="w-3.5 h-3.5" /> Add New Task
                            </button>
                        </div>
                    </div>
                </div>

                {/* Task Modal */}
                {modalTask !== false && (
                    <TaskModal
                        task={modalTask || null}
                        salesEmployees={salesEmployees.map(e => ({ id: e.id, name: e.name }))}
                        onSave={saveTask}
                        onClose={() => setModalTask(false)}
                    />
                )}

                {/* Delete Confirm */}
                {pendingDelete && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setPendingDelete(null)} />
                        <div className="relative glass rounded-2xl border border-red-500/30 p-6 w-full max-w-xs shadow-2xl text-center space-y-4">
                            <div className="w-12 h-12 rounded-full bg-red-500/15 flex items-center justify-center mx-auto">
                                <Trash2 className="w-6 h-6 text-red-400" />
                            </div>
                            <p className="text-white font-semibold">Task delete karein?</p>
                            <p className="text-dark-muted text-xs">{tasks.find(t => t.id === pendingDelete)?.title}</p>
                            <div className="flex gap-3">
                                <button onClick={() => setPendingDelete(null)} className="flex-1 py-2 rounded-xl border border-dark-border text-dark-muted hover:text-white text-sm transition-colors">Cancel</button>
                                <button onClick={confirmDelete} className="flex-1 py-2 rounded-xl bg-red-500 hover:bg-red-400 text-white text-sm font-semibold transition-colors">Delete</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Clear Done Confirm */}
                {pendingClearDone && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setPendingClearDone(false)} />
                        <div className="relative glass rounded-2xl border border-orange-500/30 p-6 w-full max-w-xs shadow-2xl text-center space-y-4">
                            <div className="w-12 h-12 rounded-full bg-orange-500/15 flex items-center justify-center mx-auto">
                                <CheckCircle2 className="w-6 h-6 text-orange-400" />
                            </div>
                            <p className="text-white font-semibold">{done} completed tasks hatao?</p>
                            <p className="text-dark-muted text-xs">Yeh action undo nahi hoga.</p>
                            <div className="flex gap-3">
                                <button onClick={() => setPendingClearDone(false)} className="flex-1 py-2 rounded-xl border border-dark-border text-dark-muted hover:text-white text-sm transition-colors">Cancel</button>
                                <button onClick={confirmClearDone} className="flex-1 py-2 rounded-xl bg-orange-500 hover:bg-orange-400 text-white text-sm font-semibold transition-colors">Clear All</button>
                            </div>
                        </div>
                    </div>
                )}
            </>)}
        </div>
    );
};
