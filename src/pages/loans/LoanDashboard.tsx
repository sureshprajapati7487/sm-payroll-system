import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { useLoanStore } from '@/store/loanStore';
import { useEmployeeStore } from '@/store/employeeStore';
import { useSystemConfigStore } from '@/store/systemConfigStore';
import { PERMISSIONS } from '@/config/permissions';
import { LoanType } from '@/types';
import {
    Banknote,
    Wallet,
    Edit2, // Edit Icon
    Save,
    Utensils, // Food Icon
    Coins, // Cash Icon
    Search,
    BookOpen, // For Ledger/Passbook
    CheckCircle,
    XCircle,
    Trash2,
    AlertTriangle,
    Clock, // Skip Month
    Zap, // Early Settlement
    LayoutGrid,
    List,
    Upload,
    History // History Icon
} from 'lucide-react';
import { clsx } from 'clsx';
// import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { EmployeeSearchableSelect } from '@/components/ui/EmployeeSearchableSelect';
import { generateApprovalMessage } from '@/utils/whatsapp';
import { SkipMonthModal } from '@/components/loans/SkipMonthModal';
import { EarlySettlementModal } from '@/components/loans/EarlySettlementModal';
import { BulkLoanEntryModal } from '@/components/loans/BulkLoanEntryModal';
import { LoanHistoryModal } from '@/components/loans/LoanHistoryModal';
import { LoanTypesModal } from '@/components/loans/LoanTypesModal';
import { InfoTip } from '@/components/ui/InfoTip';
import { useDialog } from '@/components/DialogProvider';

export const LoanDashboard = () => {
    const { user, hasPermission } = useAuthStore();
    const { loans, requestLoan, approveLoan, rejectLoan, updateEMI } = useLoanStore();
    const { employees } = useEmployeeStore();
    const { loanTypes } = useSystemConfigStore();
    const { toast } = useDialog();

    const [searchParams] = useSearchParams();
    const initialSearch = searchParams.get('search') || '';

    const [form, setForm] = useState({
        employeeId: '',
        type: LoanType.PF_LOAN,
        amount: '',
        tenure: '', // Months
        emi: '', // Manual EMI
        reason: '',
        issuedDate: new Date().toISOString().split('T')[0], // Default Today
        approverId: '', // For WhatsApp Flow
        checkingApproverId: '', // New
    });

    const [calcMode, setCalcMode] = useState<'TENURE' | 'EMI'>('TENURE');

    // Validation Error State
    const [errors, setErrors] = useState({
        employeeId: '',
        amount: '',
        tenure: ''
    });

    const [editingLoanId, setEditingLoanId] = useState<string | null>(null);
    const [editEmiValue, setEditEmiValue] = useState<string>('');
    const [searchTerm, setSearchTerm] = useState(initialSearch);
    const [viewLedgerId, setViewLedgerId] = useState<string | null>(null); // For Passbook

    // Ledger Edit/Delete State
    const [deleteTxnId, setDeleteTxnId] = useState<string | null>(null);
    const [deleteStage, setDeleteStage] = useState<0 | 1 | 2 | 3>(0);
    const [viewMode, setViewMode] = useState<'GRID' | 'LIST'>('GRID');
    const [editingTxnId, setEditingTxnId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState({ date: '', amount: '', remarks: '' });

    // Advanced Features State
    const [skipMonthLoanId, setSkipMonthLoanId] = useState<string | null>(null);
    const [settlementLoanId, setSettlementLoanId] = useState<string | null>(null);
    const [showBulkModal, setShowBulkModal] = useState(false);
    const [showHistoryModal, setShowHistoryModal] = useState(false);
    const [showLoanTypesModal, setShowLoanTypesModal] = useState(false);

    const handleDeleteClick = (txnId: string) => {
        setDeleteTxnId(txnId);
        setDeleteStage(1);
    };

    const confirmDelete = () => {
        if (deleteStage < 3) {
            setDeleteStage(prev => (prev + 1) as any);
        } else {
            console.log("DELETING");
            if (viewLedgerId && deleteTxnId) {
                useLoanStore.getState().deleteTransaction(viewLedgerId, deleteTxnId);
                setDeleteTxnId(null);
                setDeleteStage(0);
            }
        }
    };

    const handleEditClick = (txn: any) => { // using any to avoid type import issues if LoanTransaction not imported
        setEditingTxnId(txn.id);
        setEditForm({
            date: txn.date,
            amount: txn.amount.toString(),
            remarks: txn.remarks
        });
    };

    const saveEdit = () => {
        if (viewLedgerId && editingTxnId) {
            useLoanStore.getState().editTransaction(viewLedgerId, editingTxnId, {
                date: editForm.date,
                amount: Number(editForm.amount),
                remarks: editForm.remarks
            });
            setEditingTxnId(null);
        }
    };

    const canManage = hasPermission(PERMISSIONS.MANAGE_LOANS);
    const canApprove = hasPermission(PERMISSIONS.APPROVE_LOANS) || canManage;

    const pendingLoans = loans.filter(l => l.status === 'REQUESTED' || l.status === 'CHECKED');
    const activeLoans = loans.filter(l => l.status === 'ACTIVE' || l.status === 'CLOSED');

    const visibleLoans = activeLoans.filter(l => {
        const canView = canManage || l.employeeId === user?.id;

        // Search Filter (Employee Name)
        const empName = employees.find(e => e.id === l.employeeId)?.name.toLowerCase() || '';
        const searchMatch = empName.includes(searchTerm.toLowerCase());

        return canView && searchMatch;
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        // Clear previous errors
        setErrors({ employeeId: '', amount: '', tenure: '' });

        // Validation
        const newErrors = {
            employeeId: '',
            amount: '',
            tenure: ''
        };

        if (!form.employeeId) {
            newErrors.employeeId = '❌ कृपया Employee का नाम Select करें';
        }

        if (!form.amount || Number(form.amount) <= 0) {
            newErrors.amount = '❌ Amount भरना जरूरी है';
        }

        if (calcMode === 'TENURE' && (!form.tenure || Number(form.tenure) <= 0)) {
            newErrors.tenure = '❌ Months (Tenure) भरना जरूरी है';
        }

        if (calcMode === 'EMI' && (!form.emi || Number(form.emi) <= 0)) {
            newErrors.tenure = '❌ Monthly EMI भरना जरूरी है';
        }

        // If there are errors, show them and return
        if (newErrors.employeeId || newErrors.amount || newErrors.tenure) {
            setErrors(newErrors);
            return;
        }

        const amount = Number(form.amount);
        let tenure = Number(form.tenure);
        let emi = Number(form.emi);

        // ✅ MAX LIMIT VALIDATION
        const limitCheck = useLoanStore.getState().canTakeLoan(form.employeeId, amount);
        if (!limitCheck.allowed) {
            toast(`❌ ${limitCheck.message}`, 'error');
            return;
        }

        // Final Calculation Check
        if (calcMode === 'TENURE') {
            emi = Math.ceil(amount / tenure);
        } else {
            tenure = Math.ceil(amount / emi);
        }

        requestLoan({
            employeeId: form.employeeId,
            type: form.type as LoanType,
            amount,
            tenureMonths: tenure,
            emiAmount: emi,
            reason: form.reason || 'Deduction',
            issuedDate: form.issuedDate,
            approverId: form.approverId,
            checkingApproverId: form.checkingApproverId
        });

        // Reset form and errors
        setForm({
            employeeId: '',
            type: LoanType.PF_LOAN,
            amount: '',
            tenure: '',
            emi: '',
            reason: '',
            issuedDate: new Date().toISOString().split('T')[0],
            approverId: '',
            checkingApproverId: ''
        });
        setErrors({ employeeId: '', amount: '', tenure: '' });
    };

    const handleStartEdit = (loanId: string, currentEmi: number) => {
        setEditingLoanId(loanId);
        setEditEmiValue(currentEmi.toString());
    };

    const handleSaveEdit = (loanId: string) => {
        if (editEmiValue) {
            updateEMI(loanId, Number(editEmiValue));
        }
        setEditingLoanId(null);
    };

    const getTypeIcon = (type: LoanType) => {
        switch (type) {
            case LoanType.FOOD: return <Utensils className="w-5 h-5" />;
            case LoanType.ADVANCE_CASH: return <Coins className="w-5 h-5" />;
            default: return <Wallet className="w-5 h-5" />;
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white mb-1">Deductions & Loans</h1>
                    <p className="text-dark-muted">Manage Loans, Cash Advance, Food, and other recoveries.</p>
                </div>

                {/* Search Bar */}
                <div className="relative w-full md:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-muted" />
                    <input
                        type="text"
                        placeholder="Search employee..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-dark-bg border border-dark-border rounded-lg pl-9 pr-4 py-2 text-sm text-white focus:outline-none focus:border-primary-500"
                    />
                </div>

                <div className="flex bg-dark-bg p-1 rounded-lg border border-dark-border">
                    <button
                        onClick={() => setShowHistoryModal(true)}
                        className="flex items-center gap-2 px-3 py-2 bg-purple-600/20 text-purple-400 hover:bg-purple-600 hover:text-white rounded-md transition-colors mr-2"
                        title="View Complete Loan History"
                    >
                        <History className="w-4 h-4" />
                        <span className="hidden md:inline text-sm font-medium">History</span>
                    </button>
                    {canManage && (
                        <button
                            onClick={() => setShowLoanTypesModal(true)}
                            className="flex items-center gap-2 px-3 py-2 bg-slate-600/20 text-slate-300 hover:bg-slate-600 hover:text-white rounded-md transition-colors mr-2"
                            title="Manage Loan Types"
                        >
                            <Wallet className="w-4 h-4" />
                            <span className="hidden md:inline text-sm font-medium">Types</span>
                        </button>
                    )}
                    {canManage && (
                        <button
                            onClick={() => setShowBulkModal(true)}
                            className="flex items-center gap-2 px-3 py-2 bg-primary-600/20 text-primary-400 hover:bg-primary-600 hover:text-white rounded-md transition-colors mr-2"
                            title="Bulk Loan Entry"
                        >
                            <Upload className="w-4 h-4" />
                            <span className="hidden md:inline text-sm font-medium">Bulk Entry</span>
                        </button>
                    )}
                    <button
                        onClick={() => setViewMode('GRID')}
                        className={clsx("p-2 rounded-md transition-colors", viewMode === 'GRID' ? "bg-primary-500 text-white" : "text-dark-muted hover:text-white")}
                        title="Grid View"
                    >
                        <LayoutGrid className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => setViewMode('LIST')}
                        className={clsx("p-2 rounded-md transition-colors", viewMode === 'LIST' ? "bg-primary-500 text-white" : "text-dark-muted hover:text-white")}
                        title="List View"
                    >
                        <List className="w-4 h-4" />
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Request Form (Visible to All) */}
                {(canManage || user?.role === 'EMPLOYEE') && (
                    <div className="glass p-6 rounded-2xl h-fit">
                        <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                            <Banknote className="w-5 h-5 text-warning" />
                            {canManage ? 'Issue / Approve Loan' : 'Request Advance / Loan'}
                        </h3>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-xs text-dark-muted mb-1">Employee</label>
                                <EmployeeSearchableSelect
                                    employees={employees}
                                    selectedId={form.employeeId}
                                    currentUserId={user?.id || ''}
                                    onSelect={(id) => {
                                        setForm({ ...form, employeeId: id });
                                        setErrors({ ...errors, employeeId: '' });
                                    }}
                                />
                                {errors.employeeId && (
                                    <p className="text-xs text-red-400 mt-1 font-semibold animate-pulse">{errors.employeeId}</p>
                                )}
                            </div>

                            <div>
                                <InfoTip id="loanTypeField" label="Type" />
                                <select
                                    value={form.type}
                                    onChange={e => setForm({ ...form, type: e.target.value as LoanType })}
                                    className="w-full bg-dark-bg border border-dark-border rounded-lg p-2 text-white"
                                >
                                    {loanTypes.map(lt => (
                                        <option key={lt.id} value={lt.key}>
                                            {lt.label}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Approver Selection (Auto-filled but editable by Admin) */}
                            <div>
                                <InfoTip id="loanApprover" label="Approver (WhatsApp)" />
                                <select
                                    value={form.approverId}
                                    onChange={e => setForm({ ...form, approverId: e.target.value })}
                                    className="w-full bg-dark-bg border border-dark-border rounded-lg p-2 text-white"
                                >
                                    <option value="">Select Manager...</option>
                                    {employees.filter(e => e.role === 'ADMIN' || e.role === 'MANAGER' || e.role === 'SUPER_ADMIN' || e.role === 'ACCOUNT_ADMIN').map(mgr => (
                                        <option key={mgr.id} value={mgr.id}>
                                            {mgr.name} ({mgr.role})
                                        </option>
                                    ))}
                                </select>
                                <p className="text-[10px] text-dark-muted mt-1">
                                    {form.approverId ? "Request will be sent to this manager." : "Auto-assigned based on reporting structure."}
                                </p>
                            </div>

                            {/* Checking Approver (New) */}
                            <div>
                                <InfoTip id="loanCheckingApprover" label="Checking Approver" />
                                <select
                                    value={form.checkingApproverId}
                                    onChange={e => setForm({ ...form, checkingApproverId: e.target.value })}
                                    className="w-full bg-dark-bg border border-dark-border rounded-lg p-2 text-white"
                                >
                                    <option value="">Select Checker...</option>
                                    {employees.filter(e => e.role === 'ADMIN' || e.role === 'MANAGER' || e.role === 'SUPER_ADMIN' || e.role === 'ACCOUNT_ADMIN').map(mgr => (
                                        <option key={mgr.id} value={mgr.id}>
                                            {mgr.name} ({mgr.role})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Date Picker (New) */}
                            <div>
                                <InfoTip id="loanIssuedDate" label="Issue / Request Date" />
                                <input
                                    type="date"
                                    value={form.issuedDate}
                                    onChange={e => setForm({ ...form, issuedDate: e.target.value })}
                                    className="w-full bg-dark-bg border border-dark-border rounded-lg p-2 text-white"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <InfoTip id="loanAmount" label="Total Amount (₹)" />
                                    <input
                                        type="number"
                                        value={form.amount}
                                        onChange={e => {
                                            const val = e.target.value;
                                            setErrors({ ...errors, amount: '' });
                                            // Auto-calc dependent field
                                            setForm(prev => {
                                                const amt = Number(val);
                                                if (!amt) return { ...prev, amount: val };

                                                if (calcMode === 'TENURE' && prev.tenure) {
                                                    return { ...prev, amount: val, emi: Math.ceil(amt / Number(prev.tenure)).toString() };
                                                }
                                                if (calcMode === 'EMI' && prev.emi) {
                                                    return { ...prev, amount: val, tenure: Math.ceil(amt / Number(prev.emi)).toString() };
                                                }
                                                return { ...prev, amount: val };
                                            });
                                        }}
                                        className={clsx(
                                            "w-full bg-dark-bg border rounded-lg p-2 text-white",
                                            errors.amount ? "border-red-500" : "border-dark-border"
                                        )}
                                        placeholder="5000"
                                    />
                                    {errors.amount && (
                                        <p className="text-xs text-red-400 mt-1 font-semibold animate-pulse">{errors.amount}</p>
                                    )}
                                </div>

                                {/* Calculation Toggle */}
                                <div className="col-span-2 flex bg-dark-bg rounded-lg p-1 border border-dark-border">
                                    <button
                                        type="button"
                                        onClick={() => setCalcMode('TENURE')}
                                        className={clsx("flex-1 py-1 text-xs rounded-md transition-colors", calcMode === 'TENURE' ? "bg-primary-500 text-white" : "text-dark-muted hover:text-white")}
                                    >
                                        By Months
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setCalcMode('EMI')}
                                        className={clsx("flex-1 py-1 text-xs rounded-md transition-colors", calcMode === 'EMI' ? "bg-primary-500 text-white" : "text-dark-muted hover:text-white")}
                                    >
                                        By EMI Amount
                                    </button>
                                </div>

                                <div>
                                    <InfoTip id="loanTenure" label="Months (Tenure)" />
                                    <input
                                        type="number"
                                        disabled={calcMode === 'EMI'}
                                        value={form.tenure}
                                        onChange={e => {
                                            const val = e.target.value;
                                            setErrors({ ...errors, tenure: '' });
                                            setForm(prev => {
                                                const amt = Number(prev.amount);
                                                const months = Number(val);
                                                if (amt && months) {
                                                    return { ...prev, tenure: val, emi: Math.ceil(amt / months).toString() };
                                                }
                                                return { ...prev, tenure: val };
                                            });
                                        }}
                                        className={clsx(
                                            "w-full bg-dark-bg border rounded-lg p-2 text-white",
                                            calcMode === 'EMI' && "opacity-50 cursor-not-allowed",
                                            errors.tenure && calcMode === 'TENURE' ? "border-red-500" : "border-dark-border"
                                        )}
                                        placeholder="Duration"
                                    />
                                    {errors.tenure && calcMode === 'TENURE' && (
                                        <p className="text-xs text-red-400 mt-1 font-semibold animate-pulse">{errors.tenure}</p>
                                    )}
                                </div>
                                <div>
                                    <InfoTip id="emiAmount" label="Monthly EMI (₹)" />
                                    <input
                                        type="number"
                                        disabled={calcMode === 'TENURE'}
                                        value={form.emi}
                                        onChange={e => {
                                            const val = e.target.value;
                                            setErrors({ ...errors, tenure: '' });
                                            setForm(prev => {
                                                const amt = Number(prev.amount);
                                                const emi = Number(val);
                                                if (amt && emi) {
                                                    return { ...prev, emi: val, tenure: Math.ceil(amt / emi).toString() };
                                                }
                                                return { ...prev, emi: val };
                                            });
                                        }}
                                        className={clsx(
                                            "w-full bg-dark-bg border rounded-lg p-2 text-white",
                                            calcMode === 'TENURE' && "opacity-50 cursor-not-allowed",
                                            errors.tenure && calcMode === 'EMI' ? "border-red-500" : "border-dark-border"
                                        )}
                                        placeholder="Deduction"
                                    />
                                    {errors.tenure && calcMode === 'EMI' && (
                                        <p className="text-xs text-red-400 mt-1 font-semibold animate-pulse">{errors.tenure}</p>
                                    )}
                                </div>
                            </div>

                            <button type="submit" className="w-full py-2 bg-warning hover:bg-warning/90 text-dark-bg font-bold rounded-lg transition-colors">
                                {canManage ? 'Issue Deduction' : 'Submit Request'}
                            </button>
                        </form>
                    </div>
                )}

                {viewMode === 'GRID' ? (
                    <div className={canManage ? "lg:col-span-2" : "lg:col-span-3"}>
                        {canManage && pendingLoans.length > 0 && (
                            <div className="mb-6">
                                <h3 className="font-bold text-white mb-4">Pending Requests ({pendingLoans.length})</h3>
                                <div className="space-y-4">
                                    {pendingLoans.map(loan => (
                                        <div key={loan.id} className="glass p-4 rounded-xl border border-warning/30 flex justify-between items-center">
                                            <div>
                                                <p className="font-bold text-white">{employees.find(e => e.id === loan.employeeId)?.name}</p>
                                                <p className="text-sm text-dark-muted">{loan.type} • ₹{loan.amount} • {loan.tenureMonths} Months</p>
                                                <p className="text-xs text-dark-muted italic">"{loan.reason}"</p>
                                            </div>
                                            <div className="flex gap-2">
                                                {/* WhatsApp Send Button (Phase 1/2) */}
                                                <button
                                                    onClick={() => {
                                                        const emp = employees.find(e => e.id === loan.employeeId);
                                                        const url = generateApprovalMessage(loan, emp);
                                                        window.open(url, '_blank');
                                                    }}
                                                    className="p-2 bg-[#25D366]/20 text-[#25D366] hover:bg-[#25D366] hover:text-white rounded-lg transition-colors border border-[#25D366]/30"
                                                    title="Send for Approval via WhatsApp"
                                                >
                                                    <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" /></svg>
                                                </button>

                                                {canApprove && (
                                                    <>
                                                        <button
                                                            onClick={() => approveLoan(loan.id)}
                                                            className="p-2 bg-success/20 text-success hover:bg-success hover:text-white rounded-lg transition-colors"
                                                            title="Approve Locally"
                                                        >
                                                            <CheckCircle className="w-5 h-5" />
                                                        </button>
                                                        <button
                                                            onClick={() => rejectLoan(loan.id)}
                                                            className="p-2 bg-danger/20 text-danger hover:bg-danger hover:text-white rounded-lg transition-colors"
                                                            title="Reject"
                                                        >
                                                            <XCircle className="w-5 h-5" />
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {visibleLoans.map(loan => {
                                const emp = employees.find(e => e.id === loan.employeeId);
                                const paid = loan.amount - loan.balance;
                                const progress = (paid / loan.amount) * 100;
                                const isEditing = editingLoanId === loan.id;

                                return (
                                    <div key={loan.id} className="glass p-5 rounded-2xl border-l-4 border-warning relative overflow-hidden group">
                                        <div className="relative z-10">
                                            <div className="flex justify-between items-start mb-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="p-2 bg-dark-bg/50 rounded-lg text-warning">
                                                        {getTypeIcon(loan.type)}
                                                    </div>
                                                    <div>
                                                        <h4 className="font-bold text-white text-lg">{emp?.name}</h4>
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-xs px-2 py-0.5 rounded bg-dark-bg/50 text-dark-muted border border-dark-border">
                                                                {loanTypes.find(lt => lt.key === loan.type)?.label || loan.type}
                                                            </span>
                                                            {loan.status === 'CLOSED' && <span className="text-xs text-success font-bold">PAID OFF</span>}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-xs text-dark-muted">Balance</p>
                                                    <p className={clsx("text-xl font-bold", loan.status === 'CLOSED' ? "text-success" : "text-danger")}>
                                                        ₹ {loan.balance.toLocaleString()}
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Audit Trail - WHO Approved/Rejected */}
                                            {loan.auditTrail && loan.auditTrail.length > 0 && (
                                                <div className="mb-3 p-2 bg-dark-bg/30 rounded-lg border border-dark-border/30">
                                                    {loan.auditTrail.slice(-2).reverse().map((audit, idx) => {
                                                        if (audit.action === 'APPROVED' || audit.action === 'REJECTED' || audit.action === 'CHECKED') {
                                                            const isApproved = audit.action === 'APPROVED';
                                                            const isRejected = audit.action === 'REJECTED';
                                                            const isChecked = audit.action === 'CHECKED';

                                                            return (
                                                                <div key={audit.id || idx} className="flex items-center justify-between text-xs py-1">
                                                                    <div className="flex items-center gap-2">
                                                                        {isApproved && <CheckCircle className="w-3 h-3 text-success" />}
                                                                        {isRejected && <XCircle className="w-3 h-3 text-danger" />}
                                                                        {isChecked && <CheckCircle className="w-3 h-3 text-blue-400" />}
                                                                        <span className={clsx(
                                                                            "font-medium",
                                                                            isApproved && "text-success",
                                                                            isRejected && "text-danger",
                                                                            isChecked && "text-blue-400"
                                                                        )}>
                                                                            {isApproved && 'Approved'}
                                                                            {isRejected && 'Rejected'}
                                                                            {isChecked && 'Checked'}
                                                                        </span>
                                                                        <span className="text-dark-muted">by</span>
                                                                        <span className="text-white font-semibold">{audit.performedBy}</span>
                                                                    </div>
                                                                    <span className="text-dark-muted">
                                                                        {new Date(audit.date).toLocaleDateString('en-IN', {
                                                                            day: '2-digit',
                                                                            month: 'short',
                                                                            year: 'numeric'
                                                                        })}
                                                                    </span>
                                                                </div>
                                                            );
                                                        }
                                                        return null;
                                                    })}
                                                </div>
                                            )}

                                            <div className="space-y-3 bg-dark-bg/20 p-3 rounded-xl">
                                                <div className="flex justify-between text-sm">
                                                    <span className="text-dark-muted">Total Amount</span>
                                                    <span className="text-white">₹ {loan.amount.toLocaleString()}</span>
                                                </div>

                                                {/* Editable EMI Section */}
                                                <div className="flex justify-between items-center text-sm">
                                                    <span className="text-dark-muted">Monthly Deduction</span>
                                                    <div className="flex items-center gap-2">
                                                        {isEditing ? (
                                                            <div className="flex items-center gap-1">
                                                                <input
                                                                    type="number"
                                                                    className="w-20 bg-dark-bg border border-primary-500 rounded px-1 py-0.5 text-white text-right"
                                                                    value={editEmiValue}
                                                                    onChange={(e) => setEditEmiValue(e.target.value)}
                                                                    autoFocus
                                                                />
                                                                <button onClick={() => handleSaveEdit(loan.id)} className="text-success hover:bg-dark-bg/50 p-1 rounded">
                                                                    <Save className="w-4 h-4" />
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <span className="text-warning font-mono font-bold text-lg">₹ {loan.emiAmount?.toLocaleString()}</span>
                                                        )}

                                                        {canManage && !isEditing && loan.status === 'ACTIVE' && (
                                                            <button
                                                                onClick={() => handleStartEdit(loan.id, loan.emiAmount)}
                                                                className="text-dark-muted hover:text-white transition-colors"
                                                                title="Edit EMI Amount"
                                                            >
                                                                <Edit2 className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Progress Bar */}
                                            <div className="w-full h-1.5 bg-dark-bg rounded-full overflow-hidden mt-4 mb-2">
                                                <div className="h-full bg-success transition-all duration-500" style={{ width: `${progress}%` }} />
                                            </div>

                                            {/* Passbook Toggle */}
                                            <button
                                                onClick={() => setViewLedgerId(loan.id)}
                                                className="w-full py-1.5 text-xs text-primary-400 hover:text-white hover:bg-primary-500/20 rounded-lg transition-colors flex items-center justify-center gap-2"
                                            >
                                                <BookOpen className="w-3 h-3" />
                                                View Passbook
                                            </button>

                                            {/* Advanced Features - Only for ACTIVE loans */}
                                            {loan.status === 'ACTIVE' && canManage && (
                                                <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-dark-border/50">
                                                    <button
                                                        onClick={() => setSkipMonthLoanId(loan.id)}
                                                        className="py-2 text-xs bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 hover:text-orange-300 rounded-lg transition-all flex items-center justify-center gap-1.5 border border-orange-500/20"
                                                    >
                                                        <Clock className="w-3.5 h-3.5" />
                                                        Skip Month
                                                    </button>
                                                    <button
                                                        onClick={() => setSettlementLoanId(loan.id)}
                                                        className="py-2 text-xs bg-green-500/10 hover:bg-green-500/20 text-green-400 hover:text-green-300 rounded-lg transition-all flex items-center justify-center gap-1.5 border border-green-500/20"
                                                    >
                                                        <Zap className="w-3.5 h-3.5" />
                                                        Settle Early
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ) : (
                    /* LIST VIEW (Table) */
                    <div className={canManage ? "lg:col-span-2" : "lg:col-span-3"}>
                        <div className="glass rounded-xl overflow-x-auto">
                            <table className="w-full text-left text-sm min-w-[640px]">
                                <thead className="bg-dark-surface border-b border-dark-border text-dark-muted">
                                    <tr>
                                        <th className="p-4">Employee</th>
                                        <th className="p-4">Type</th>
                                        <th className="p-4 text-right">Total</th>
                                        <th className="p-4 text-right text-danger">Balance</th>
                                        <th className="p-4 text-right text-warning">EMI / Month</th>
                                        <th className="p-4">Status</th>
                                        <th className="p-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-dark-border">
                                    {[...pendingLoans, ...visibleLoans].map(loan => {
                                        const emp = employees.find(e => e.id === loan.employeeId);
                                        return (
                                            <tr key={loan.id} className="hover:bg-dark-surface/50 transition-colors">
                                                <td className="p-4">
                                                    <div className="font-medium text-white">{emp?.name}</div>
                                                    <div className="text-xs text-dark-muted">{emp?.department}</div>
                                                </td>
                                                <td className="p-4">
                                                    <div className="flex items-center gap-2">
                                                        {getTypeIcon(loan.type)}
                                                        <span className="text-white">{loan.type.replace('_', ' ')}</span>
                                                    </div>
                                                </td>
                                                <td className="p-4 text-right font-mono text-white">₹{loan.amount.toLocaleString()}</td>
                                                <td className="p-4 text-right font-mono font-bold text-danger">₹{loan.balance.toLocaleString()}</td>
                                                <td className="p-4 text-right font-mono text-warning">₹{loan.emiAmount.toLocaleString()}</td>
                                                <td className="p-4">
                                                    <span className={clsx("px-2 py-1 rounded text-xs font-bold uppercase",
                                                        loan.status === 'ACTIVE' ? "bg-primary-500/20 text-primary-400" :
                                                            loan.status === 'REQUESTED' ? "bg-warning/20 text-warning" :
                                                                "bg-success/20 text-success"
                                                    )}>
                                                        {loan.status}
                                                    </span>
                                                </td>
                                                <td className="p-4 text-right">
                                                    <div className="flex justify-end gap-2">
                                                        {loan.status === 'REQUESTED' && canApprove ? (
                                                            <>
                                                                <button onClick={() => approveLoan(loan.id)} className="p-1.5 bg-success/20 text-success rounded hover:bg-success hover:text-white" title="Approve"><CheckCircle className="w-4 h-4" /></button>
                                                                <button onClick={() => rejectLoan(loan.id)} className="p-1.5 bg-danger/20 text-danger rounded hover:bg-danger hover:text-white" title="Reject"><XCircle className="w-4 h-4" /></button>
                                                            </>
                                                        ) : (
                                                            <button onClick={() => setViewLedgerId(loan.id)} className="p-1.5 bg-dark-bg text-dark-muted rounded hover:text-white" title="Passbook"><BookOpen className="w-4 h-4" /></button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {([...pendingLoans, ...visibleLoans].length === 0) && (
                                        <tr><td colSpan={7} className="p-8 text-center text-dark-muted">No loans found.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* PASSBOOK MODAL */}
                {viewLedgerId && (() => {
                    const loan = loans.find(l => l.id === viewLedgerId);
                    if (!loan) return null;
                    return (
                        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                            <div className="glass w-full max-w-md rounded-2xl p-6 relative animate-in zoom-in-95">
                                <button onClick={() => setViewLedgerId(null)} className="absolute top-4 right-4 text-dark-muted hover:text-white">
                                    <XCircle className="w-6 h-6" />
                                </button>

                                <h3 className="text-xl font-bold text-white mb-1">Loan Passbook</h3>
                                <p className="text-dark-muted text-sm mb-4">Transaction History for Loan #{loan.id.slice(-4)}</p>

                                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                                    {(!loan.ledger || loan.ledger.length === 0) ? (
                                        <p className="text-dark-muted text-center py-4">No transactions yet.</p>
                                    ) : (
                                        loan.ledger.map(txn => (
                                            <div key={txn.id} className="p-3 bg-dark-bg/50 rounded-lg border border-dark-border">
                                                {editingTxnId === txn.id ? (
                                                    <div className="space-y-2">
                                                        <input
                                                            type="date"
                                                            value={editForm.date}
                                                            onChange={e => setEditForm({ ...editForm, date: e.target.value })}
                                                            className="w-full bg-dark-bg border border-dark-border rounded p-1 text-xs text-white"
                                                        />
                                                        <input
                                                            type="number"
                                                            value={editForm.amount}
                                                            onChange={e => setEditForm({ ...editForm, amount: e.target.value })}
                                                            className="w-full bg-dark-bg border border-dark-border rounded p-1 text-xs text-white"
                                                            placeholder="Amount"
                                                        />
                                                        <input
                                                            type="text"
                                                            value={editForm.remarks}
                                                            onChange={e => setEditForm({ ...editForm, remarks: e.target.value })}
                                                            className="w-full bg-dark-bg border border-dark-border rounded p-1 text-xs text-white"
                                                            placeholder="Remarks"
                                                        />
                                                        <div className="flex gap-2 justify-end">
                                                            <button onClick={() => setEditingTxnId(null)} className="text-xs text-dark-muted hover:text-white px-2 py-1">Cancel</button>
                                                            <button onClick={saveEdit} className="text-xs bg-success text-white px-2 py-1 rounded">Save</button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="flex justify-between items-center group">
                                                        <div>
                                                            <p className="text-white text-sm font-medium">{txn.type === 'ADVANCE_PAYMENT' ? 'Advance Given' : 'Repayment Received'}</p>
                                                            <p className="text-xs text-dark-muted">{txn.date} • {txn.remarks}</p>
                                                        </div>
                                                        <div className="flex items-center gap-3">
                                                            <p className={clsx("font-bold font-mono", txn.type === 'ADVANCE_PAYMENT' ? "text-danger" : "text-success")}>
                                                                {txn.type === 'ADVANCE_PAYMENT' ? '+' : '-'} ₹{txn.amount}
                                                            </p>
                                                            {/* ACTIONS - Only for Admins or Manage Loans permission */}
                                                            {canManage && (
                                                                <div className="hidden group-hover:flex gap-1 ml-2">
                                                                    <button onClick={() => handleEditClick(txn)} className="p-1 text-primary-400 hover:text-white transition-colors" title="Edit">
                                                                        <Edit2 className="w-4 h-4" />
                                                                    </button>
                                                                    <button onClick={() => handleDeleteClick(txn.id)} className="p-1 text-danger hover:text-red-400 transition-colors" title="Delete">
                                                                        <Trash2 className="w-4 h-4" />
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        ))
                                    )}
                                </div>

                                {/* DELETE CONFIRMATION DIALOG */}
                                {deleteStage > 0 && (
                                    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/90 rounded-2xl p-6">
                                        <div className="text-center space-y-4 animate-in zoom-in-95">
                                            <AlertTriangle className="w-12 h-12 text-danger mx-auto" />
                                            <div>
                                                <h4 className="text-lg font-bold text-white">
                                                    {deleteStage === 1 && "Start Deletion Process?"}
                                                    {deleteStage === 2 && "Is it absolute?"}
                                                    {deleteStage === 3 && "Final Confirmation!"}
                                                </h4>
                                                <p className="text-dark-muted text-sm mt-2">
                                                    {deleteStage === 1 && "Deleting this entry will adjust the loan balance. Are you sure?"}
                                                    {deleteStage === 2 && "This action cannot be undone. Do you really want to proceed?"}
                                                    {deleteStage === 3 && "Press DELETE one last time to permanently remove this transaction."}
                                                </p>
                                            </div>
                                            <div className="flex justify-center gap-3">
                                                <button
                                                    onClick={() => { setDeleteStage(0); setDeleteTxnId(null); }}
                                                    className="px-4 py-2 bg-dark-bg border border-dark-border text-white rounded-lg hover:bg-white/10"
                                                >
                                                    Cancel
                                                </button>
                                                <button
                                                    onClick={confirmDelete}
                                                    className="px-4 py-2 bg-danger text-white rounded-lg hover:bg-danger/80"
                                                >
                                                    {deleteStage === 3 ? "PERMANENTLY DELETE" : "Yes, Continue"}
                                                </button>
                                            </div>
                                            {deleteStage > 0 && (
                                                <div className="flex justify-center gap-1 mt-2">
                                                    <div className={clsx("w-2 h-2 rounded-full", deleteStage >= 1 ? "bg-danger" : "bg-dark-border")} />
                                                    <div className={clsx("w-2 h-2 rounded-full", deleteStage >= 2 ? "bg-danger" : "bg-dark-border")} />
                                                    <div className={clsx("w-2 h-2 rounded-full", deleteStage >= 3 ? "bg-danger" : "bg-dark-border")} />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                <div className="mt-4 pt-4 border-t border-dark-border flex justify-between items-center">
                                    <span className="text-dark-muted">Remaining Balance</span>
                                    <span className="text-xl font-bold text-white">₹ {loan.balance}</span>
                                </div>
                            </div>
                        </div>
                    );
                })()}
            </div>

            {/* Advanced Features Modals */}
            {
                skipMonthLoanId && (
                    <SkipMonthModal
                        loanId={skipMonthLoanId as string}
                        onClose={() => setSkipMonthLoanId(null)}
                    />
                )
            }

            {
                settlementLoanId && (
                    <EarlySettlementModal
                        loanId={settlementLoanId as string}
                        onClose={() => setSettlementLoanId(null)}
                    />
                )
            }
            {showBulkModal && <BulkLoanEntryModal onClose={() => setShowBulkModal(false)} />}
            {showHistoryModal && <LoanHistoryModal onClose={() => setShowHistoryModal(false)} />}
            {showLoanTypesModal && <LoanTypesModal onClose={() => setShowLoanTypesModal(false)} />}
        </div >
    );
};
