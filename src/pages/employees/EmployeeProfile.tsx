import { useParams, useNavigate } from 'react-router-dom';
import { useEmployeeStore } from '@/store/employeeStore';
import { useAuthStore } from '@/store/authStore';
import { PERMISSIONS } from '@/config/permissions';
import {
    ArrowLeft,
    MapPin,
    Mail,
    Phone,
    Calendar,
    CreditCard,
    Briefcase,
    Shield,
    Clock
} from 'lucide-react';

export const EmployeeProfile = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { getEmployeeById } = useEmployeeStore();
    const { hasPermission, user } = useAuthStore();

    const employee = getEmployeeById(id || '');

    if (!employee) {
        return (
            <div className="text-center py-20">
                <h2 className="text-xl text-white">Employee not found</h2>
                <button onClick={() => navigate('/employees')} className="mt-4 text-primary-500">Go Back</button>
            </div>
        );
    }

    // PRIVACY CHECK: Who can see sensitive financial data?
    const canViewFinancials = hasPermission(PERMISSIONS.VIEW_EMPLOYEE_FINANCIALS) || user?.role === 'SUPER_ADMIN';

    return (
        <div className="max-w-5xl mx-auto">
            <button
                onClick={() => navigate(-1)}
                className="flex items-center gap-2 text-dark-muted hover:text-white mb-6 transition-colors"
            >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to List</span>
            </button>

            {/* Header Banner */}
            <div className="glass rounded-2xl p-8 mb-6 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-r from-primary-900/50 to-purple-900/50" />

                <div className="relative flex flex-col md:flex-row gap-6 items-end">
                    <div className="w-24 h-24 md:w-32 md:h-32 rounded-2xl bg-dark-bg p-1 shadow-2xl">
                        <img
                            src={employee.avatar}
                            alt={employee.name}
                            className="w-full h-full rounded-xl object-cover"
                        />
                    </div>

                    <div className="flex-1 mb-2">
                        <h1 className="text-3xl font-bold text-white mb-1">{employee.name}</h1>
                        <div className="flex flex-wrap gap-4 text-sm text-dark-muted">
                            <span className="flex items-center gap-1">
                                <Briefcase className="w-4 h-4" />
                                {employee.designation}
                            </span>
                            <span className="flex items-center gap-1">
                                <Shield className="w-4 h-4" />
                                {employee.department}
                            </span>
                            <span className="flex items-center gap-1">
                                <MapPin className="w-4 h-4" />
                                {employee.code}
                            </span>
                        </div>
                    </div>

                    <div className="flex gap-3 mb-2">
                        <span className={`px-3 py-1 rounded-full text-sm font-medium border ${employee.status === 'ACTIVE'
                            ? 'bg-success/10 text-success border-success/20'
                            : 'bg-danger/10 text-danger border-danger/20'
                            }`}>
                            {employee.status}
                        </span>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Contact Info */}
                <div className="glass p-6 rounded-2xl space-y-6">
                    <h3 className="text-lg font-semibold text-white border-b border-dark-border/50 pb-3">Contact Details</h3>

                    <div className="space-y-4">
                        <div className="flex items-center gap-3 text-dark-muted">
                            <Mail className="w-5 h-5 text-primary-500" />
                            <div>
                                <p className="text-xs">Email Address</p>
                                <p className="text-white text-sm">{employee.email}</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 text-dark-muted">
                            <Phone className="w-5 h-5 text-primary-500" />
                            <div>
                                <p className="text-xs">Phone Number</p>
                                <p className="text-white text-sm">{employee.phone}</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 text-dark-muted">
                            <Calendar className="w-5 h-5 text-primary-500" />
                            <div>
                                <p className="text-xs">Joining Date</p>
                                <p className="text-white text-sm">{employee.joiningDate}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Work Info */}
                <div className="glass p-6 rounded-2xl space-y-6">
                    <h3 className="text-lg font-semibold text-white border-b border-dark-border/50 pb-3">Work Information</h3>

                    <div className="space-y-4">
                        <div>
                            <p className="text-xs text-dark-muted mb-1">Shift Schedule</p>
                            <div className="flex items-center gap-2 p-2 rounded-lg bg-dark-bg/50 border border-dark-border">
                                <Clock className="w-4 h-4 text-warning" />
                                <span className="text-white font-medium">{employee.shift} Shift</span>
                            </div>
                        </div>

                        <div>
                            <p className="text-xs text-dark-muted mb-1">Salary Type</p>
                            <p className="text-white text-sm capitalize">{employee.salaryType.toLowerCase()}</p>
                        </div>

                        <div>
                            <p className="text-xs text-dark-muted mb-1">System Role</p>
                            <p className="text-white text-sm font-mono">{employee.role}</p>
                        </div>
                    </div>
                </div>

                {/* Financial Info (PROTECTED) */}
                <div className="glass p-6 rounded-2xl space-y-6 relative overflow-hidden">
                    <h3 className="text-lg font-semibold text-white border-b border-dark-border/50 pb-3">Financials</h3>

                    {!canViewFinancials ? (
                        <div className="absolute inset-0 bg-dark-card/80 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center z-10">
                            <Shield className="w-12 h-12 text-dark-muted mb-3" />
                            <h4 className="text-white font-medium">Access Restricted</h4>
                            <p className="text-xs text-dark-muted mt-1">You do not have permission to view sensitive financial data.</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div>
                                <p className="text-xs text-dark-muted mb-1">Basic Salary</p>
                                <p className="text-2xl font-bold text-success">
                                    {hasPermission(PERMISSIONS.VIEW_EMPLOYEE_SALARY) || user?.role === 'SUPER_ADMIN'
                                        ? `₹${employee.basicSalary.toLocaleString()}`
                                        : '₹****'}
                                </p>
                            </div>

                            {employee.bankDetails ? (
                                hasPermission(PERMISSIONS.VIEW_EMPLOYEE_BANK) || user?.role === 'SUPER_ADMIN' ? (
                                    <div className="p-3 bg-dark-bg/50 rounded-xl border border-dark-border">
                                        <div className="flex items-center gap-2 mb-2 text-primary-400">
                                            <CreditCard className="w-4 h-4" />
                                            <span className="text-xs font-bold tracking-wider">BANK DETAILS</span>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-xs text-dark-muted">Bank Name</p>
                                            <p className="text-sm text-white font-medium">{employee.bankDetails.bankName}</p>

                                            <p className="text-xs text-dark-muted mt-2">Account Number</p>
                                            <p className="text-sm text-white font-mono tracking-wider">
                                                •••• {employee.bankDetails.accountNumber.slice(-4)}
                                            </p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="p-3 bg-dark-bg/50 rounded-xl border border-dark-border flex items-center justify-between">
                                        <div className="flex items-center gap-2 text-dark-muted">
                                            <Shield className="w-4 h-4" />
                                            <span className="text-xs font-bold tracking-wider">BANK DETAILS HIDDEN</span>
                                        </div>
                                    </div>
                                )
                            ) : (
                                <p className="text-sm text-dark-muted italic">No bank details attached.</p>
                            )}
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
};
