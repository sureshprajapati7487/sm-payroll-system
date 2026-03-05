import { useState, useMemo } from 'react';
import { Building2, ChevronDown, Plus, TrendingUp, Users, DollarSign } from 'lucide-react';
import { useMultiCompanyStore } from '@/store/multiCompanyStore';
import { useEmployeeStore } from '@/store/employeeStore';
import { usePayrollStore } from '@/store/payrollStore';
import { AnimatedCounter } from '@/components/AnimatedCounter';

export const CompanySwitcher = () => {
    const { companies, currentCompanyId, switchCompany, getActiveCompanies, getCurrentCompany } = useMultiCompanyStore();
    const [isOpen, setIsOpen] = useState(false);
    const currentCompany = getCurrentCompany();
    const activeCompanies = getActiveCompanies();

    const handleSwitch = (companyId: string) => {
        switchCompany(companyId);
        setIsOpen(false);
        // In real implementation, this would trigger data reload
        window.location.reload();
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
                <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                    <Building2 className="w-8 h-8 text-primary-500" />
                    Multi-Company Management
                </h1>
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

                            <button className="w-full p-4 flex items-center gap-3 hover:bg-white/5 transition-all border-t border-dark-border">
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
                <div className="p-6 border-b border-dark-border">
                    <h3 className="text-lg font-semibold text-white">All Companies</h3>
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
                                    <div className="text-xs text-dark-muted">Employees</div>
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
        </div>
    );
};
