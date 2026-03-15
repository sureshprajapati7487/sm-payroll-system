import { useEffect, useState } from 'react';
import { CheckCircle, XCircle, Clock, IndianRupee, Calendar, User, FileText } from 'lucide-react';
import { useNotificationStore } from '@/store/notificationStore';
import { useLoanStore } from '@/store/loanStore';
import { useAuthStore } from '@/store/authStore';
import { useEmployeeStore } from '@/store/employeeStore';
import { useRolePermissionsStore } from '@/store/rolePermissionsStore';
import { LoanNotification } from '@/types';
import { sendLoanApprovalWhatsApp, sendLoanRejectionWhatsApp } from '@/utils/whatsappService';

export const LoanApprovalModal = () => {
    const { user } = useAuthStore();
    const { permissions } = useRolePermissionsStore();
    const { notifications, activeNotificationId, setActiveNotification, markAsRead, clearNotification, getNotificationsForUser } = useNotificationStore();
    const { approveLoan, rejectLoan, loans } = useLoanStore();
    const { employees } = useEmployeeStore();
    const [currentNotification, setCurrentNotification] = useState<LoanNotification | null>(null);
    const [savedNotification, setSavedNotification] = useState<LoanNotification | null>(null);
    const [actionLoading, setActionLoading] = useState(false);
    const [lastAction, setLastAction] = useState<'approved' | 'rejected' | null>(null);

    // Get pending notifications for current user
    useEffect(() => {
        if (!user) return;
        const userPerms: string[] = permissions[user.role] ?? [];
        const userNotifications = getNotificationsForUser(user.id, user.role, userPerms);
        const unreadNotifications = userNotifications.filter(n => !n.isRead && !!n.loanId);

        if (unreadNotifications.length > 0) {
            if (!activeNotificationId) {
                setActiveNotification(unreadNotifications[0].id);
            }
        }
    }, [user, notifications, activeNotificationId]);

    // Update current notification when active ID changes
    useEffect(() => {
        if (activeNotificationId) {
            const notification = notifications.find(n => n.id === activeNotificationId);
            setCurrentNotification(notification || null);
        } else {
            setCurrentNotification(null);
        }
    }, [activeNotificationId, notifications]);

    const handleApprove = async () => {
        if (!currentNotification) return;
        setActionLoading(true);
        try {
            setSavedNotification(currentNotification);
            approveLoan(currentNotification.loanId ?? '');
            markAsRead(currentNotification.id);
            clearNotification(currentNotification.id);
            setLastAction('approved');
        } catch (error) {
            console.error('Error approving loan:', error);
        } finally {
            setActionLoading(false);
        }
    };

    const handleReject = async () => {
        if (!currentNotification) return;
        setActionLoading(true);
        try {
            setSavedNotification(currentNotification);
            rejectLoan(currentNotification.loanId ?? '');
            markAsRead(currentNotification.id);
            clearNotification(currentNotification.id);
            setLastAction('rejected');
        } catch (error) {
            console.error('Error rejecting loan:', error);
        } finally {
            setActionLoading(false);
        }
    };

    // After WA sent (or skipped), move to next
    const handleAfterWhatsApp = () => {
        setLastAction(null);
        showNextNotification();
    };

    const handleSkip = () => {
        if (!currentNotification) return;

        // Just mark as read but don't clear (they can review later)
        markAsRead(currentNotification.id);

        // Show next notification if available
        showNextNotification();
    };

    const showNextNotification = () => {
        if (!user) return;
        const userPerms: string[] = permissions[user.role] ?? [];
        const userNotifications = getNotificationsForUser(user.id, user.role, userPerms);
        const unreadNotifications = userNotifications.filter(n => !n.isRead && n.id !== currentNotification?.id && !!n.loanId);

        if (unreadNotifications.length > 0) {
            setActiveNotification(unreadNotifications[0].id);
        } else {
            setActiveNotification(null);
        }
    };

    // Don't render if no notification AND no pending WA action
    if (!currentNotification && !lastAction) return null;

    // When showing WA prompt after action, use savedNotification
    const notif = currentNotification ?? savedNotification;
    if (!notif) return null;


    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0,
        }).format(amount);
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
        });
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[9999] p-4 animate-in fade-in duration-300">
            <div className="glass max-w-2xl w-full p-8 rounded-2xl space-y-6 animate-in zoom-in-95 duration-300">
                {/* Header */}
                <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-500 rounded-xl flex items-center justify-center">
                            <FileText className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-white">Loan Approval Request</h2>
                            <p className="text-sm text-dark-muted">Action required - Please review</p>
                        </div>
                    </div>
                    {/* Cannot close without action - no X button */}
                </div>

                {/* Employee Info */}
                <div className="bg-dark-surface/50 rounded-xl p-4 border border-dark-border">
                    <div className="flex items-center gap-3 mb-3">
                        <User className="w-5 h-5 text-blue-400" />
                        <span className="text-sm font-medium text-dark-muted">Employee Details</span>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <p className="text-xs text-dark-muted mb-1">Name</p>
                            <p className="text-white font-semibold">{notif.employeeName}</p>
                        </div>
                        <div>
                            <p className="text-xs text-dark-muted mb-1">Employee Code</p>
                            <p className="text-white font-semibold">{notif.employeeCode}</p>
                        </div>
                    </div>
                </div>

                {/* Loan Details Grid */}
                <div className="grid grid-cols-2 gap-4">
                    {/* 1. Naya Loan (New Loan Being Approved) */}
                    <div className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 rounded-xl p-4 border border-green-500/20">
                        <div className="flex items-center gap-2 mb-2">
                            <IndianRupee className="w-4 h-4 text-green-400" />
                            <span className="text-xs font-medium text-green-400">Naya Loan</span>
                        </div>
                        <p className="text-2xl font-bold text-white">{formatCurrency(notif.amount ?? 0)}</p>
                        <p className="text-xs text-dark-muted mt-1">Is request me sanction hone wala amount</p>
                    </div>

                    {/* 2. Chal Raha Loan (Existing Outstanding Balance) - ALWAYS SHOW */}
                    <div className="bg-gradient-to-br from-orange-500/10 to-red-500/10 rounded-xl p-4 border border-orange-500/20">
                        <div className="flex items-center gap-2 mb-2">
                            <Clock className="w-4 h-4 text-orange-400" />
                            <span className="text-xs font-medium text-orange-400">Chal Raha Loan (Outstanding)</span>
                        </div>
                        <p className="text-2xl font-bold text-white">
                            {formatCurrency((notif.balance ?? 0) + (notif.amount ?? 0))}
                        </p>
                        <p className="text-xs text-dark-muted mt-1">
                            {(notif.balance ?? 0) > 0
                                ? `Purana ${formatCurrency(notif.balance ?? 0)} + Naya ${formatCurrency(notif.amount ?? 0)}`
                                : 'Sirf naya loan ka amount'}
                        </p>
                    </div>

                    {/* 3. Is Mahine Ka Salary (Current Month Salary with Breakdown) */}
                    <div className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 rounded-xl p-4 border border-blue-500/20">
                        <div className="flex items-center gap-2 mb-2">
                            <Calendar className="w-4 h-4 text-blue-400" />
                            <span className="text-xs font-medium text-blue-400">Is Mahine Ka Salary</span>
                        </div>
                        <p className="text-2xl font-bold text-white">{formatCurrency(notif.currentSalary || 0)}</p>
                        <p className="text-xs text-dark-muted mt-1">
                            {notif.workedDays && notif.perDayRate ? (
                                <>
                                    {notif.workedDays} days × {formatCurrency(notif.perDayRate)}
                                </>
                            ) : (
                                'Is mahine salary'
                            )}
                        </p>
                    </div>

                    {/* 4. Work In Month (Basic + OT Only) */}
                    <div className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 rounded-xl p-4 border border-purple-500/20">
                        <div className="flex items-center gap-2 mb-2">
                            <Clock className="w-4 h-4 text-purple-400" />
                            <span className="text-xs font-medium text-purple-400">Work In Month</span>
                        </div>
                        <p className="text-2xl font-bold text-white">{formatCurrency(notif.workInMonth || 0)}</p>
                        <p className="text-xs text-dark-muted mt-1">Basic + OT ka amount</p>
                    </div>
                </div>

                {/* Reason */}
                {notif.reason && (
                    <div className="bg-dark-surface/50 rounded-xl p-4 border border-dark-border">
                        <p className="text-xs text-dark-muted mb-2">Reason for Loan</p>
                        <p className="text-white">{notif.reason}</p>
                    </div>
                )}

                {/* Request Time */}
                <div className="flex items-center gap-2 text-sm text-dark-muted">
                    <Clock className="w-4 h-4" />
                    <span>Requested on {formatDate(notif.timestamp)}</span>
                </div>

                {/* Action Buttons — only show if no lastAction pending */}
                {!lastAction && (
                    <div className="flex gap-3 pt-4">
                        <button
                            onClick={handleApprove}
                            disabled={actionLoading}
                            className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white px-6 py-4 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <CheckCircle className="w-5 h-5" />
                            {actionLoading ? 'Processing...' : 'Approve Loan'}
                        </button>

                        <button
                            onClick={handleReject}
                            disabled={actionLoading}
                            className="flex-1 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white px-6 py-4 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <XCircle className="w-5 h-5" />
                            {actionLoading ? 'Processing...' : 'Reject Loan'}
                        </button>

                        <button
                            onClick={handleSkip}
                            disabled={actionLoading}
                            className="bg-dark-surface hover:bg-white/5 text-dark-muted hover:text-white px-6 py-4 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 border border-dark-border disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Clock className="w-5 h-5" />
                            Skip for Now
                        </button>
                    </div>
                )}

                {/* WhatsApp Notification Step — after approve/reject */}
                {lastAction && currentNotification && (() => {
                    const emp = employees.find(e => e.id === currentNotification.employeeId);
                    const loan = loans.find(l => l.id === currentNotification.loanId);
                    const isApproved = lastAction === 'approved';

                    return (
                        <div className={`rounded-2xl p-5 border space-y-4 ${isApproved ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
                            <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isApproved ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
                                    {isApproved ? <CheckCircle className="w-5 h-5 text-green-400" /> : <XCircle className="w-5 h-5 text-red-400" />}
                                </div>
                                <div>
                                    <p className={`font-bold text-sm ${isApproved ? 'text-green-400' : 'text-red-400'}`}>
                                        Loan {isApproved ? 'Approved' : 'Rejected'} ✓
                                    </p>
                                    <p className="text-dark-muted text-xs">Employee ko WhatsApp notification bhejein?</p>
                                </div>
                            </div>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => {
                                        if (emp && loan) {
                                            if (isApproved) {
                                                sendLoanApprovalWhatsApp(emp, {
                                                    amount: currentNotification.amount ?? 0,
                                                    emiAmount: currentNotification.emiAmount ?? 0,
                                                    tenureMonths: currentNotification.tenureMonths ?? 0,
                                                    type: currentNotification.loanType || loan.type,
                                                    reason: currentNotification.reason
                                                });
                                            } else {
                                                sendLoanRejectionWhatsApp(emp, {
                                                    amount: currentNotification.amount ?? 0,
                                                    emiAmount: currentNotification.emiAmount ?? 0,
                                                    tenureMonths: currentNotification.tenureMonths ?? 0,
                                                    type: currentNotification.loanType || loan.type,
                                                    reason: currentNotification.reason
                                                });
                                            }
                                        }
                                        handleAfterWhatsApp();
                                    }}
                                    className="flex-1 flex items-center justify-center gap-2 py-3 bg-[#25D366] hover:bg-[#1ebe59] text-white rounded-xl font-bold transition-all"
                                >
                                    <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                                    </svg>
                                    WhatsApp Bhejo
                                </button>
                                <button
                                    onClick={handleAfterWhatsApp}
                                    className="px-4 py-3 bg-dark-surface hover:bg-white/5 text-dark-muted hover:text-white rounded-xl font-semibold transition-all border border-dark-border text-sm"
                                >
                                    Skip
                                </button>
                            </div>
                        </div>
                    );
                })()}

                {/* Queue Info */}
                {user && (() => {
                    const userPerms: string[] = permissions[user.role] ?? [];
                    const pendingLoans = getNotificationsForUser(user.id, user.role, userPerms).filter(n => !n.isRead && !!n.loanId);
                    return pendingLoans.length > 1 ? (
                        <div className="text-center text-sm text-dark-muted">
                            {pendingLoans.length - 1} more pending approval{pendingLoans.length > 2 ? 's' : ''}
                        </div>
                    ) : null;
                })()}
            </div>
        </div>
    );
};
