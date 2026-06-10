import { useParams, useNavigate } from 'react-router-dom';
import { useState, useRef } from 'react';
import { useEmployeeStore } from '@/store/employeeStore';
import { useAuthStore } from '@/store/authStore';
import { PERMISSIONS } from '@/config/permissions';
import { useDataMask } from '@/hooks/useDataMask';
import { useAttendanceStore } from '@/store/attendanceStore';
import { useLeaveStore } from '@/store/leaveStore';
import { useLoanStore } from '@/store/loanStore';
import { usePayrollStore } from '@/store/payrollStore';
import { MaskedField } from '@/components/MaskedField';
import {
    ArrowLeft,
    MapPin,
    Mail,
    Phone,
    Calendar,
    CreditCard,
    Briefcase,
    Shield,
    Clock,
    CalendarCheck,
    FileText,
    Wallet,
    Receipt,
    Upload,
    Download,
    Paperclip,
} from 'lucide-react';
import { apiFetch } from '@/lib/apiClient';

export const EmployeeProfile = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { getEmployeeById } = useEmployeeStore();
    const { hasPermission } = useAuthStore();
    const { maskSalary, maskAccount, maskAadhaar, maskPAN, maskIFSC,
        canViewBank, canViewFullBank, canViewSalary } = useDataMask();

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
    const canViewFinancials = hasPermission(PERMISSIONS.VIEW_EMPLOYEE_FINANCIALS);

    // ─────────────────────────────────────────────────────────────
    // History & Dashboard Data Hooks
    // ─────────────────────────────────────────────────────────────
    const { records } = useAttendanceStore();
    const { requests } = useLeaveStore();
    const { loans } = useLoanStore();
    const { slips } = usePayrollStore();

    // 1. Attendance Data (Current Month)
    const today = new Date();
    const currentMonthPrefix = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    const myRecords = records.filter(r => r.employeeId === id && r.date.startsWith(currentMonthPrefix));
    const presCount = myRecords.filter(r => r.status === 'PRESENT').length;
    const absCount = myRecords.filter(r => r.status === 'ABSENT').length;
    const lateCount = myRecords.filter(r => r.status === 'LATE').length;

    // 2. Leave Data
    const myLeaves = requests.filter(r => r.employeeId === id);
    const approvedLeaves = myLeaves.filter(r => r.status === 'APPROVED').length;

    // 3. Loan Data
    const myLoans = loans.filter(l => l.employeeId === id && l.status === 'ACTIVE');
    const activeLoanBalance = myLoans.reduce((sum, l) => sum + l.balance, 0);

    // 4. Payroll Data
    const mySlips = slips.filter(s => s.employeeId === id);
    const lastSlip = mySlips.length > 0 ? mySlips[mySlips.length - 1] : null;

    // 5. Documents
    const fileRef = useRef<HTMLInputElement>(null);
    const [docs, setDocs] = useState<any[]>([]);
    const [docsLoaded, setDocsLoaded] = useState(false);
    const [docUploading, setDocUploading] = useState(false);
    const [docToast, setDocToast] = useState<string | null>(null);

    const loadDocs = async () => {
        try {
            const res = await apiFetch(`/employees/${id}/documents`);
            if (res.ok) setDocs(await res.json());
        } catch { /* docs list is optional — profile still usable without it */ }
        setDocsLoaded(true);
    };

    const handleDocUpload = async (file: File) => {
        const fd = new FormData();
        fd.append('file', file);
        setDocUploading(true);
        try {
            const res = await apiFetch(`/employees/${id}/documents`, {
                method: 'POST',
                body: fd,
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Upload failed');
            setDocs(prev => [...prev, data]);
            setDocToast('Uploaded successfully');
        } catch (e: any) { setDocToast(e.message); }
        setDocUploading(false);
        setTimeout(() => setDocToast(null), 3000);
    };

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
                                    <MaskedField
                                        value={maskSalary(employee.basicSalary)}
                                        isMasked={!canViewSalary}
                                        tooltip="Requires VIEW_EMPLOYEE_SALARY permission"
                                    />
                                </p>
                            </div>

                            {employee.bankDetails ? (
                                <div className="p-3 bg-dark-bg/50 rounded-xl border border-dark-border">
                                    <div className="flex items-center gap-2 mb-2 text-primary-400">
                                        <CreditCard className="w-4 h-4" />
                                        <span className="text-xs font-bold tracking-wider">BANK & GOVT DETAILS</span>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-xs text-dark-muted">Bank Name</p>
                                        <p className="text-sm text-white font-medium">{employee.bankDetails.bankName}</p>

                                        <p className="text-xs text-dark-muted mt-2">Account Number</p>
                                        <p className="text-sm text-white font-mono tracking-wider">
                                            <MaskedField
                                                value={maskAccount(employee.bankDetails.accountNumber)}
                                                isMasked={!canViewBank}
                                                tooltip="Requires VIEW_EMPLOYEE_BANK permission"
                                            />
                                        </p>

                                        <p className="text-xs text-dark-muted mt-2">IFSC Code</p>
                                        <p className="text-sm text-white font-mono tracking-wider">
                                            <MaskedField
                                                value={maskIFSC(employee.bankDetails.ifscCode)}
                                                isMasked={!canViewBank}
                                                tooltip="Requires VIEW_EMPLOYEE_BANK permission"
                                            />
                                        </p>

                                        <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-dark-border/50">
                                            <div>
                                                <p className="text-xs text-dark-muted">Aadhaar Number</p>
                                                <p className="text-sm text-white font-mono tracking-wider mt-1">
                                                    <MaskedField
                                                        value={maskAadhaar(employee.bankDetails.aadharNumber)}
                                                        isMasked={!canViewFullBank}
                                                        tooltip="Requires VIEW_FULL_BANK_DETAILS permission"
                                                    />
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-dark-muted">PAN Number</p>
                                                <p className="text-sm text-white font-mono tracking-wider mt-1">
                                                    <MaskedField
                                                        value={maskPAN(employee.bankDetails.panCard)}
                                                        isMasked={!canViewFullBank}
                                                        tooltip="Requires VIEW_FULL_BANK_DETAILS permission"
                                                    />
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <p className="text-sm text-dark-muted italic">No bank details attached.</p>
                            )}
                        </div>
                    )}
                </div>

            </div>

            {/* 360-Degree History Dashboard */}
            <div className="mt-10 mb-20">
                <h3 className="text-xl font-bold text-white mb-6 border-b border-dark-border/50 pb-3">History & Overview</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {/* Attendance Card */}
                    <div className="glass p-6 rounded-2xl border border-dark-border flex flex-col hover:border-emerald-500/50 transition-colors">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 rounded-lg bg-emerald-500/10">
                                <CalendarCheck className="w-5 h-5 text-emerald-500" />
                            </div>
                            <h4 className="text-white font-medium">This Month</h4>
                        </div>
                        <div className="flex-1">
                            <p className="text-sm text-dark-muted mb-2">
                                <span className={presCount > 0 ? "text-emerald-400 font-bold" : ""}>{presCount}</span> Present
                            </p>
                            <p className="text-sm text-dark-muted mb-2">{absCount} Absent</p>
                            <p className="text-sm text-dark-muted mb-4">{lateCount} Late</p>
                        </div>
                        <button onClick={() => navigate('/attendance')} className="text-xs text-primary-500 hover:text-primary-400 font-medium text-left mt-auto">View Attendance →</button>
                    </div>

                    {/* Leaves Card */}
                    <div className="glass p-6 rounded-2xl border border-dark-border flex flex-col hover:border-blue-500/50 transition-colors">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 rounded-lg bg-blue-500/10">
                                <FileText className="w-5 h-5 text-blue-500" />
                            </div>
                            <h4 className="text-white font-medium">Leave History</h4>
                        </div>
                        <div className="flex-1">
                            <p className="text-2xl font-bold text-white mb-1">{myLeaves.length}</p>
                            <p className="text-xs text-dark-muted uppercase tracking-wider mb-2">Total Requests</p>
                            <span className="inline-block px-2 py-1 rounded border border-dark-border bg-dark-bg/50 text-xs text-dark-muted">
                                {approvedLeaves} Approved
                            </span>
                        </div>
                        <button onClick={() => navigate('/leaves')} className="text-xs text-primary-500 hover:text-primary-400 font-medium text-left mt-auto pt-4">Manage Leaves →</button>
                    </div>

                    {/* Loans Card */}
                    <div className="glass p-6 rounded-2xl border border-dark-border flex flex-col hover:border-warning/50 transition-colors">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 rounded-lg bg-warning/10">
                                <Wallet className="w-5 h-5 text-warning" />
                            </div>
                            <h4 className="text-white font-medium">Loans & Advances</h4>
                        </div>
                        <div className="flex-1">
                            {activeLoanBalance > 0 ? (
                                <>
                                    <p className="text-2xl font-bold text-warning mb-1">₹{activeLoanBalance.toLocaleString()}</p>
                                    <p className="text-xs text-dark-muted uppercase tracking-wider">Outstanding Balance</p>
                                    <p className="text-xs text-dark-muted mt-2">{myLoans.length} Active Loans</p>
                                </>
                            ) : (
                                <div className="h-full flex items-center justify-start">
                                    <p className="text-sm text-dark-muted italic">No active loans</p>
                                </div>
                            )}
                        </div>
                        <button onClick={() => navigate('/loans')} className="text-xs text-primary-500 hover:text-primary-400 font-medium text-left mt-auto pt-4">View Loans →</button>
                    </div>

                    {/* Payroll Card */}
                    <div className="glass p-6 rounded-2xl border border-dark-border flex flex-col hover:border-purple-500/50 transition-colors">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 rounded-lg bg-purple-500/10">
                                <Receipt className="w-5 h-5 text-purple-500" />
                            </div>
                            <h4 className="text-white font-medium">Recent Salary</h4>
                        </div>
                        <div className="flex-1">
                            <p className="text-2xl font-bold text-white mb-1">{mySlips.length}</p>
                            <p className="text-xs text-dark-muted uppercase tracking-wider mb-3">Total Slips Generated</p>
                            {lastSlip && (
                                <p className="text-xs text-dark-muted inline-block px-2 py-1 rounded border border-dark-border bg-dark-bg/50">
                                    Last: <span className="text-white">{lastSlip.month}</span>
                                </p>
                            )}
                        </div>
                        <button onClick={() => navigate('/payroll')} className="text-xs text-primary-500 hover:text-primary-400 font-medium text-left mt-auto pt-4">View Salary Slips →</button>
                    </div>
                </div>
            </div>

            {/* P2-04: Documents Section */}
            <div className="mt-6 mb-10">
                <div className="glass rounded-2xl p-6">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <Paperclip className="w-5 h-5 text-primary-400" />
                            <h3 className="font-semibold text-dark-text">Documents</h3>
                        </div>
                        <div className="flex gap-2">
                            {!docsLoaded && (
                                <button onClick={loadDocs} className="text-xs text-primary-400 hover:text-primary-300 transition-colors">
                                    Load Documents
                                </button>
                            )}
                            <button onClick={() => fileRef.current?.click()} disabled={docUploading}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-primary-600 hover:bg-primary-500 text-white rounded-lg transition-colors disabled:opacity-60">
                                <Upload className="w-3.5 h-3.5" />
                                {docUploading ? 'Uploading...' : 'Upload'}
                            </button>
                            <input ref={fileRef} type="file" className="hidden"
                                onChange={e => e.target.files?.[0] && handleDocUpload(e.target.files[0])} />
                        </div>
                    </div>
                    {docToast && <p className="text-xs text-primary-400 mb-3">{docToast}</p>}
                    {!docsLoaded ? (
                        <p className="text-sm text-dark-muted">Click "Load Documents" to fetch uploaded files.</p>
                    ) : docs.length === 0 ? (
                        <p className="text-sm text-dark-muted">No documents uploaded yet.</p>
                    ) : (
                        <div className="space-y-2">
                            {docs.map((doc, i) => (
                                <div key={i} className="flex items-center justify-between p-3 bg-dark-bg/50 rounded-lg border border-dark-border">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <FileText className="w-4 h-4 text-primary-400 shrink-0" />
                                        <span className="text-sm text-dark-text truncate">{doc.filename}</span>
                                        <span className="text-xs text-dark-muted shrink-0">{new Date(doc.uploadedAt).toLocaleDateString()}</span>
                                    </div>
                                    <a href={`${API_URL}${doc.url}`} download={doc.filename}
                                        className="flex items-center gap-1 text-xs text-primary-400 hover:text-primary-300 transition-colors shrink-0 ml-2">
                                        <Download className="w-3.5 h-3.5" /> Download
                                    </a>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
