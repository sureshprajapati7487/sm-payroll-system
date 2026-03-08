import { useState, useMemo } from 'react';
import { Building2, ChevronDown, Plus, TrendingUp, Users, DollarSign, Edit, Trash2, X, Save, Info } from 'lucide-react';
import { useMultiCompanyStore, Company } from '@/store/multiCompanyStore';
import { useEmployeeStore } from '@/store/employeeStore';
import { usePayrollStore } from '@/store/payrollStore';
import { AnimatedCounter } from '@/components/AnimatedCounter';
import { useDialog } from '@/components/DialogProvider';

export const CompanySwitcher = () => {
    const { companies, currentCompanyId, switchCompany, getActiveCompanies, getCurrentCompany, addCompany, updateCompany, deleteCompany } = useMultiCompanyStore();
    const [isOpen, setIsOpen] = useState(false);
    const currentCompany = getCurrentCompany();
    const activeCompanies = getActiveCompanies();
    const { confirm, toast } = useDialog();

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [formData, setFormData] = useState<Partial<Company>>({
        name: '', code: '', address: '', gstNumber: '', panNumber: '', isActive: true
    });
    // Admin Creation State
    const [createAdmin, setCreateAdmin] = useState(true);
    const [adminData, setAdminData] = useState({ name: '', loginId: '', password: '' });
    const [isSaving, setIsSaving] = useState(false);

    const handleSwitch = (companyId: string) => {
        if (companyId === currentCompanyId) {
            setIsOpen(false);
            return;
        }

        // --- PREVENT DATA BLEED ---
        // Zustand `persist` stores tenant data in localStorage. 
        // We must wipe this before reloading so the new company starts fresh.
        const TENANT_STORES = [
            'loan-storage',
            'client-store',
            'audit-storage',
            'payroll-version-storage',
            'sm-payroll-workflows',
            'custom-field-store',
            'draft-storage',
            'notification-storage',
            'security-alerts-storage',
            'system-config-storage',
            'role-permissions-storage'
        ];

        TENANT_STORES.forEach(storeKey => {
            localStorage.removeItem(storeKey);
        });

        switchCompany(companyId);
        setIsOpen(false);
        window.location.reload();
    };

    const handleOpenAdd = () => {
        setEditingId(null);
        setFormData({ name: '', code: '', address: '', gstNumber: '', panNumber: '', isActive: true });
        setCreateAdmin(true);
        setAdminData({ name: '', loginId: '', password: '' });
        setIsModalOpen(true);
        setIsOpen(false);
    };

    const handleOpenEdit = (c: Company) => {
        setEditingId(c.id);
        setFormData({ ...c });
        setIsModalOpen(true);
    };

    const handleSave = async () => {
        if (!formData.name || !formData.code) return toast('Name and Code are required', 'error');
        if (!editingId && createAdmin) {
            if (!adminData.name || !adminData.loginId || !adminData.password) {
                return toast('Admin Name, Login ID, and Password are required', 'error');
            }
        }
        setIsSaving(true);
        try {
            if (editingId) {
                await updateCompany(editingId, formData);
                toast('Company updated successfully', 'success');
            } else {
                const payload = { ...formData, employeeCount: 0 } as Omit<Company, 'id'> & { admin?: any };
                if (createAdmin) {
                    payload.admin = adminData;
                }
                await addCompany(payload);
                toast('Company and Admin created successfully', 'success');
            }
            setIsModalOpen(false);
        } catch (error) {
            toast('Failed to save company', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id: string, name: string) => {
        const confirmed = await confirm({
            title: 'Delete Company',
            message: `Are you sure you want to delete ${name}? This action cannot be undone.`,
            confirmLabel: 'Delete Company',
            cancelLabel: 'Cancel',
            variant: 'danger'
        });
        if (!confirmed) return;

        const success = await deleteCompany(id);
        if (success) {
            toast('Company deleted successfully', 'success');
            if (id === currentCompanyId) {
                // Wait briefly then reload since context changed drastically
                setTimeout(() => window.location.reload(), 1000);
            }
        } else {
            toast('Failed to delete company', 'error');
        }
    };

    const { employees } = useEmployeeStore();
    const { slips } = usePayrollStore();

    // Real employee count from employeeStore
    const realEmployeeCount = employees.length;

    // Real payroll total from current month slips
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const currentMonthPayroll = useMemo(() =>
        slips.filter(s => s.month === currentMonth).reduce((sum, s) => sum + s.netSalary, 0),
        [slips, currentMonth]
    );

    const consolidatedStats = {
        totalEmployees: realEmployeeCount,
        activeCompanies: activeCompanies.length,
        totalPayroll: currentMonthPayroll > 0 ? currentMonthPayroll : companies.reduce((sum, c) => sum + (c.employeeCount || 0), 0) * 45000
    };

    return (
        <div className="p-6 space-y-6">
            <div>
                <div className="flex items-center justify-between">
                    <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                        <Building2 className="w-8 h-8 text-primary-500" />
                        Multi-Company Management
                    </h1>
                    <button onClick={handleOpenAdd} className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white text-sm font-medium rounded-xl flex items-center gap-2 transition-colors hidden sm:flex">
                        <Plus className="w-4 h-4" />
                        Add Company
                    </button>
                </div>
                <p className="text-dark-muted mt-1">Switch between companies and view consolidated data</p>
            </div>

            {/* Consolidated Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="glass rounded-2xl p-6 animate-scale-in">
                    <div className="flex items-center justify-between mb-4">
                        <div className="p-3 bg-blue-500/20 rounded-xl">
                            <Building2 className="w-6 h-6 text-blue-400" />
                        </div>
                    </div>
                    <div className="text-dark-muted text-sm">Active Companies</div>
                    <div className="text-3xl font-bold text-white mt-1">
                        <AnimatedCounter value={consolidatedStats.activeCompanies} />
                    </div>
                </div>

                <div className="glass rounded-2xl p-6 animate-scale-in" style={{ animationDelay: '0.1s' }}>
                    <div className="flex items-center justify-between mb-4">
                        <div className="p-3 bg-green-500/20 rounded-xl">
                            <Users className="w-6 h-6 text-green-400" />
                        </div>
                    </div>
                    <div className="text-dark-muted text-sm">Total Employees</div>
                    <div className="text-3xl font-bold text-white mt-1">
                        <AnimatedCounter value={consolidatedStats.totalEmployees} />
                    </div>
                </div>

                <div className="glass rounded-2xl p-6 animate-scale-in" style={{ animationDelay: '0.2s' }}>
                    <div className="flex items-center justify-between mb-4">
                        <div className="p-3 bg-purple-500/20 rounded-xl">
                            <DollarSign className="w-6 h-6 text-purple-400" />
                        </div>
                    </div>
                    <div className="text-dark-muted text-sm">Total Payroll (Monthly)</div>
                    <div className="text-3xl font-bold text-white mt-1">
                        <AnimatedCounter
                            value={consolidatedStats.totalPayroll}
                            prefix="₹"
                        />
                    </div>
                </div>
            </div>

            {/* Current Company Selector */}
            <div className="glass rounded-2xl p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Current Company</h3>

                <div className="relative">
                    <button
                        onClick={() => setIsOpen(!isOpen)}
                        className="w-full bg-dark-surface border border-dark-border rounded-xl p-4 flex items-center justify-between hover:bg-white/5 transition-all"
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-lg bg-primary-500/20 flex items-center justify-center">
                                <Building2 className="w-6 h-6 text-primary-400" />
                            </div>
                            <div className="text-left">
                                <div className="text-white font-semibold">{currentCompany?.name}</div>
                                <div className="text-xs text-dark-muted">{currentCompany?.code} • {currentCompany?.employeeCount} Employees</div>
                            </div>
                        </div>
                        <ChevronDown className={`w-5 h-5 text-dark-muted transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {isOpen && (
                        <div className="absolute top-full left-0 right-0 mt-2 bg-dark-card border border-dark-border rounded-xl overflow-hidden z-50 animate-slide-down">
                            {activeCompanies.map(company => (
                                <button
                                    key={company.id}
                                    onClick={() => handleSwitch(company.id)}
                                    className={`w-full p-4 flex items-center gap-3 hover:bg-white/5 transition-all ${company.id === currentCompanyId ? 'bg-primary-500/10' : ''
                                        }`}
                                >
                                    <div className="w-10 h-10 rounded-lg bg-primary-500/20 flex items-center justify-center">
                                        <Building2 className="w-5 h-5 text-primary-400" />
                                    </div>
                                    <div className="flex-1 text-left">
                                        <div className="text-white font-semibold text-sm">{company.name}</div>
                                        <div className="text-xs text-dark-muted">{company.code} • {company.employeeCount} Employees</div>
                                    </div>
                                    {company.id === currentCompanyId && (
                                        <div className="w-2 h-2 bg-green-500 rounded-full" />
                                    )}
                                </button>
                            ))}

                            <button onClick={handleOpenAdd} className="w-full p-4 flex items-center gap-3 hover:bg-white/5 transition-all border-t border-dark-border">
                                <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                                    <Plus className="w-5 h-5 text-green-400" />
                                </div>
                                <div className="text-left">
                                    <div className="text-white font-semibold text-sm">Add New Company</div>
                                    <div className="text-xs text-dark-muted">Set up a new entity</div>
                                </div>
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* All Companies List */}
            <div className="glass rounded-2xl overflow-hidden">
                <div className="p-6 border-b border-dark-border flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-white">All Companies</h3>
                    <button onClick={handleOpenAdd} className="px-4 py-2 bg-primary-500/20 text-primary-400 hover:bg-primary-500/30 text-sm font-medium rounded-xl flex items-center gap-2 transition-colors border border-primary-500/30">
                        <Plus className="w-4 h-4" />
                        Add Company
                    </button>
                </div>

                <div className="divide-y divide-dark-border">
                    {companies.map(company => (
                        <div key={company.id} className="p-6 hover:bg-white/5 transition-all">
                            <div className="flex items-start justify-between">
                                <div className="flex items-start gap-4 flex-1">
                                    <div className="w-12 h-12 rounded-lg bg-primary-500/20 flex items-center justify-center flex-shrink-0">
                                        <Building2 className="w-6 h-6 text-primary-400" />
                                    </div>

                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-2">
                                            <h4 className="text-white font-semibold">{company.name}</h4>
                                            <span className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-xs">
                                                {company.code}
                                            </span>
                                            {company.id === currentCompanyId && (
                                                <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs">
                                                    Current
                                                </span>
                                            )}
                                        </div>

                                        <div className="text-sm text-dark-muted space-y-1">
                                            <div>{company.address}</div>
                                            {company.gstNumber && <div>GST: {company.gstNumber}</div>}
                                            {company.panNumber && <div>PAN: {company.panNumber}</div>}
                                        </div>
                                    </div>
                                </div>

                                <div className="text-right">
                                    <div className="flex items-center gap-2 text-primary-400 mb-2">
                                        <Users className="w-4 h-4" />
                                        <span className="text-white font-semibold">{company.employeeCount}</span>
                                    </div>
                                    <div className="text-xs text-dark-muted mb-3">Employees</div>

                                    <div className="flex items-center justify-end gap-2 isolate pt-2 border-t border-dark-border/50">
                                        <button onClick={(e) => { e.stopPropagation(); handleOpenEdit(company); }} className="p-1.5 hover:bg-white/10 rounded-lg text-dark-muted hover:text-white transition-colors" title="Edit Company">
                                            <Edit className="w-4 h-4" />
                                        </button>
                                        <button onClick={(e) => { e.stopPropagation(); handleDelete(company.id, company.name); }} className="p-1.5 hover:bg-red-500/20 rounded-lg text-dark-muted hover:text-red-400 transition-colors" title="Delete Company">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Consolidated HR View */}
            <div className="glass rounded-2xl p-6">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-primary-400" />
                    Consolidated HR Insights
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 bg-dark-surface rounded-xl">
                        <div className="text-dark-muted text-sm mb-2">Average Salary</div>
                        <div className="text-2xl font-bold text-white">₹42,500</div>
                        <div className="text-xs text-green-400 mt-1">+5% vs last quarter</div>
                    </div>

                    <div className="p-4 bg-dark-surface rounded-xl">
                        <div className="text-dark-muted text-sm mb-2">Attrition Rate</div>
                        <div className="text-2xl font-bold text-white">8.5%</div>
                        <div className="text-xs text-green-400 mt-1">-2.3% improvement</div>
                    </div>

                    <div className="p-4 bg-dark-surface rounded-xl">
                        <div className="text-dark-muted text-sm mb-2">Open Positions</div>
                        <div className="text-2xl font-bold text-white">12</div>
                        <div className="text-xs text-dark-muted mt-1">Across all companies</div>
                    </div>

                    <div className="p-4 bg-dark-surface rounded-xl">
                        <div className="text-dark-muted text-sm mb-2">Total Attendance</div>
                        <div className="text-2xl font-bold text-white">94.2%</div>
                        <div className="text-xs text-green-400 mt-1">Above target</div>
                    </div>
                </div>
            </div>

            {/* Add/Edit Company Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-dark-card border border-dark-border rounded-2xl w-full max-w-xl shadow-2xl flex flex-col max-h-[90vh]">
                        <div className="flex items-center justify-between p-6 border-b border-dark-border">
                            <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                <Building2 className="w-5 h-5 text-primary-400" />
                                {editingId ? 'Edit Company' : 'Add New Company'}
                            </h2>
                            <button onClick={() => setIsModalOpen(false)} className="p-2 text-dark-muted hover:text-white rounded-lg hover:bg-white/5 transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs text-dark-muted uppercase block mb-1">Company Name *</label>
                                    <input autoFocus value={formData.name || ''} onChange={e => setFormData(p => ({ ...p, name: e.target.value }))} className="w-full bg-dark-bg border border-dark-border rounded-xl px-4 py-2 text-white focus:border-primary-500 transition-colors" placeholder="e.g. Acme Corp" />
                                </div>
                                <div>
                                    <label className="text-xs text-dark-muted uppercase block mb-1">Short Code *</label>
                                    <input value={formData.code || ''} onChange={e => setFormData(p => ({ ...p, code: e.target.value }))} className="w-full bg-dark-bg border border-dark-border rounded-xl px-4 py-2 text-white focus:border-primary-500 transition-colors uppercase" placeholder="e.g. ACME" />
                                </div>
                            </div>
                            <div>
                                <label className="text-xs text-dark-muted uppercase block mb-1">Address</label>
                                <textarea value={formData.address || ''} onChange={e => setFormData(p => ({ ...p, address: e.target.value }))} rows={2} className="w-full bg-dark-bg border border-dark-border rounded-xl px-4 py-2 text-white focus:border-primary-500 transition-colors resize-none" placeholder="Full registered address" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs text-dark-muted uppercase block mb-1">GST Number</label>
                                    <input value={formData.gstNumber || ''} onChange={e => setFormData(p => ({ ...p, gstNumber: e.target.value }))} className="w-full bg-dark-bg border border-dark-border rounded-xl px-4 py-2 text-white focus:border-primary-500 transition-colors uppercase" placeholder="22AAAAA0000A1Z5" />
                                </div>
                                <div>
                                    <label className="text-xs text-dark-muted uppercase block mb-1">PAN Number</label>
                                    <input value={formData.panNumber || ''} onChange={e => setFormData(p => ({ ...p, panNumber: e.target.value }))} className="w-full bg-dark-bg border border-dark-border rounded-xl px-4 py-2 text-white focus:border-primary-500 transition-colors uppercase" placeholder="AAAAA0000A" />
                                </div>
                            </div>
                            <div className="flex items-center justify-between p-4 bg-dark-bg rounded-xl border border-dark-border">
                                <div>
                                    <p className="text-white font-medium text-sm">Active Status</p>
                                    <p className="text-xs text-dark-muted">Inactive companies won't appear in main selectors</p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" checked={formData.isActive !== false} onChange={e => setFormData(p => ({ ...p, isActive: e.target.checked }))} className="sr-only peer" />
                                    <div className="w-11 h-6 bg-dark-surface peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-500"></div>
                                </label>
                            </div>

                            {!editingId && (
                                <>
                                    <div className="flex items-center justify-between p-4 bg-dark-surface rounded-xl border border-dark-border mt-4">
                                        <div>
                                            <p className="text-white font-medium text-sm">Create Admin User</p>
                                            <p className="text-xs text-dark-muted">Automatically create a primary admin account</p>
                                        </div>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input type="checkbox" checked={createAdmin} onChange={e => setCreateAdmin(e.target.checked)} className="sr-only peer" />
                                            <div className="w-11 h-6 bg-dark-bg peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500"></div>
                                        </label>
                                    </div>

                                    {createAdmin && (
                                        <div className="p-4 rounded-xl border border-blue-500/30 bg-blue-500/5 space-y-4">
                                            <div>
                                                <label className="text-xs text-blue-300 uppercase block mb-1">Admin Name *</label>
                                                <input value={adminData.name} onChange={e => setAdminData(p => ({ ...p, name: e.target.value }))} className="w-full bg-dark-bg border border-dark-border rounded-xl px-4 py-2 text-white focus:border-blue-500 transition-colors" placeholder="e.g. John Doe" />
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="text-xs text-blue-300 uppercase block mb-1">Login ID *</label>
                                                    <input value={adminData.loginId} onChange={e => setAdminData(p => ({ ...p, loginId: e.target.value }))} className="w-full bg-dark-bg border border-dark-border rounded-xl px-4 py-2 text-white focus:border-blue-500 transition-colors" placeholder="e.g. ADMIN_USER" />
                                                </div>
                                                <div>
                                                    <label className="text-xs text-blue-300 uppercase block mb-1">Password *</label>
                                                    <input type="password" value={adminData.password} onChange={e => setAdminData(p => ({ ...p, password: e.target.value }))} className="w-full bg-dark-bg border border-dark-border rounded-xl px-4 py-2 text-white focus:border-blue-500 transition-colors" placeholder="Admin password" />
                                                </div>
                                            </div>
                                            <p className="text-xs text-dark-muted flex gap-2"><Info className="w-4 h-4 shrink-0" /> Employee code will automatically be set to this Login ID.</p>
                                        </div>
                                    )}
                                </>
                            )}

                        </div>
                        <div className="p-6 border-t border-dark-border bg-dark-surface flex justify-end gap-3 rounded-b-2xl">
                            <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-dark-muted hover:text-white font-medium transition-colors">
                                Cancel
                            </button>
                            <button onClick={handleSave} disabled={isSaving || !formData.name || !formData.code} className="px-5 py-2 bg-primary-500 hover:bg-primary-600 disabled:opacity-50 text-white font-medium rounded-xl flex items-center gap-2 transition-colors">
                                <Save className="w-4 h-4" />
                                {isSaving ? 'Saving...' : 'Save Company'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
